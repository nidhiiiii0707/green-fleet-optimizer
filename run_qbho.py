"""Entry point. Run: python run_qbho.py

CLASSICAL Harris-Hawks-based metaheuristic with a quantum-behaved position
update -- no quantum hardware is used or claimed anywhere in this script or
qbho.py. Replaces run_qubo.py in the active algorithm set.
"""
from __future__ import annotations

import json
import time

import pandas as pd

from scenario_setup import build_evaluated_legs
from qbho import QBHOOptimizer


def main():
    legs, evaluated = build_evaluated_legs(seed=0)
    t0 = time.time()
    opt = QBHOOptimizer(legs, population_size=30, generations=60, seed=0)
    front, metrics = opt.run()
    runtime = time.time() - t0

    rows = [{"solution_id": i, "fuel": s.fuel, "cost": s.cost, "ghg": s.ghg,
             "all_feasible": s.all_feasible, "selection": json.dumps(s.selection)}
            for i, s in enumerate(front)]
    pd.DataFrame(rows).to_csv("qbho_pareto.csv", index=False)
    pd.DataFrame(metrics["history"]).to_csv("qbho_results.csv", index=False)

    print(f"QBHO (Quantum-Behaved Hawks Optimization, classical): {len(front)} Pareto solutions, "
          f"runtime={runtime:.2f}s")
    print("DISCLAIMER: quantum-behaved position update executed entirely on classical hardware.")


if __name__ == "__main__":
    main()
