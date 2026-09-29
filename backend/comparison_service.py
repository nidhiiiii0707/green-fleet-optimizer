"""Run-scoped MO-QIGA / NSGA-II / MILP comparison service.

Comparison is deliberately a consumer of stored optimization artifacts.  It
never regenerates candidates and never reruns MO-QIGA or NSGA-II.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import ast
import csv
import json
from hashlib import sha256
import math
from pathlib import Path
from typing import Any

import numpy as np

from algo_common import Solution, evaluate_selection
import backend.job_manager as JM
from metrics_utils import hypervolume_monte_carlo, normalize, spacing_diversity


ALGORITHM_NAMES = ("MO-QIGA", "NSGA-II", "MILP Reference")
HYPERVOLUME_SAMPLES = 200_000
REPO_ROOT = Path(__file__).resolve().parent.parent
EVALUATED_MANIFEST_PATH = REPO_ROOT / "evaluated_candidates_prototype.csv"
MILP_REFERENCE_PATH = REPO_ROOT / "milp_reference_minima.json"
REFERENCE_WEIGHTS = {
    "minimum_fuel": (1.0, 0.0, 0.0),
    "minimum_cost": (0.0, 1.0, 0.0),
    "minimum_ghg": (0.0, 0.0, 1.0),
}
CANDIDATE_FIELDS = (
    "candidate_id",
    "leg_id",
    "vessel_class",
    "origin_port",
    "dest_port",
    "distance_nm",
    "speed_knots",
    "fuel_type",
    "cargo_tons",
    "telemetry_row_id",
)
EVALUATION_FIELDS = (
    "predicted_fuel_rate",
    "voyage_hours",
    "voyage_fuel",
    "cost_usd",
    "ghg_kgco2",
    "feasible",
)


def _candidate_ids(evaluated_legs) -> tuple[str, ...]:
    return tuple(
        evaluated.candidate.candidate_id
        for leg in evaluated_legs
        for evaluated in leg
    )


def _feasible_candidate_ids(evaluated_legs) -> tuple[str, ...]:
    return tuple(
        evaluated.candidate.candidate_id
        for leg in evaluated_legs
        for evaluated in leg
        if evaluated.feasible
    )


def _fingerprint(candidate_ids: tuple[str, ...]) -> str:
    return sha256("\n".join(candidate_ids).encode("utf-8")).hexdigest()


def _evaluated_input_records(evaluated_legs) -> list[dict[str, Any]]:
    """Canonical exact optimizer inputs, objectives, and feasibility state."""
    records = []
    for leg in evaluated_legs:
        for evaluated in leg:
            candidate = evaluated.candidate
            records.append({
                "candidate": {
                    name: getattr(candidate, name, None)
                    for name in CANDIDATE_FIELDS
                },
                "evaluation": {
                    name: getattr(evaluated, name, None)
                    for name in EVALUATION_FIELDS
                },
            })
    return records


def _evaluated_input_fingerprint(evaluated_legs) -> str:
    payload = json.dumps(
        _evaluated_input_records(evaluated_legs),
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    return sha256(payload.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class RunComparisonContext:
    run_id: str
    structured_request: dict[str, Any] | None
    evaluated_legs: Any
    candidate_ids: tuple[str, ...]
    feasible_candidate_ids: tuple[str, ...]
    evaluated_input_fingerprint: str
    fronts: dict[str, list[Solution]]
    runtimes_ms: dict[str, float | None]
    milp_references: dict[str, Solution]
    errors: dict[str, str] = field(default_factory=dict)
    algorithm_candidate_ids: dict[str, tuple[str, ...]] = field(default_factory=dict)
    input_verification_status: str = "verified"
    milp_reference_strategy: str = "pure_objective_solve"

    @classmethod
    def from_run(
        cls,
        *,
        run_id: str,
        structured_request: dict[str, Any] | None,
        evaluated_legs,
        fronts: dict[str, list[Solution]],
        runtimes_ms: dict[str, float | None],
        milp_references: dict[str, Solution],
        errors: dict[str, str] | None = None,
        algorithm_candidate_ids: dict[str, tuple[str, ...]] | None = None,
        input_verification_status: str = "verified",
        milp_reference_strategy: str = "pure_objective_solve",
    ) -> "RunComparisonContext":
        candidate_ids = _candidate_ids(evaluated_legs)
        if len(candidate_ids) != len(set(candidate_ids)):
            raise ValueError("Candidate IDs must be unique within an optimization run.")
        if input_verification_status == "verified":
            if algorithm_candidate_ids is None:
                raise ValueError("Per-algorithm candidate IDs are required for verified comparison input.")
            if set(algorithm_candidate_ids) != set(ALGORITHM_NAMES):
                raise ValueError("Candidate ID evidence is required for every comparison algorithm.")
            if any(tuple(ids) != candidate_ids for ids in algorithm_candidate_ids.values()):
                raise ValueError("All comparison algorithms must use the identical candidate IDs.")
        shared_ids = algorithm_candidate_ids or {}
        return cls(
            run_id=run_id,
            structured_request=structured_request,
            evaluated_legs=evaluated_legs,
            candidate_ids=candidate_ids,
            feasible_candidate_ids=_feasible_candidate_ids(evaluated_legs),
            evaluated_input_fingerprint=_evaluated_input_fingerprint(evaluated_legs),
            fronts=fronts,
            runtimes_ms=runtimes_ms,
            milp_references=milp_references,
            errors=errors or {},
            algorithm_candidate_ids=shared_ids,
            input_verification_status=input_verification_status,
            milp_reference_strategy=milp_reference_strategy,
        )


def register_comparison_context(context: RunComparisonContext) -> None:
    JM.set_comparison_context(context.run_id, context)


class ComparisonUnavailableError(RuntimeError):
    pass


def _load_archived_front(path: Path) -> list[Solution]:
    with path.open(newline="") as handle:
        return [
            Solution(
                selection=tuple(ast.literal_eval(row["selection"])),
                fuel=float(row["fuel"]),
                cost=float(row["cost"]),
                ghg=float(row["ghg"]),
                all_feasible=row["all_feasible"].strip().lower() == "true",
            )
            for row in csv.DictReader(handle)
        ]


def _load_archived_runtime_ms() -> dict[str, float | None]:
    path = REPO_ROOT / "algorithm_comparison.csv"
    if not path.exists():
        return {"MO-QIGA": None, "NSGA-II": None, "MILP": None}
    with path.open(newline="") as handle:
        rows = {row["algorithm"]: row for row in csv.DictReader(handle)}
    return {
        name: float(rows[name]["runtime_seconds"]) * 1000 if name in rows else None
        for name in ("MO-QIGA", "NSGA-II", "MILP")
    }


def _load_archived_evaluated_legs():
    """Load exact persisted evaluated inputs; never generate or reevaluate them."""
    from types import SimpleNamespace

    from candidate_schema import Candidate

    legs: dict[str, list[Any]] = {}
    with EVALUATED_MANIFEST_PATH.open(newline="") as handle:
        for row in csv.DictReader(handle):
            candidate = Candidate(
                candidate_id=row["candidate_id"],
                leg_id=row["leg_id"],
                vessel_class=row["vessel_class"],
                origin_port=row["origin_port"],
                dest_port=row["dest_port"],
                distance_nm=float(row["distance_nm"]),
                speed_knots=float(row["speed_knots"]),
                fuel_type=row["fuel_type"],
                cargo_tons=float(row["cargo_tons"]),
                telemetry_row_id=int(row["telemetry_row_id"]),
            )
            legs.setdefault(candidate.leg_id, []).append(SimpleNamespace(
                candidate=candidate,
                predicted_fuel_rate=float(row["predicted_fuel_rate"]),
                voyage_hours=float(row["voyage_hours"]),
                voyage_fuel=float(row["voyage_fuel"]),
                cost_usd=float(row["cost_usd"]),
                ghg_kgco2=float(row["ghg_kgco2"]),
                feasible=row["feasible"].strip().lower() == "true",
            ))
    return list(legs.values())


def _validated_reference_archive(
    archive: dict[str, Any], evaluated_legs
) -> dict[str, Any]:
    if archive.get("schema_version") != 1:
        raise ValueError("Archived MILP reference schema version is unsupported.")
    if archive.get("strategy") != "pure_objective_solve":
        raise ValueError("Archived MILP references must use pure_objective_solve.")
    references = archive.get("references")
    if not isinstance(references, dict) or set(references) != set(REFERENCE_WEIGHTS):
        raise ValueError("Archived MILP references must contain all three objective minima.")

    for name, expected_weights in REFERENCE_WEIGHTS.items():
        payload = references[name]
        if tuple(payload.get("weights", ())) != expected_weights:
            raise ValueError(f"Archived {name} weights do not match its pure-objective solve.")

    candidate_ids = _candidate_ids(evaluated_legs)
    if archive.get("candidate_fingerprint") != _fingerprint(candidate_ids):
        raise ValueError("Archived MILP references do not match the candidate ID manifest.")
    if archive.get("evaluated_input_fingerprint") != _evaluated_input_fingerprint(evaluated_legs):
        raise ValueError("Archived MILP references do not match the evaluated input manifest.")

    for name, payload in references.items():
        selection = tuple(payload.get("selection", ()))
        if len(selection) != len(evaluated_legs) or any(
            not isinstance(choice, int) or choice < 0 or choice >= len(evaluated_legs[index])
            for index, choice in enumerate(selection)
        ):
            raise ValueError(f"Archived {name} selection is invalid for the evaluated input manifest.")
        recalculated = evaluate_selection(evaluated_legs, selection)
        for objective in ("fuel", "cost", "ghg"):
            if not math.isclose(
                float(payload.get(objective, math.nan)),
                getattr(recalculated, objective),
                rel_tol=1e-12,
                abs_tol=1e-9,
            ):
                raise ValueError(f"Archived {name} {objective} does not match its stored selection.")
        if bool(payload.get("all_feasible")) != recalculated.all_feasible:
            raise ValueError(f"Archived {name} feasibility does not match its stored selection.")
    return references


def write_precomputed_comparison_artifacts(
    evaluated_legs,
    milp_references: dict[str, Solution],
    *,
    manifest_path: Path = EVALUATED_MANIFEST_PATH,
    reference_path: Path = MILP_REFERENCE_PATH,
) -> None:
    """Persist exact evaluated inputs and matching pure-objective MILP solves."""
    if set(milp_references) != set(REFERENCE_WEIGHTS):
        raise ValueError("All three pure-objective MILP references are required.")

    rows = []
    for record in _evaluated_input_records(evaluated_legs):
        row = {**record["candidate"], **record["evaluation"]}
        if any(row[name] is None for name in CANDIDATE_FIELDS + EVALUATION_FIELDS):
            raise ValueError("Evaluated candidate archive contains incomplete records.")
        rows.append(row)
    with manifest_path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=CANDIDATE_FIELDS + EVALUATION_FIELDS,
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(rows)

    archive = {
        "schema_version": 1,
        "strategy": "pure_objective_solve",
        "candidate_fingerprint": _fingerprint(_candidate_ids(evaluated_legs)),
        "evaluated_input_fingerprint": _evaluated_input_fingerprint(evaluated_legs),
        "references": {
            name: {
                "weights": list(REFERENCE_WEIGHTS[name]),
                "selection": list(solution.selection),
                "fuel": solution.fuel,
                "cost": solution.cost,
                "ghg": solution.ghg,
                "all_feasible": solution.all_feasible,
            }
            for name, solution in milp_references.items()
        },
    }
    _validated_reference_archive(archive, evaluated_legs)
    reference_path.write_text(json.dumps(archive, indent=2) + "\n")


def register_precomputed_comparison_context(primary_result: dict[str, Any]) -> None:
    """Register the checked-in baseline run from its original archived outputs."""
    mo_front = _load_archived_front(REPO_ROOT / "mo_qiga_pareto.csv")
    nsga_front = _load_archived_front(REPO_ROOT / "nsga2_pareto.csv")
    milp_front = _load_archived_front(REPO_ROOT / "milp_results.csv")
    evaluated_legs = _load_archived_evaluated_legs()
    with MILP_REFERENCE_PATH.open() as handle:
        reference_archive = json.load(handle)
    archived_references = _validated_reference_archive(reference_archive, evaluated_legs)
    references = {
        name: Solution(
            selection=tuple(payload["selection"]),
            fuel=float(payload["fuel"]),
            cost=float(payload["cost"]),
            ghg=float(payload["ghg"]),
            all_feasible=bool(payload["all_feasible"]),
        )
        for name, payload in archived_references.items()
    }
    register_comparison_context(RunComparisonContext.from_run(
        run_id=primary_result["run_id"],
        structured_request=primary_result.get("structured_request"),
        evaluated_legs=evaluated_legs,
        fronts={"MO-QIGA": mo_front, "NSGA-II": nsga_front, "MILP": milp_front},
        runtimes_ms=_load_archived_runtime_ms(),
        milp_references=references,
        algorithm_candidate_ids={},
        input_verification_status="unavailable_archived_run",
        milp_reference_strategy=reference_archive["strategy"],
    ))


def _serialize_solution(solution: Solution, algorithm: str, index: int) -> dict[str, Any]:
    return {
        "id": f"{algorithm.lower().replace(' ', '-').replace('/', '-')}-{index}",
        "algorithm": algorithm,
        "fuel": solution.fuel,
        "cost": solution.cost / 1_000_000,
        "cost_usd": solution.cost,
        "ghg": solution.ghg,
        "feasible": solution.all_feasible,
    }


def _objective_minima(front: list[Solution]) -> dict[str, float] | None:
    if not front:
        return None
    return {
        "fuel": min(solution.fuel for solution in front),
        "cost": min(solution.cost for solution in front),
        "ghg": min(solution.ghg for solution in front),
    }


def _gap_percent(value: float, reference: float) -> float | None:
    if reference == 0:
        return None
    return round((value - reference) / reference * 100, 6)


def _metric_space(context: RunComparisonContext):
    mo_front = context.fronts.get("MO-QIGA", [])
    nsga_front = context.fronts.get("NSGA-II", [])
    reference_solutions = list(context.milp_references.values())
    all_solutions = mo_front + nsga_front + reference_solutions
    if not all_solutions:
        return None
    points = np.array([solution.objectives for solution in all_solutions], dtype=float)
    lo = points.min(axis=0)
    hi = points.max(axis=0) * 1.1
    return lo, hi, np.ones(3)


def _algorithm_summary(
    context: RunComparisonContext,
    key: str,
    response_key: str,
    metric_space,
) -> dict[str, Any]:
    front = context.fronts.get(key, [])
    error = context.errors.get(key)
    base = {
        "status": "failed" if error or not front else "complete",
        "error": error or (None if front else f"No {key} results are stored for this run."),
        "runtime_ms": context.runtimes_ms.get(key),
        "feasible": bool(front) and all(solution.all_feasible for solution in front),
        "pareto_count": len(front),
        "objective_minima": _objective_minima(front),
        "hypervolume": None,
        "spread": None,
        "solutions": [
            _serialize_solution(solution, key, index)
            for index, solution in enumerate(front, start=1)
        ],
    }
    if front and metric_space is not None:
        lo, hi, reference = metric_space
        points = np.array([solution.objectives for solution in front], dtype=float)
        normalized = normalize(points, lo, hi)
        base["hypervolume"] = hypervolume_monte_carlo(
            normalized, reference, n_samples=HYPERVOLUME_SAMPLES, seed=0
        )
        base["spread"] = spacing_diversity(normalized)
    return base


def _milp_summary(context: RunComparisonContext) -> dict[str, Any]:
    error = context.errors.get("MILP")
    references = context.milp_references
    return {
        "status": "failed" if error or not references else "complete",
        "error": error or (None if references else "No MILP references are stored for this run."),
        "runtime_ms": context.runtimes_ms.get("MILP"),
        "feasible": bool(references) and all(solution.all_feasible for solution in references.values()),
        "pareto_count": None,
        "reference_strategy": context.milp_reference_strategy,
        "references": {
            name: _serialize_solution(solution, "MILP Reference", index)
            for index, (name, solution) in enumerate(references.items(), start=1)
        },
    }


def compare_algorithms(run_id: str) -> dict[str, Any]:
    context: RunComparisonContext | None = JM.get_comparison_context(run_id)
    if context is None:
        comparison_error = JM.get_comparison_error(run_id)
        if comparison_error is not None:
            raise ComparisonUnavailableError(comparison_error)
        raise KeyError(run_id)

    metric_space = _metric_space(context)
    mo_qiga = _algorithm_summary(context, "MO-QIGA", "mo_qiga", metric_space)
    nsga2 = _algorithm_summary(context, "NSGA-II", "nsga2", metric_space)
    milp = _milp_summary(context)

    milp_minima = {
        "fuel": context.milp_references.get("minimum_fuel").fuel
        if context.milp_references.get("minimum_fuel") else None,
        "cost": context.milp_references.get("minimum_cost").cost
        if context.milp_references.get("minimum_cost") else None,
        "ghg": context.milp_references.get("minimum_ghg").ghg
        if context.milp_references.get("minimum_ghg") else None,
    }

    def gaps(summary: dict[str, Any]) -> dict[str, float | None] | None:
        minima = summary["objective_minima"]
        if minima is None:
            return None
        return {
            objective: _gap_percent(minima[objective], reference)
            if reference is not None else None
            for objective, reference in milp_minima.items()
        }

    fingerprint = _fingerprint(context.candidate_ids)
    metric_context = {
        "normalization_min": metric_space[0].tolist() if metric_space else None,
        "normalization_max": metric_space[1].tolist() if metric_space else None,
        "hypervolume_reference_point": metric_space[2].tolist() if metric_space else None,
        "hypervolume_samples": HYPERVOLUME_SAMPLES,
    }
    return {
        "run_id": run_id,
        "structured_request": context.structured_request,
        "input_audit": {
            "candidate_count": len(context.candidate_ids),
            "feasible_candidate_count": len(context.feasible_candidate_ids),
            "candidate_ids": list(context.candidate_ids),
            "feasible_candidate_ids": list(context.feasible_candidate_ids),
            "candidate_fingerprint": fingerprint,
            "evaluated_input_fingerprint": context.evaluated_input_fingerprint,
            "verification_status": context.input_verification_status,
            "algorithm_candidate_fingerprints": {
                name: _fingerprint(tuple(candidate_ids))
                for name, candidate_ids in context.algorithm_candidate_ids.items()
            },
        },
        "metric_context": metric_context,
        "mo_qiga": mo_qiga,
        "nsga2": nsga2,
        "milp": milp,
        "comparison": {
            "gaps_percent": {
                "mo_qiga": gaps(mo_qiga),
                "nsga2": gaps(nsga2),
            }
        },
    }
