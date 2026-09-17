"""STAGE 12 -- Common evaluator comparing NSGA-II, MO-QIGA, QUBO(SA), MILP on
identical candidates/objectives/seed. Requires run_nsga2.py, run_mo_qiga.py,
run_qubo.py, run_milp.py to have been run first (produces their *_pareto.csv
/ *_results.csv). Run: python algorithm_comparison.py
"""
from __future__ import annotations

import json
import time

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from scenario_setup import build_evaluated_legs
from nsga2_optimizer import NSGA2Optimizer
from mo_qiga import MOQIGAOptimizer
from qubo_model import QUBOModel
from qubo_builder import QUBOSolver
from milp_model import MILPModel
from algo_common import pareto_front
from metrics_utils import hypervolume_monte_carlo, igd, spacing_diversity, normalize

PLOTS_DIR = "comparison_plots"


def run_all(legs):
    results = {}

    t0 = time.time()
    front, _ = NSGA2Optimizer(legs, population_size=40, generations=60, seed=0).run()
    results["NSGA-II"] = {"front": front, "runtime": time.time() - t0}

    t0 = time.time()
    front, _ = MOQIGAOptimizer(legs, population_size=30, generations=60, seed=0).run()
    results["MO-QIGA"] = {"front": front, "runtime": time.time() - t0}

    t0 = time.time()
    solutions = {}
    steps = np.linspace(0.05, 0.9, 6)
    for wf in steps:
        for wc in steps:
            wg = 1.0 - wf - wc
            if wg < 0.05:
                continue
            model = QUBOModel(legs, weights=(wf, wc, wg))
            sol = QUBOSolver(model, seed=0).solve(sweeps=1500, n_restarts=4)
            solutions[sol.selection] = sol
    results["QUBO-SA"] = {"front": pareto_front(list(solutions.values())), "runtime": time.time() - t0}

    t0 = time.time()
    milp_model = MILPModel(legs)
    front = milp_model.trace_pareto_front(n_weight_samples=15)
    results["MILP"] = {"front": front, "runtime": time.time() - t0}

    return results


def main():
    legs, evaluated = build_evaluated_legs(seed=0)
    results = run_all(legs)

    all_points = np.concatenate([np.array([s.objectives for s in r["front"]]) for r in results.values() if r["front"]])
    lo = all_points.min(axis=0)
    hi = all_points.max(axis=0) * 1.1  # margin so points don't sit exactly on the reference boundary
    ref = np.ones(3)  # after normalization, worst corner is (1,1,1)

    reference_front_points = normalize(all_points, lo, hi)  # union-of-all-fronts proxy for the unknown true front

    rows = []
    for name, r in results.items():
        pts = np.array([s.objectives for s in r["front"]]) if r["front"] else np.zeros((0, 3))
        norm_pts = normalize(pts, lo, hi) if len(pts) else pts
        hv = hypervolume_monte_carlo(norm_pts, ref, n_samples=200_000, seed=0) if len(norm_pts) else 0.0
        igd_val = igd(norm_pts, reference_front_points) if len(norm_pts) else None
        diversity = spacing_diversity(norm_pts) if len(norm_pts) > 1 else None
        feasible_ratio = (sum(1 for s in r["front"] if s.all_feasible) / len(r["front"])) if r["front"] else 0.0
        rows.append({
            "algorithm": name,
            "pareto_front_size": len(r["front"]),
            "runtime_seconds": r["runtime"],
            "hypervolume_normalized": hv,
            "igd_vs_union_front": igd_val,
            "diversity_spacing_std": diversity,
            "feasible_ratio": feasible_ratio,
            "best_fuel": min((s.fuel for s in r["front"]), default=None),
            "best_cost": min((s.cost for s in r["front"]), default=None),
            "best_ghg": min((s.ghg for s in r["front"]), default=None),
        })
    df = pd.DataFrame(rows)
    df.to_csv("algorithm_comparison.csv", index=False)

    with open("algorithm_comparison.md", "w") as fh:
        fh.write("# Algorithm Comparison (Stage 12)\n\n")
        fh.write("Same 252-candidate / 6-leg prototype scenario, same seed (0), same real XGB "
                 "fuel model, same SCENARIO_INPUT cost/GHG parameters for all four algorithms.\n\n")
        fh.write("**IGD** is computed against the union of all four fronts (the best available "
                 "approximation), NOT a verified true Pareto front -- none is known for this problem.\n\n")
        fh.write("**Hypervolume** is Monte-Carlo estimated (200,000 samples, seed 0) in "
                 "normalized objective space against a shared reference point.\n\n")
        fh.write("**QUBO and MO-QIGA are classical computations** (simulated annealing / a "
                 "classical simulation of a quantum-inspired heuristic respectively) -- no "
                 "quantum hardware is used anywhere in this comparison.\n\n")
        fh.write(df.to_markdown(index=False))
        fh.write("\n\n## Caveat\n\nCost and GHG values above are SCENARIO_INPUT-dependent "
                 "(fuel price, emission factor, and the fuel-rate-to-voyage-total sampling-"
                 "interval assumption are all SCENARIO_INPUT). They are valid for RELATIVE "
                 "comparison between algorithms under one fixed assumption set, not verified "
                 "real-world magnitudes.\n")

    import os
    os.makedirs(PLOTS_DIR, exist_ok=True)

    fig, ax = plt.subplots(figsize=(7, 6))
    markers = {"NSGA-II": "o", "MO-QIGA": "^", "QUBO-SA": "s", "MILP": "*"}
    for name, r in results.items():
        pts = np.array([s.objectives for s in r["front"]]) if r["front"] else np.zeros((0, 3))
        if len(pts):
            ax.scatter(pts[:, 0], pts[:, 1], label=name, marker=markers.get(name, "o"), s=60, alpha=0.8)
    ax.set_xlabel("Fuel (ASSUMED_UNIT)")
    ax.set_ylabel("Cost (USD, SCENARIO_INPUT price)")
    ax.set_title("Pareto fronts: Fuel vs Cost")
    ax.legend()
    fig.tight_layout()
    fig.savefig(f"{PLOTS_DIR}/pareto_fuel_vs_cost.png", dpi=130)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 6))
    for name, r in results.items():
        pts = np.array([s.objectives for s in r["front"]]) if r["front"] else np.zeros((0, 3))
        if len(pts):
            ax.scatter(pts[:, 0], pts[:, 2], label=name, marker=markers.get(name, "o"), s=60, alpha=0.8)
    ax.set_xlabel("Fuel (ASSUMED_UNIT)")
    ax.set_ylabel("GHG (kgCO2, SCENARIO_INPUT factor)")
    ax.set_title("Pareto fronts: Fuel vs GHG")
    ax.legend()
    fig.tight_layout()
    fig.savefig(f"{PLOTS_DIR}/pareto_fuel_vs_ghg.png", dpi=130)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 5))
    ax.bar(df["algorithm"], df["runtime_seconds"])
    ax.set_ylabel("Runtime (s)")
    ax.set_title("Runtime by algorithm (same scenario, same seed)")
    fig.tight_layout()
    fig.savefig(f"{PLOTS_DIR}/runtime_bars.png", dpi=130)
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(7, 5))
    ax.bar(df["algorithm"], df["hypervolume_normalized"])
    ax.set_ylabel("Hypervolume (normalized, Monte-Carlo)")
    ax.set_title("Hypervolume by algorithm")
    fig.tight_layout()
    fig.savefig(f"{PLOTS_DIR}/hypervolume_bars.png", dpi=130)
    plt.close(fig)

    print(df.to_string(index=False))
    print(f"\nWrote algorithm_comparison.csv, algorithm_comparison.md, {PLOTS_DIR}/*.png")


if __name__ == "__main__":
    main()
