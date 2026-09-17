"""STAGE 9 -- Solve the QUBO in qubo_model.py by SIMULATED ANNEALING.

Explicitly classical: no D-Wave / quantum annealer access exists in this
environment. Simulated annealing over the same Q matrix a quantum annealer
would be given is the standard honest classical stand-in used to validate a
QUBO formulation before ever considering real quantum hardware.
"""
from __future__ import annotations

import random

import numpy as np

from algo_common import Solution
from qubo_model import QUBOModel


class QUBOSolver:
    def __init__(self, model: QUBOModel, seed: int | None = 0) -> None:
        self.model = model
        self.rng = random.Random(seed)

    def solve(self, sweeps: int = 4000, n_restarts: int = 8) -> Solution:
        n = len(self.model.variables)
        best_x, best_energy = None, float("inf")
        for _ in range(n_restarts):
            x = np.array([self.rng.randint(0, 1) for _ in range(n)], dtype=float)
            energy = self.model.energy(x)
            t0, t1 = 3.0, 0.01
            for step in range(sweeps):
                t = t0 * (t1 / t0) ** (step / max(sweeps - 1, 1))
                i = self.rng.randrange(n)
                x_new = x.copy()
                x_new[i] = 1.0 - x_new[i]
                new_energy = self.model.energy(x_new)
                delta = new_energy - energy
                if delta <= 0 or self.rng.random() < np.exp(-delta / t):
                    x, energy = x_new, new_energy
            if energy < best_energy:
                best_x, best_energy = x, energy
        return self._decode(best_x)

    def _decode(self, x: np.ndarray) -> Solution:
        legs = self.model.legs
        selection = [None] * len(legs)
        for leg_idx in range(len(legs)):
            members = [(k, opt) for k, (li, opt) in enumerate(self.model.variables) if li == leg_idx]
            chosen = [(k, opt) for k, opt in members if x[k] > 0.5]
            if len(chosen) == 1:
                _, opt = chosen[0]
            elif len(chosen) > 1:
                _, opt = min(chosen, key=lambda pair: (pair[1].voyage_fuel, pair[1].cost_usd, pair[1].ghg_kgco2))
            else:
                opt = min((o for _, o in members), key=lambda o: (o.voyage_fuel, o.cost_usd, o.ghg_kgco2))
            selection[leg_idx] = legs[leg_idx].index(opt)

        fuel = cost = ghg = 0.0
        for leg_idx, choice in enumerate(selection):
            opt = legs[leg_idx][choice]
            fuel += opt.voyage_fuel
            cost += opt.cost_usd
            ghg += opt.ghg_kgco2
        return Solution(tuple(selection), fuel, cost, ghg, all_feasible=True)
