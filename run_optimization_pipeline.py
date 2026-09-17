"""STAGE 14 -- End-to-end driver.

real/derived data -> candidate generation -> hard feasibility -> XGB fuel
prediction -> cost/GHG -> NSGA-II -> QBHO -> CQM -> MILP -> Pareto
archive -> comparison -> final outputs.

ACTIVE algorithm set (as of the QUBO-SA -> QBHO / MO-QIGA -> CQM migration):
NSGA-II, QBHO, CQM, MILP. QUBO-SA (qubo_model.py/qubo_builder.py) and
MO-QIGA (mo_qiga.py) are RETAINED in the repository for reference/backup
but are no longer invoked here -- see qbho.py and cqm_model.py/cqm_solver.py
docstrings for why they were replaced and what replaced them.

Run: python run_optimization_pipeline.py
"""
from __future__ import annotations

import json
import logging
import time

import numpy as np
import pandas as pd

import data_layer as DL
from candidate_generator import generate_candidates
from objective_evaluator import ObjectiveEvaluator, EvaluatedCandidate
from feasibility_checker import ConstraintResult, ConstraintStatus, FeasibilityReport
from algo_common import group_by_leg, pareto_front
from nsga2_optimizer import NSGA2Optimizer
from qbho import QBHOOptimizer
from cqm_model import CQMModel
from cqm_solver import CQMSolver
from milp_model import MILPModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("pipeline")


def generate_evaluated_legs(seed: int = 0, overrides: dict | None = None):
    """STEPS 1-2: candidates -> feasibility + real XGB fuel model + SCENARIO_INPUT cost/GHG -> grouped by leg.

    Returns (evaluated, legs, reject_reasons) so callers (e.g. the NLP adapter)
    can filter `legs` before handing them to run_all_algorithms(), without
    duplicating this evaluation logic.

    `overrides` (all optional, used by the Scenario Analysis feature to reach
    the real optimizer with modified inputs rather than a formula):
      - port_capacity_multiplier, vessel_availability_multiplier,
        demand_multiplier: forwarded to generate_candidates()
      - fuel_price_multiplier: forwarded to ObjectiveEvaluator (scales cost)
      - ghg_limit_multiplier: adds a real hard feasibility constraint capping
        each candidate's GHG at this fraction of the unconstrained median GHG
    """
    overrides = overrides or {}
    log.info("STEP 1/7: generating candidates from real/derived data layer")
    candidates = generate_candidates(seed=seed, overrides=overrides)
    log.info("  generated %d candidates", len(candidates))

    log.info("STEP 2/7: evaluating feasibility + real XGB fuel model + SCENARIO_INPUT cost/GHG")
    fleet = DL.load_fleet_classes()
    evaluator = ObjectiveEvaluator(fuel_price_multiplier=overrides.get("fuel_price_multiplier", 1.0))
    evaluated = []
    for c in candidates:
        ctx = DL.build_feasibility_context(c, fleet)
        ec = evaluator.evaluate(c, ctx)
        evaluated.append(ec)

    ghg_limit_mult = overrides.get("ghg_limit_multiplier", 1.0)
    if ghg_limit_mult < 1.0 and evaluated:
        median_ghg = sorted(e.ghg_kgco2 for e in evaluated)[len(evaluated) // 2]
        limit = median_ghg * ghg_limit_mult
        rebuilt = []
        for e in evaluated:
            if e.ghg_kgco2 <= limit:
                rebuilt.append(e)
                continue
            extra = ConstraintResult(
                name="scenario_ghg_limit", status=ConstraintStatus.FAILED,
                reason=f"ghg_kgco2={e.ghg_kgco2:.1f} exceeds scenario limit={limit:.1f} ({ghg_limit_mult:.0%} of median)",
            )
            report = FeasibilityReport(results=e.feasibility_report.results + (extra,))
            rebuilt.append(EvaluatedCandidate(
                candidate=e.candidate, predicted_fuel_rate=e.predicted_fuel_rate,
                voyage_hours=e.voyage_hours, voyage_fuel=e.voyage_fuel,
                cost_usd=e.cost_usd, ghg_kgco2=e.ghg_kgco2,
                feasible=report.is_usable, feasibility_report=report,
            ))
        evaluated = rebuilt

    reject_reasons: dict[str, int] = {}
    for ec in evaluated:
        if not ec.feasible:
            for r in ec.feasibility_report.results:
                if r.status.value == "failed":
                    reject_reasons[r.name] = reject_reasons.get(r.name, 0) + 1
    feasible = [e for e in evaluated if e.feasible]
    log.info("  candidates=%d feasible=%d rejected=%d", len(evaluated), len(feasible), len(evaluated) - len(feasible))
    for reason, count in sorted(reject_reasons.items(), key=lambda kv: -kv[1]):
        log.info("    rejected for %s: %d", reason, count)

    fuel_vals = [e.voyage_fuel for e in evaluated]
    cost_vals = [e.cost_usd for e in evaluated]
    ghg_vals = [e.ghg_kgco2 for e in evaluated]
    log.info("  objective ranges: fuel=[%.3f,%.3f] cost=[%.1f,%.1f] ghg=[%.1f,%.1f]",
              min(fuel_vals), max(fuel_vals), min(cost_vals), max(cost_vals), min(ghg_vals), max(ghg_vals))

    legs = group_by_leg(evaluated)
    log.info("  grouped into %d legs", len(legs))
    return evaluated, legs, reject_reasons


def run_all_algorithms(legs):
    """STEPS 3-6: NSGA-II, QBHO, CQM, MILP -> merged Pareto archive.

    `legs` is a list of list[EvaluatedCandidate] (one inner list per leg, as
    produced by generate_evaluated_legs()/group_by_leg()); callers may pass a
    filtered subset of the full leg/candidate set. Returns (final_front,
    final_sources, per_algorithm_fronts).

    QUBO-SA and MO-QIGA are RETAINED in the repository (qubo_model.py /
    qubo_builder.py / mo_qiga.py) but are no longer part of the active set;
    they were replaced by QBHO and CQM respectively (see qbho.py and
    cqm_model.py/cqm_solver.py for why and how).
    """
    log.info("STEP 3/7: NSGA-II")
    t0 = time.time()
    nsga2_front, _ = NSGA2Optimizer(legs, population_size=40, generations=60, seed=0).run()
    log.info("  NSGA-II: %d Pareto solutions in %.2fs", len(nsga2_front), time.time() - t0)

    log.info("STEP 4/7: QBHO (Quantum-Behaved Hawks Optimization, CLASSICAL -- no quantum hardware)")
    t0 = time.time()
    qbho_front, _ = QBHOOptimizer(legs, population_size=30, generations=60, seed=0).run()
    log.info("  QBHO: %d Pareto solutions in %.2fs", len(qbho_front), time.time() - t0)

    log.info("STEP 5/7: CQM (Constrained Quadratic Model, CLASSICAL solve -- no quantum hardware)")
    t0 = time.time()
    cqm_solutions = {}
    steps = np.linspace(0.1, 0.8, 4)
    for wf in steps:
        for wc in steps:
            wg = 1.0 - wf - wc
            if wg < 0.05:
                continue
            model = CQMModel(legs, weights=(wf, wc, wg))
            sol = CQMSolver(model, seed=0).solve(sweeps=1000, n_restarts=3)
            cqm_solutions[sol.selection] = sol
    cqm_front = pareto_front(list(cqm_solutions.values()))
    log.info("  CQM: %d Pareto solutions in %.2fs", len(cqm_front), time.time() - t0)

    log.info("STEP 6/7: MILP (exact reference)")
    t0 = time.time()
    milp_front = MILPModel(legs).trace_pareto_front(n_weight_samples=15)
    log.info("  MILP: %d Pareto solutions in %.2fs", len(milp_front), time.time() - t0)

    log.info("merging into one final Pareto archive")
    combined = nsga2_front + qbho_front + cqm_front + milp_front
    sources = (["NSGA-II"] * len(nsga2_front) + ["QBHO"] * len(qbho_front) +
               ["CQM"] * len(cqm_front) + ["MILP"] * len(milp_front))
    final_front = pareto_front(combined)
    final_sources = [sources[combined.index(s)] for s in final_front]
    log.info("  final archive: %d non-dominated solutions (of %d candidates)", len(final_front), len(combined))
    for sol, src in zip(final_front, final_sources):
        log.info("    fuel=%.3f cost=%.1f ghg=%.1f source=%s selection=%s", sol.fuel, sol.cost, sol.ghg, src, sol.selection)

    per_algorithm_fronts = {
        "NSGA-II": nsga2_front, "QBHO": qbho_front,
        "CQM": cqm_front, "MILP": milp_front,
    }
    return final_front, final_sources, per_algorithm_fronts


def main():
    t_start = time.time()

    evaluated, legs, reject_reasons = generate_evaluated_legs(seed=0)
    feasible = [e for e in evaluated if e.feasible]
    fuel_vals = [e.voyage_fuel for e in evaluated]
    cost_vals = [e.cost_usd for e in evaluated]
    ghg_vals = [e.ghg_kgco2 for e in evaluated]

    final_front, final_sources, per_algorithm_fronts = run_all_algorithms(legs)

    log.info("STEP 7/7: writing final_pareto_fleet_plans.csv")
    rows = []
    for sol, src in zip(final_front, final_sources):
        for leg_idx, choice in enumerate(sol.selection):
            ec = legs[leg_idx][choice]
            c = ec.candidate
            rows.append({
                "solution_id": f"{src}-{sol.selection}",
                "algorithm_source": src,
                "leg": c.leg_id,
                "vessel_class": c.vessel_class,
                "origin": c.origin_port,
                "destination": c.dest_port,
                "cargo_tons": c.cargo_tons,
                "speed_knots": c.speed_knots,
                "fuel_type": c.fuel_type,
                "predicted_fuel_rate": ec.predicted_fuel_rate,
                "voyage_fuel_ASSUMED_UNIT": ec.voyage_fuel,
                "cost_usd_SCENARIO_INPUT": ec.cost_usd,
                "ghg_kgco2_SCENARIO_INPUT": ec.ghg_kgco2,
                "feasible": ec.feasible,
                "constraint_summary": "; ".join(ec.feasibility_report.reasons()),
                "solution_total_fuel": sol.fuel,
                "solution_total_cost": sol.cost,
                "solution_total_ghg": sol.ghg,
            })
    pd.DataFrame(rows).to_csv("final_pareto_fleet_plans.csv", index=False)

    runtime = time.time() - t_start
    log.info("PIPELINE COMPLETE in %.2fs", runtime)

    summary = {
        "candidates_generated": len(evaluated),
        "feasible_count": len(feasible),
        "rejected_count": len(evaluated) - len(feasible),
        "rejected_reasons": reject_reasons,
        "objective_ranges": {
            "fuel": [min(fuel_vals), max(fuel_vals)],
            "cost": [min(cost_vals), max(cost_vals)],
            "ghg": [min(ghg_vals), max(ghg_vals)],
        },
        "algorithm_pareto_sizes": {name: len(front) for name, front in per_algorithm_fronts.items()},
        "final_pareto_archive_size": len(final_front),
        "total_runtime_seconds": runtime,
    }
    with open("run_optimization_pipeline_summary.json", "w") as fh:
        json.dump(summary, fh, indent=2)
    log.info("Summary written to run_optimization_pipeline_summary.json")


if __name__ == "__main__":
    main()
