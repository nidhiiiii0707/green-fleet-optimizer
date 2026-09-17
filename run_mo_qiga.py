"""STAGE 10 entry point. Run: python run_mo_qiga.py

CLASSICAL SIMULATION of a quantum-inspired heuristic -- no quantum hardware
is used or claimed anywhere in this script or mo_qiga.py.
"""
from __future__ import annotations

import json
import time

import pandas as pd

from scenario_setup import build_evaluated_legs
from mo_qiga import MOQIGAOptimizer


def main():
    legs, evaluated = build_evaluated_legs(seed=0)
    t0 = time.time()
    opt = MOQIGAOptimizer(legs, population_size=30, generations=60, seed=0)
    front, metrics = opt.run()
    runtime = time.time() - t0

    rows = [{"solution_id": i, "fuel": s.fuel, "cost": s.cost, "ghg": s.ghg,
             "all_feasible": s.all_feasible, "selection": json.dumps(s.selection)}
            for i, s in enumerate(front)]
    pd.DataFrame(rows).to_csv("mo_qiga_pareto.csv", index=False)
    pd.DataFrame(metrics["history"]).to_csv("mo_qiga_results.csv", index=False)

    print(f"MO-QIGA (classical simulation): {len(front)} Pareto solutions, runtime={runtime:.2f}s")
    print("DISCLAIMER: quantum-inspired heuristic executed entirely on classical hardware.")


if __name__ == "__main__":
    main()
