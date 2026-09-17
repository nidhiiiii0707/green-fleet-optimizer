"""Entry point -- solve the CQM classically (dimod ConstrainedQuadraticModel,
exact solve for small instances / classical constrained annealing at
realistic scale, no quantum hardware) across a small weight fan to also
trace an approximate Pareto front for Stage 12 comparison.
Replaces run_qubo.py in the active algorithm set. Run: python run_cqm.py
"""
from __future__ import annotations

import json
import time

import numpy as np
import pandas as pd

from scenario_setup import build_evaluated_legs
from cqm_model import CQMModel
from cqm_solver import CQMSolver
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
            model = CQMModel(legs, weights=(wf, wc, wg))
            solver = CQMSolver(model, seed=0)
            sol = solver.solve(sweeps=1500, n_restarts=4)
            solutions[sol.selection] = sol
    front = pareto_front(list(solutions.values()))
    runtime = time.time() - t0

    rows = [{"solution_id": i, "fuel": s.fuel, "cost": s.cost, "ghg": s.ghg,
             "all_feasible": s.all_feasible, "selection": json.dumps(s.selection)}
            for i, s in enumerate(front)]
    pd.DataFrame(rows).to_csv("cqm_results.csv", index=False)
    print(f"CQM (Constrained Quadratic Model, CLASSICAL solve -- no quantum hardware): "
          f"{len(front)} Pareto solutions from {len(solutions)} weight-fan solves, runtime={runtime:.2f}s")


if __name__ == "__main__":
    main()
