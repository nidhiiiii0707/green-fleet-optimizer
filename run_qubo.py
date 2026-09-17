"""STAGE 9 entry point -- solve the QUBO by simulated annealing (classical,
no quantum hardware) across a small weight fan to also trace an approximate
Pareto front for Stage 12 comparison. Run: python run_qubo.py
"""
from __future__ import annotations

import json
import time

import numpy as np
import pandas as pd

from scenario_setup import build_evaluated_legs
from qubo_model import QUBOModel
from qubo_builder import QUBOSolver
from algo_common import pareto_front


def main():
    legs, evaluated = build_evaluated_legs(seed=0)
    t0 = time.time()
    solutions = {}
    steps = np.linspace(0.05, 0.9, 6)
    for wf in steps:
        for wc in steps:
            wg = 1.0 - wf - wc
            if wg < 0.05:
                continue
            model = QUBOModel(legs, weights=(wf, wc, wg))
            solver = QUBOSolver(model, seed=0)
            sol = solver.solve(sweeps=1500, n_restarts=4)
            solutions[sol.selection] = sol
    front = pareto_front(list(solutions.values()))
    runtime = time.time() - t0

    rows = [{"solution_id": i, "fuel": s.fuel, "cost": s.cost, "ghg": s.ghg,
             "all_feasible": s.all_feasible, "selection": json.dumps(s.selection)}
            for i, s in enumerate(front)]
    pd.DataFrame(rows).to_csv("qubo_results.csv", index=False)
    print(f"QUBO (simulated annealing, CLASSICAL -- no quantum hardware): "
          f"{len(front)} Pareto solutions from {len(solutions)} weight-fan solves, runtime={runtime:.2f}s")


if __name__ == "__main__":
    main()
