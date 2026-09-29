"""Comparison attachment failures must not invalidate primary optimization results."""
from __future__ import annotations

import sys
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import backend.job_manager as JM
import backend.pipeline_bridge as bridge
import backend.routers.optimization as optimization_router
from algo_common import Solution
from backend.comparison_service import compare_algorithms


def test_runtime_context_registration_failure_preserves_primary_result(monkeypatch):
    legs = [[SimpleNamespace(candidate=SimpleNamespace(candidate_id="C1"), feasible=True)]]
    primary = Solution((0,), 10.0, 20.0, 30.0, True)
    artifacts = {
        "candidate_ids": ("C1",),
        "algorithm_candidate_ids": {
            "MO-QIGA": ("C1",), "NSGA-II": ("C1",), "MILP Reference": ("C1",),
        },
        "fronts": {"MO-QIGA": [primary], "NSGA-II": [primary], "MILP": [primary]},
        "runtimes_ms": {"MO-QIGA": 1.0, "NSGA-II": 1.0, "MILP": 1.0},
        "milp_references": {
            "minimum_fuel": primary, "minimum_cost": primary, "minimum_ghg": primary,
        },
        "errors": {},
    }

    def run_all(received_legs, comparison_recorder):
        assert received_legs is legs
        comparison_recorder(artifacts)
        return [primary], ["MO-QIGA"], artifacts["fronts"]

    fake_pipeline = SimpleNamespace(
        generate_evaluated_legs=lambda seed: (legs[0], legs, {}),
        run_all_algorithms=run_all,
    )
    monkeypatch.setitem(sys.modules, "run_optimization_pipeline", fake_pipeline)
    monkeypatch.setattr(bridge, "build_runtime_result", lambda *_args: {
        "run_id": "temporary", "status": "completed", "pareto_solutions": [{"id": "S01"}],
    })
    monkeypatch.setattr(
        bridge,
        "register_comparison_context",
        lambda _context: (_ for _ in ()).throw(OSError("context store unavailable")),
    )
    monkeypatch.setattr(JM, "_COMPARISON_ERRORS", {})

    result = bridge.run_optimization_async(SimpleNamespace(id="public-run"), seed=7)

    assert result["status"] == "completed"
    assert result["run_id"] == "public-run"
    assert JM.get_comparison_error("public-run") == "context store unavailable"


def test_default_result_survives_archived_comparison_setup_failure(monkeypatch):
    """The instant primary result stays usable when optional archives are missing."""
    primary = {
        "run_id": "archived-public-run",
        "status": "completed",
        "pareto_solutions": [{"id": "S01"}],
    }
    monkeypatch.setattr(optimization_router, "_initialized", False)
    monkeypatch.setattr(optimization_router, "get_default_result", lambda: primary)
    monkeypatch.setattr(
        optimization_router,
        "register_precomputed_comparison_context",
        lambda _result: (_ for _ in ()).throw(OSError("archive missing")),
    )
    monkeypatch.setattr(JM, "_LATEST_RESULT", None)
    monkeypatch.setattr(JM, "_COMPARISON_CONTEXTS", {})
    monkeypatch.setattr(JM, "_COMPARISON_ERRORS", {})

    assert optimization_router.get_latest() == primary
    assert JM.get_comparison_error("archived-public-run") == "archive missing"

    with pytest.raises(HTTPException) as exc_info:
        optimization_router.compare_run_algorithms("archived-public-run")
    assert exc_info.value.status_code == 503
    assert "archive missing" in exc_info.value.detail


def test_comparison_error_evicts_a_stale_context_for_the_same_run_id(monkeypatch):
    monkeypatch.setattr(JM, "_COMPARISON_CONTEXTS", {"reused-run": object()})
    monkeypatch.setattr(JM, "_COMPARISON_ERRORS", {})

    JM.set_comparison_error("reused-run", "new archive failed validation")

    assert JM.get_comparison_context("reused-run") is None
    assert JM.get_comparison_error("reused-run") == "new archive failed validation"


def test_runtime_result_public_run_id_resolves_stored_comparison(monkeypatch):
    """Exercise bridge -> public run ID -> stored context -> comparison response."""
    legs = [[SimpleNamespace(candidate=SimpleNamespace(candidate_id="C1"), feasible=True)]]
    mo = Solution((0,), 10.0, 22.0, 31.0, True)
    nsga = Solution((0,), 11.0, 20.0, 32.0, True)
    references = {
        "minimum_fuel": Solution((0,), 9.0, 24.0, 30.0, True),
        "minimum_cost": Solution((0,), 12.0, 19.0, 34.0, True),
        "minimum_ghg": Solution((0,), 10.0, 25.0, 29.0, True),
    }
    artifacts = {
        "candidate_ids": ("C1",),
        "algorithm_candidate_ids": {
            "MO-QIGA": ("C1",),
            "NSGA-II": ("C1",),
            "MILP Reference": ("C1",),
        },
        "fronts": {
            "MO-QIGA": [mo],
            "NSGA-II": [nsga],
            "MILP": list(references.values()),
        },
        "runtimes_ms": {"MO-QIGA": 1.0, "NSGA-II": 2.0, "MILP": 3.0},
        "milp_references": references,
        "errors": {},
    }

    def run_all(received_legs, comparison_recorder):
        assert received_legs is legs
        comparison_recorder(artifacts)
        return [mo], ["MO-QIGA"], artifacts["fronts"]

    fake_pipeline = SimpleNamespace(
        generate_evaluated_legs=lambda seed: (legs[0], legs, {}),
        run_all_algorithms=run_all,
    )
    monkeypatch.setitem(sys.modules, "run_optimization_pipeline", fake_pipeline)
    monkeypatch.setattr(bridge, "build_runtime_result", lambda *_args: {
        "run_id": "temporary",
        "status": "completed",
        "pareto_solutions": [{"id": "S01"}],
    })
    monkeypatch.setattr(JM, "_COMPARISON_CONTEXTS", {})
    monkeypatch.setattr(JM, "_COMPARISON_ERRORS", {})

    result = bridge.run_optimization_async(SimpleNamespace(id="public-run"), seed=7)
    comparison = compare_algorithms(result["run_id"])

    assert result["run_id"] == "public-run"
    assert comparison["run_id"] == "public-run"
    assert comparison["input_audit"]["candidate_ids"] == ["C1"]
    assert comparison["mo_qiga"]["pareto_count"] == 1
    assert comparison["nsga2"]["pareto_count"] == 1
