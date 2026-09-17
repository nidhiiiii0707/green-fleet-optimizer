"""STAGE 8 entry point. Run: python run_nsga2.py"""
from __future__ import annotations

import json
import time

import numpy as np
import pandas as pd

from scenario_setup import build_evaluated_legs
from nsga2_optimizer import NSGA2Optimizer
from metrics_utils import hypervolume_monte_carlo, normalize, spacing_diversity


def main():
    legs, evaluated = build_evaluated_legs(seed=0)
    t0 = time.time()
    opt = NSGA2Optimizer(legs, population_size=40, generations=60, seed=0)
    front, run_metrics = opt.run()
    runtime = time.time() - t0

    rows = []
    for i, sol in enumerate(front):
        rows.append({
            "solution_id": i, "fuel": sol.fuel, "cost": sol.cost, "ghg": sol.ghg,
            "all_feasible": sol.all_feasible, "selection": json.dumps(sol.selection),
        })
    pareto_df = pd.DataFrame(rows)
    pareto_df.to_csv("nsga2_pareto.csv", index=False)

    all_rows = []
    all_pop_pts = []
    for gen_entry in run_metrics["history"]:
        all_rows.append(gen_entry)
    pd.DataFrame(all_rows).to_csv("nsga2_results.csv", index=False)

    feasible_ratio = sum(1 for s in front if s.all_feasible) / len(front) if front else 0.0

    points = np.array([sol.objectives for sol in front]) if front else np.zeros((0, 3))
    metrics = {
        "algorithm": "NSGA-II",
        "runtime_seconds": runtime,
        "generations": run_metrics["generations"],
        "population_size": run_metrics["population_size"],
        "pareto_front_size": len(front),
        "feasible_ratio": feasible_ratio,
        "diversity_spacing_std": spacing_diversity(points) if len(points) > 1 else None,
        "objective_ranges": {
            "fuel": [float(points[:, 0].min()), float(points[:, 0].max())] if len(points) else None,
            "cost": [float(points[:, 1].min()), float(points[:, 1].max())] if len(points) else None,
            "ghg": [float(points[:, 2].min()), float(points[:, 2].max())] if len(points) else None,
        },
        "hypervolume": None,  # computed comparably across algorithms in Stage 12 (algorithm_comparison)
        "igd": None,          # requires a shared reference front; computed in Stage 12
        "note": "Hypervolume/IGD are computed jointly across NSGA-II/QBHO/CQM/MILP in "
                "algorithm_comparison.csv (Stage 12) so they share one reference point/front; "
                "left null here to avoid a misleading single-algorithm reference.",
    }
    with open("nsga2_metrics.json", "w") as fh:
        json.dump(metrics, fh, indent=2)

    print(f"NSGA-II: {len(front)} Pareto solutions, runtime={runtime:.2f}s, feasible_ratio={feasible_ratio:.2f}")


if __name__ == "__main__":
    main()
