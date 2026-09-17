"""STAGE 14 -- End-to-end driver.

real/derived data -> candidate generation -> hard feasibility -> XGB fuel
prediction -> cost/GHG -> NSGA-II -> QUBO -> MO-QIGA -> MILP -> Pareto
archive -> comparison -> final outputs.

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
from objective_evaluator import ObjectiveEvaluator
from algo_common import group_by_leg, pareto_front
from nsga2_optimizer import NSGA2Optimizer
from mo_qiga import MOQIGAOptimizer
from qubo_model import QUBOModel
from qubo_builder import QUBOSolver
from milp_model import MILPModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("pipeline")


def generate_evaluated_legs(seed: int = 0):
    """STEPS 1-2: candidates -> feasibility + real XGB fuel model + SCENARIO_INPUT cost/GHG -> grouped by leg.

    Returns (evaluated, legs, reject_reasons) so callers (e.g. the NLP adapter)
    can filter `legs` before handing them to run_all_algorithms(), without
    duplicating this evaluation logic.
    """
    log.info("STEP 1/8: generating candidates from real/derived data layer")
    candidates = generate_candidates(seed=seed)
    log.info("  generated %d candidates", len(candidates))

    log.info("STEP 2/8: evaluating feasibility + real XGB fuel model + SCENARIO_INPUT cost/GHG")
    fleet = DL.load_fleet_classes()
    evaluator = ObjectiveEvaluator()
    evaluated = []
    reject_reasons: dict[str, int] = {}
    for c in candidates:
        ctx = DL.build_feasibility_context(c, fleet)
        ec = evaluator.evaluate(c, ctx)
        evaluated.append(ec)
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
    """STEPS 3-7: NSGA-II, QUBO-SA, MO-QIGA, MILP -> merged Pareto archive.

    `legs` is a list of list[EvaluatedCandidate] (one inner list per leg, as
    produced by generate_evaluated_legs()/group_by_leg()); callers may pass a
    filtered subset of the full leg/candidate set. Returns (final_front,
    final_sources, per_algorithm_fronts).
    """
    log.info("STEP 3/8: NSGA-II")
    t0 = time.time()
    nsga2_front, _ = NSGA2Optimizer(legs, population_size=40, generations=60, seed=0).run()
    log.info("  NSGA-II: %d Pareto solutions in %.2fs", len(nsga2_front), time.time() - t0)

    log.info("STEP 4/8: QUBO (simulated annealing, CLASSICAL -- no quantum hardware)")
    t0 = time.time()
    qubo_solutions = {}
    steps = np.linspace(0.1, 0.8, 4)
    for wf in steps:
        for wc in steps:
            wg = 1.0 - wf - wc
            if wg < 0.05:
                continue
            model = QUBOModel(legs, weights=(wf, wc, wg))
            sol = QUBOSolver(model, seed=0).solve(sweeps=1000, n_restarts=3)
            qubo_solutions[sol.selection] = sol
    qubo_front = pareto_front(list(qubo_solutions.values()))
    log.info("  QUBO: %d Pareto solutions in %.2fs", len(qubo_front), time.time() - t0)

    log.info("STEP 5/8: MO-QIGA (classical simulation of a quantum-inspired heuristic)")
    t0 = time.time()
    moqiga_front, _ = MOQIGAOptimizer(legs, population_size=30, generations=60, seed=0).run()
    log.info("  MO-QIGA: %d Pareto solutions in %.2fs", len(moqiga_front), time.time() - t0)

    log.info("STEP 6/8: MILP (exact reference)")
    t0 = time.time()
    milp_front = MILPModel(legs).trace_pareto_front(n_weight_samples=15)
    log.info("  MILP: %d Pareto solutions in %.2fs", len(milp_front), time.time() - t0)

    log.info("STEP 7/8: merging into one final Pareto archive")
    combined = nsga2_front + qubo_front + moqiga_front + milp_front
    sources = (["NSGA-II"] * len(nsga2_front) + ["QUBO-SA"] * len(qubo_front) +
               ["MO-QIGA"] * len(moqiga_front) + ["MILP"] * len(milp_front))
    final_front = pareto_front(combined)
    final_sources = [sources[combined.index(s)] for s in final_front]
    log.info("  final archive: %d non-dominated solutions (of %d candidates)", len(final_front), len(combined))
    for sol, src in zip(final_front, final_sources):
        log.info("    fuel=%.3f cost=%.1f ghg=%.1f source=%s selection=%s", sol.fuel, sol.cost, sol.ghg, src, sol.selection)

    per_algorithm_fronts = {
        "NSGA-II": nsga2_front, "QUBO-SA": qubo_front,
        "MO-QIGA": moqiga_front, "MILP": milp_front,
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

    log.info("STEP 8/8: writing final_pareto_fleet_plans.csv")
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
