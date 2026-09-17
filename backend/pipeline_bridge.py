"""Bridge between FastAPI and the existing optimization pipeline.

Strategy:
  - On startup, load the pre-computed final_pareto_fleet_plans.csv as the
    "latest result" so the UI is instant. Fresh runs are triggered on demand.
  - Uses generate_evaluated_legs() + run_all_algorithms() from run_optimization_pipeline.
"""
from __future__ import annotations

import sys
import logging
from pathlib import Path

from backend.data_adapter import build_runtime_result, load_precomputed_result

# Add the repo root to sys.path so we can import the optimizer modules
REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(REPO_ROOT))

log = logging.getLogger("pipeline_bridge")


def get_default_result() -> dict:
    """Return the real pre-computed Pareto archive used by the dashboard."""
    return load_precomputed_result()


def get_solution_by_id(solution_id: str) -> dict | None:
    for s in get_default_result()["pareto_solutions"]:
        if s["id"] == solution_id:
            return s
    return None


def run_optimization_async(job, seed: int = 42, progress_cb=None, request: dict | None = None):
    """Run the real optimization pipeline. Raises on failure (no silent
    fallback to static/mock data — the caller decides how to surface it).

    `request` (optional) is a structured request — the SAME shape produced by
    the manual form and by NLP parsing (see nlp/optimization_adapter.py's
    build_optimization_request) — {origin, destination, vessel_type,
    fuel_type, speed, cargo, objectives}. When present, it is used to filter
    the optimizer's real candidate legs via the existing
    nlp.optimization_adapter.filter_legs() (no second optimization pipeline:
    the same NSGA-II/QBHO/CQM/MILP/MO-QIGA run and the same result builder
    are used either way). Unspecified fields stay unrestricted.
    """
    import importlib
    try:
        run_pipeline = importlib.import_module("run_optimization_pipeline")
        generate_evaluated_legs = run_pipeline.generate_evaluated_legs
        run_all_algorithms = run_pipeline.run_all_algorithms

        if progress_cb:
            progress_cb(10, "Generating candidates from real data...")
        evaluated, legs, reject_reasons = generate_evaluated_legs(seed=seed)

        request_warnings: list[str] = []
        if request and any(request.get(key) for key in
                            ("origin", "destination", "vessel_type", "fuel_type", "speed", "cargo")):
            from nlp.optimization_adapter import filter_legs

            if progress_cb:
                progress_cb(20, "Applying structured request constraints...")
            legs, request_warnings = filter_legs(legs, request)
            if not legs or any(len(leg) == 0 for leg in legs):
                raise ValueError(
                    "No candidates satisfy the given request constraints "
                    "(every leg was rejected). Relax one of the fields and try again."
                )

        if progress_cb:
            progress_cb(30, "Running NSGA-II/QBHO/CQM/MILP/MO-QIGA optimizers...")
        final_front, final_sources, per_algo = run_all_algorithms(legs)

        if progress_cb:
            progress_cb(90, "Building Pareto archive...")

        result = build_runtime_result(final_front, final_sources, legs)
        if request is not None:
            result["structured_request"] = request
            result["request_warnings"] = request_warnings
        return result

    except ValueError:
        raise
    except Exception:
        log.exception("Real optimization pipeline failed")
        raise


def compute_scenario_result(controls: dict) -> dict:
    """Run the real optimization pipeline with scenario-modified inputs and
    compare the resulting selected solution against the real baseline
    (the precomputed Pareto archive), rather than estimating deltas with a
    formula. Raises ValueError (-> HTTP 400 at the router) if the scenario
    cannot be executed against the real optimizer.
    """
    import importlib

    overrides = {
        "demand_multiplier": controls.get("demand", 100) / 100,
        "fuel_price_multiplier": controls.get("fuel", 100) / 100,
        "ghg_limit_multiplier": controls.get("ghg", 100) / 100,
        "vessel_availability_multiplier": controls.get("vessels", 100) / 100,
        "port_capacity_multiplier": controls.get("portCap", 100) / 100,
    }
    if any(v <= 0 for v in overrides.values()):
        raise ValueError("Scenario controls must be positive percentages.")

    try:
        run_pipeline = importlib.import_module("run_optimization_pipeline")
        evaluated, legs, reject_reasons = run_pipeline.generate_evaluated_legs(seed=42, overrides=overrides)
        if not any(any(ec.feasible for ec in leg) for leg in legs):
            raise ValueError(
                "No feasible candidates remain under these scenario constraints "
                "(every leg was rejected by hard feasibility checks). Relax the scenario inputs."
            )
        final_front, final_sources, _ = run_pipeline.run_all_algorithms(legs)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(f"Scenario optimization run failed: {exc}") from exc

    scenario_result = build_runtime_result(final_front, final_sources, legs)
    scenario_selected = scenario_result["pareto_solutions"][0]

    baseline_result = load_precomputed_result()
    baseline_selected = baseline_result["pareto_solutions"][0]

    def pct_change(new: float, old: float) -> float | None:
        if not old:
            return None
        return round((new - old) / old * 100, 1)

    constraint_changes = []
    if overrides["ghg_limit_multiplier"] < 0.90:
        constraint_changes.append("GHG limit constraint tightened — legs exceeding the scenario GHG cap were marked infeasible.")
    if overrides["vessel_availability_multiplier"] < 0.90:
        constraint_changes.append("Reduced vessel availability removed lower-capacity vessel classes from the candidate pool.")
    if overrides["port_capacity_multiplier"] < 0.80:
        constraint_changes.append("Port capacity restriction reduced the number of routes evaluated.")
    if not constraint_changes:
        constraint_changes.append("No hard constraints were tightened beyond the baseline configuration.")
    if reject_reasons:
        constraint_changes.append(
            "Rejected candidates by reason: " + ", ".join(f"{k}={v}" for k, v in sorted(reject_reasons.items(), key=lambda kv: -kv[1]))
        )

    return {
        "fuelChange": pct_change(scenario_selected["fuel"], baseline_selected["fuel"]),
        "costChange": pct_change(scenario_selected["costUsd"], baseline_selected["costUsd"]),
        "ghgChange": pct_change(scenario_selected["ghg"], baseline_selected["ghg"]),
        "cargoFulfillment": scenario_selected["cargoFulfillment"],
        "scenarioFuel": scenario_selected["fuel"],
        "scenarioCost": scenario_selected["cost"],
        "scenarioGhg": scenario_selected["ghg"],
        "baselineFuel": baseline_selected["fuel"],
        "baselineCost": baseline_selected["cost"],
        "baselineGhg": baseline_selected["ghg"],
        "scenarioSolutionId": scenario_selected["id"],
        "constraintChanges": constraint_changes,
        "note": "Scenario outputs are from an actual re-run of the real optimizer (NSGA-II / QBHO / CQM / MILP / MO-QIGA) with these inputs mapped to real candidate-generation and feasibility parameters.",
    }
