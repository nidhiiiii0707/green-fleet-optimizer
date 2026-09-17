"""Quantum-Behaved Hawks Optimization (QBHO) -- replaces QUBO-SA in the
active algorithm set.

**This is a classical metaheuristic. It does NOT run on, or claim to run
on, quantum hardware.** "Quantum-behaved" refers to a well-known family of
position-update rules (originating with Quantum-behaved Particle Swarm
Optimization, Sun et al. 2004) in which an agent's next position is drawn
from a quantum potential-well distribution centred on a mean-best position
rather than moved by a classical velocity vector. QBHO grafts that update
rule onto Harris Hawks Optimization (Heidari et al., 2019): the base
algorithm keeps HHO's escaping-energy schedule and its four
exploration/exploitation regimes, but the two "rapid dive" exploitation
regimes (which HHO normally drives with a Levy flight) are replaced here
with the quantum potential-well draw, which is the standard way this
"quantum-behaved" variant is described in the swarm-intelligence
literature.

Search representation: exactly the same per-leg option grid as every other
optimizer in this repo (algo_common.py). Each hawk's position is a
continuous vector with one coordinate per leg; that coordinate is decoded
to a discrete option index for the leg by clamping to the leg's option
count and flooring (`_decode`), then evaluated with the SAME real
Fuel/Cost/GHG values as NSGA-II/CQM/MILP (objective_evaluator.py /
algo_common.py). A non-dominated archive across generations (identical
role to MO-QIGA's archive) supplies the "rabbit" (prey) position guide
because this is a multi-objective search, not the single-objective search
HHO was originally described for.
"""
from __future__ import annotations

import math
import random

import numpy as np

from algo_common import Solution, evaluate_selection, pareto_front
from objective_evaluator import EvaluatedCandidate


class QBHOOptimizer:
    def __init__(self, legs: list[list[EvaluatedCandidate]], population_size: int = 30,
                 generations: int = 60, seed: int | None = 0) -> None:
        self.legs = legs
        self.n_legs = len(legs)
        self.bounds = np.array([max(len(opts), 1) for opts in legs], dtype=float)
        self.population_size = population_size
        self.generations = generations
        self.rng = random.Random(seed)
        self.np_rng = np.random.default_rng(seed)
        self.positions = self.np_rng.uniform(0.0, self.bounds, size=(population_size, self.n_legs))

    def _decode(self, position: np.ndarray) -> tuple[int, ...]:
        clipped = np.clip(position, 0.0, self.bounds - 1e-9)
        return tuple(int(v) for v in np.floor(clipped))

    def _embed(self, selection: tuple[int, ...]) -> np.ndarray:
        return np.array([choice + 0.5 for choice in selection], dtype=float)

    def run(self) -> tuple[list[Solution], dict]:
        archive: list[Solution] = []
        history = []
        T = self.generations

        for t in range(T):
            selections = [self._decode(self.positions[i]) for i in range(self.population_size)]
            solutions = [evaluate_selection(self.legs, s) for s in selections]
            archive = pareto_front(archive + solutions)
            if len(archive) > 25:
                archive = self.rng.sample(archive, 25)

            mbest = np.mean([self._embed(sol.selection) for sol in archive], axis=0)
            mean_pos = self.positions.mean(axis=0)
            E1 = 2.0 * (1.0 - t / max(T, 1))
            beta = 0.5 + 0.5 * (1.0 - t / max(T, 1))  # quantum contraction-expansion coefficient: 1.0 -> 0.5

            for i in range(self.population_size):
                rabbit = self._embed(self.rng.choice(archive).selection)
                E0 = 2.0 * self.np_rng.random() - 1.0
                E = E1 * E0
                q = self.np_rng.random()
                x = self.positions[i]

                if abs(E) >= 1.0:
                    if q >= 0.5:
                        j = self.rng.randrange(self.population_size)
                        x_rand = self.positions[j]
                        r1, r2 = self.np_rng.random(), self.np_rng.random()
                        new_x = x_rand - r1 * np.abs(x_rand - 2.0 * r2 * x)
                    else:
                        r3, r4 = self.np_rng.random(), self.np_rng.random()
                        new_x = (rabbit - mean_pos) - r3 * (0.0 + r4 * self.bounds)
                else:
                    r = self.np_rng.random()
                    if r >= 0.5 and abs(E) >= 0.5:
                        J = 2.0 * (1.0 - self.np_rng.random())
                        new_x = (rabbit - x) - E * np.abs(J * rabbit - x)
                    elif r >= 0.5:
                        new_x = rabbit - E * np.abs(rabbit - x)
                    else:
                        u = max(self.np_rng.random(), 1e-9)
                        sign = 1.0 if self.np_rng.random() >= 0.5 else -1.0
                        center = rabbit if r >= 0.25 else mbest
                        new_x = center + sign * beta * np.abs(mbest - x) * math.log(1.0 / u)

                self.positions[i] = np.clip(new_x, 0.0, self.bounds - 1e-9)

            history.append({"generation": t, "archive_size": len(archive),
                             "best_fuel": min(s.fuel for s in archive)})

        final = [evaluate_selection(self.legs, self._decode(self.positions[i]))
                 for i in range(self.population_size)]
        front = pareto_front(archive + final)
        metrics = {"generations": self.generations, "population_size": self.population_size, "history": history,
                   "quantum_disclaimer": "Classical Harris-Hawks-based metaheuristic with a "
                                          "quantum-potential-well position update. No quantum hardware used."}
        return front, metrics
