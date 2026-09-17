"""STAGE 9 -- QUBO MATHEMATICAL FORMULATION of the per-leg selection problem.

IMPORTANT: this is a mathematical formulation (min x^T Q x over binary x)
solved CLASSICALLY in qubo_builder.py (simulated annealing / brute force on
this small instance). No quantum annealing hardware is available or used
anywhere in this pipeline. This is the standard, honest way to describe a
QUBO before handing it to any solver, quantum or classical.

Binary variables x[leg, option] for every FEASIBLE option only. One-hot-per-
leg is enforced with a quadratic penalty (sum_i x_i - 1)^2 term expanded into
the Q matrix, exactly how one-hot constraints are embedded for real
annealers.
"""
from __future__ import annotations

import numpy as np

from objective_evaluator import EvaluatedCandidate


class QUBOModel:
    def __init__(self, legs: list[list[EvaluatedCandidate]],
                 weights: tuple[float, float, float] = (1.0, 1.0, 1.0),
                 penalty: float | None = None) -> None:
        self.legs = legs
        self.variables: list[tuple[int, EvaluatedCandidate]] = [
            (leg_idx, opt) for leg_idx, opts in enumerate(legs) for opt in opts if opt.feasible
        ]
        if not self.variables:
            raise ValueError("No feasible options available for any leg; cannot build a QUBO")

        wf, wc, wg = weights
        raw = np.array([
            wf * opt.voyage_fuel + wc * opt.cost_usd + wg * opt.ghg_kgco2
            for _, opt in self.variables
        ])
        span = (raw.max() - raw.min()) or 1.0
        self.linear_cost = (raw - raw.min()) / span
        self.penalty = penalty if penalty is not None else 4.0

        n = len(self.variables)
        Q = np.zeros((n, n))
        for i in range(n):
            Q[i, i] += self.linear_cost[i] - self.penalty  # from (sum x -1)^2 expansion: -2*penalty*1*x_i + penalty*x_i^2 (x_i^2=x_i)
        for leg_idx in range(len(legs)):
            members = [k for k, (li, _) in enumerate(self.variables) if li == leg_idx]
            for a in range(len(members)):
                for b in range(a + 1, len(members)):
                    i, j = members[a], members[b]
                    Q[i, j] += self.penalty
                    Q[j, i] += self.penalty
        self.Q = Q

    def energy(self, x: np.ndarray) -> float:
        return float(x @ self.Q @ x)
