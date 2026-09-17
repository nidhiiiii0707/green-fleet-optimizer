"""STAGE 11 -- Exact MILP reference solve via scipy.optimize.milp.

Variables: binary x[leg, option] for every FEASIBLE option (infeasible
options are dropped outright -- an exact MILP has no need for a penalty
term). Constraint: exactly one option per leg. Each option's fuel/cost/GHG
came from one real call to the trained XGB pipeline (objective_evaluator.py);
only the scalarization weights used to trace an approximate Pareto front are
a modelling choice (scipy's milp() only supports one linear objective).
"""
from __future__ import annotations

import numpy as np
from scipy.optimize import LinearConstraint, milp

from algo_common import Solution
from objective_evaluator import EvaluatedCandidate


class MILPModel:
    def __init__(self, legs: list[list[EvaluatedCandidate]]) -> None:
        self.legs = legs
        self.variables: list[tuple[int, EvaluatedCandidate]] = [
            (leg_idx, opt) for leg_idx, opts in enumerate(legs) for opt in opts if opt.feasible
        ]
        if not self.variables:
            raise ValueError("No feasible options for any leg; cannot build a MILP")

        n = len(self.variables)
        self.fuel = np.array([o.voyage_fuel for _, o in self.variables])
        self.cost = np.array([o.cost_usd for _, o in self.variables])
        self.ghg = np.array([o.ghg_kgco2 for _, o in self.variables])

        rows = []
        for leg_idx in range(len(legs)):
            row = np.zeros(n)
            for k, (li, _) in enumerate(self.variables):
                if li == leg_idx:
                    row[k] = 1.0
            rows.append(row)
        self.A = np.array(rows)
        self.constraint = LinearConstraint(self.A, lb=1.0, ub=1.0)

    def solve(self, weights: tuple[float, float, float]) -> Solution:
        wf, wc, wg = weights
        objective = wf * self.fuel + wc * self.cost + wg * self.ghg
        result = milp(c=objective, constraints=[self.constraint],
                       integrality=np.ones_like(objective), bounds=(0, 1))
        if not result.success:
            raise RuntimeError(f"MILP solve failed: {result.message}")
        chosen = np.round(result.x).astype(bool)
        selection = [0] * len(self.legs)
        for picked, (leg_idx, opt) in zip(chosen, self.variables):
            if picked:
                selection[leg_idx] = self.legs[leg_idx].index(opt)
        return Solution(tuple(selection), float(self.fuel[chosen].sum()),
                         float(self.cost[chosen].sum()), float(self.ghg[chosen].sum()), all_feasible=True)

    def trace_pareto_front(self, n_weight_samples: int = 15) -> list[Solution]:
        solutions: dict[tuple[int, ...], Solution] = {}
        steps = np.linspace(0.02, 0.96, n_weight_samples)
        for wf in steps:
            for wc in steps:
                wg = 1.0 - wf - wc
                if wg < 0.02:
                    continue
                sol = self.solve((wf, wc, wg))
                solutions[sol.selection] = sol
        return list(solutions.values())
