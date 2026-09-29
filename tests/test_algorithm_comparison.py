"""Regression coverage for run-scoped algorithm comparison."""
from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import backend.job_manager as JM
from algo_common import Solution
from backend.comparison_service import (
    RunComparisonContext,
    _evaluated_input_fingerprint,
    _validated_reference_archive,
    compare_algorithms,
    register_precomputed_comparison_context,
    register_comparison_context,
)
from backend.data_adapter import load_precomputed_result
from backend.main import app


@pytest.fixture(autouse=True)
def isolated_comparison_contexts(monkeypatch):
    """Keep the process-wide run registry isolated without production cleanup APIs."""
    monkeypatch.setattr(JM, "_COMPARISON_CONTEXTS", {})


def _candidate(candidate_id: str, *, feasible: bool = True):
    return SimpleNamespace(
        candidate=SimpleNamespace(candidate_id=candidate_id),
        feasible=feasible,
    )


def _fully_evaluated_candidate(candidate_id: str, *, speed: float = 12.0):
    return SimpleNamespace(
        candidate=SimpleNamespace(
            candidate_id=candidate_id,
            leg_id="A->B",
            vessel_class="Bulk Carrier",
            origin_port="A",
            dest_port="B",
            distance_nm=100.0,
            speed_knots=speed,
            fuel_type="DM",
            cargo_tons=500.0,
            telemetry_row_id=7,
        ),
        predicted_fuel_rate=4.0,
        voyage_hours=100.0 / speed,
        voyage_fuel=33.0,
        cost_usd=21_000.0,
        ghg_kgco2=104_000.0,
        feasible=True,
    )


def _context(
    run_id: str = "run-public-123",
    *,
    fronts: dict[str, list[Solution]] | None = None,
    errors: dict[str, str] | None = None,
) -> RunComparisonContext:
    legs = [
        [_candidate("C0001"), _candidate("C0002", feasible=False)],
        [_candidate("C0003")],
    ]
    mo_front = [
        Solution((0, 0), fuel=110.0, cost=250.0, ghg=330.0, all_feasible=True),
        Solution((0, 0), fuel=115.0, cost=225.0, ghg=345.0, all_feasible=True),
    ]
    nsga_front = [
        Solution((0, 0), fuel=120.0, cost=220.0, ghg=360.0, all_feasible=True),
    ]
    milp_refs = {
        "minimum_fuel": Solution((0, 0), fuel=100.0, cost=280.0, ghg=310.0, all_feasible=True),
        "minimum_cost": Solution((0, 0), fuel=130.0, cost=200.0, ghg=350.0, all_feasible=True),
        "minimum_ghg": Solution((0, 0), fuel=105.0, cost=290.0, ghg=300.0, all_feasible=True),
    }
    return RunComparisonContext.from_run(
        run_id=run_id,
        structured_request={"objectives": ["fuel", "cost", "ghg"]},
        evaluated_legs=legs,
        fronts=fronts if fronts is not None else {
            "MO-QIGA": mo_front,
            "NSGA-II": nsga_front,
            "MILP": list(milp_refs.values()),
        },
        runtimes_ms={"MO-QIGA": 12.5, "NSGA-II": 25.0, "MILP": 5.0},
        milp_references=milp_refs,
        errors=errors or {},
        algorithm_candidate_ids={
            "MO-QIGA": ("C0001", "C0002", "C0003"),
            "NSGA-II": ("C0001", "C0002", "C0003"),
            "MILP Reference": ("C0001", "C0002", "C0003"),
        },
    )


def test_comparison_uses_run_scoped_stable_candidate_ids_for_every_algorithm():
    """A different or regenerated candidate set must not enter one algorithm."""
    register_comparison_context(_context())

    result = compare_algorithms("run-public-123")

    assert result["structured_request"] == {
        "objectives": ["fuel", "cost", "ghg"]
    }
    audit = result["input_audit"]
    assert audit["candidate_ids"] == ["C0001", "C0002", "C0003"]
    assert audit["feasible_candidate_ids"] == ["C0001", "C0003"]
    assert audit["candidate_count"] == 3
    assert audit["feasible_candidate_count"] == 2
    fingerprints = audit["algorithm_candidate_fingerprints"]
    assert fingerprints == {
        "MO-QIGA": audit["candidate_fingerprint"],
        "NSGA-II": audit["candidate_fingerprint"],
        "MILP Reference": audit["candidate_fingerprint"],
    }


def test_comparison_calculates_each_gap_against_its_matching_milp_minimum():
    """Fuel, cost, and GHG gaps must never share an unrelated MILP denominator."""
    register_comparison_context(_context())

    result = compare_algorithms("run-public-123")

    assert result["mo_qiga"]["objective_minima"] == {
        "fuel": 110.0,
        "cost": 225.0,
        "ghg": 330.0,
    }
    assert result["comparison"]["gaps_percent"]["mo_qiga"] == {
        "fuel": 10.0,
        "cost": 12.5,
        "ghg": 10.0,
    }
    assert result["comparison"]["gaps_percent"]["nsga2"] == {
        "fuel": 20.0,
        "cost": 10.0,
        "ghg": 20.0,
    }
    assert result["metric_context"]["hypervolume_reference_point"] == [1.0, 1.0, 1.0]
    assert result["mo_qiga"]["hypervolume"] is not None
    assert result["nsga2"]["hypervolume"] is not None


def test_nsga_failure_is_reported_without_destroying_primary_moqiga_result():
    """A failed benchmark must not turn a valid primary result into an API error."""
    context = _context(
        fronts={
            "MO-QIGA": [Solution((0, 0), 110.0, 225.0, 330.0, True)],
            "NSGA-II": [],
            "MILP": [],
        },
        errors={"NSGA-II": "population initialization failed"},
    )
    register_comparison_context(context)

    result = compare_algorithms("run-public-123")

    assert result["mo_qiga"]["status"] == "complete"
    assert result["mo_qiga"]["pareto_count"] == 1
    assert result["nsga2"] == {
        "status": "failed",
        "error": "population initialization failed",
        "runtime_ms": 25.0,
        "feasible": False,
        "pareto_count": 0,
        "objective_minima": None,
        "hypervolume": None,
        "spread": None,
        "solutions": [],
    }


def test_compare_endpoint_resolves_the_public_run_id():
    """The frontend's result.run_id must address the stored comparison directly."""
    register_comparison_context(_context(run_id="public-run-from-result"))

    response = TestClient(app).post(
        "/api/optimization/runs/public-run-from-result/compare"
    )

    assert response.status_code == 200
    assert response.json()["run_id"] == "public-run-from-result"
    assert response.json()["mo_qiga"]["pareto_count"] == 2


def test_compare_endpoint_returns_404_for_unknown_run():
    response = TestClient(app).post("/api/optimization/runs/missing/compare")

    assert response.status_code == 404
    assert response.json()["detail"] == "Optimization run not found for comparison."


def test_verified_context_requires_per_algorithm_candidate_evidence():
    """A shared-input badge must not be synthesized from one candidate manifest."""
    with pytest.raises(ValueError, match="Per-algorithm candidate IDs are required"):
        RunComparisonContext.from_run(
            run_id="missing-evidence",
            structured_request=None,
            evaluated_legs=[[_candidate("C1")]],
            fronts={"MO-QIGA": [], "NSGA-II": [], "MILP": []},
            runtimes_ms={},
            milp_references={},
        )


def test_evaluated_input_fingerprint_detects_value_changes_with_stable_ids():
    """Positional candidate IDs alone must not validate a stale reference archive."""
    baseline = [[_fully_evaluated_candidate("C0001", speed=12.0)]]
    changed = [[_fully_evaluated_candidate("C0001", speed=13.0)]]

    assert _evaluated_input_fingerprint(baseline) != _evaluated_input_fingerprint(changed)


def test_reference_archive_rejects_wrong_weights_even_with_matching_fingerprint():
    evaluated_legs = [[_fully_evaluated_candidate("C0001")]]
    fingerprint = _evaluated_input_fingerprint(evaluated_legs)
    reference = {
        "selection": [0],
        "fuel": 10.0,
        "cost": 20.0,
        "ghg": 30.0,
        "all_feasible": True,
    }
    archive = {
        "schema_version": 1,
        "strategy": "pure_objective_solve",
        "candidate_fingerprint": "unused-id-fingerprint",
        "evaluated_input_fingerprint": fingerprint,
        "references": {
            "minimum_fuel": {**reference, "weights": [0.5, 0.5, 0.0]},
            "minimum_cost": {**reference, "weights": [0.0, 1.0, 0.0]},
            "minimum_ghg": {**reference, "weights": [0.0, 0.0, 1.0]},
        },
    }

    with pytest.raises(ValueError, match="minimum_fuel weights"):
        _validated_reference_archive(archive, evaluated_legs)


def test_precomputed_run_loads_archived_inputs_without_regenerating_candidates(monkeypatch):
    """The instant dashboard run must compare archived outputs, never generate a lookalike run."""
    import candidate_generator

    def forbidden_regeneration(*_args, **_kwargs):
        raise AssertionError("comparison must not regenerate candidates")

    monkeypatch.setattr(candidate_generator, "generate_candidates", forbidden_regeneration)
    primary = load_precomputed_result()

    register_precomputed_comparison_context(primary)
    result = compare_algorithms(primary["run_id"])

    assert result["run_id"] == "precomputed-final-pareto"
    assert result["input_audit"]["verification_status"] == "unavailable_archived_run"
    assert result["input_audit"]["algorithm_candidate_fingerprints"] == {}
    assert result["input_audit"]["candidate_count"] == 252
    assert result["input_audit"]["feasible_candidate_count"] == 168
    assert result["mo_qiga"]["pareto_count"] == 4
    assert result["nsga2"]["pareto_count"] == 2
    assert set(result["milp"]["references"]) == {
        "minimum_fuel", "minimum_cost", "minimum_ghg"
    }
    assert result["milp"]["reference_strategy"] == "pure_objective_solve"
