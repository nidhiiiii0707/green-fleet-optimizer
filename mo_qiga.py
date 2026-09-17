"""STAGE 10 -- Multi-Objective Quantum-Inspired Genetic Algorithm (MO-QIGA).

**This is a classical simulation of a quantum-inspired heuristic. It does
NOT run on, or claim to run on, quantum hardware.** Follows the classic
Han & Kim (2002) Q-bit representation, generalized to multiple objectives
via a non-dominated archive used as the rotation guide, the standard way
QIGA is extended to MOO (MOQIEA-style algorithms). Every Q-bit pair
(alpha, beta) with alpha^2+beta^2=1 is a plain numpy float pair; "observing"
a Q-individual is an ordinary pseudo-random draw against beta^2, decoded into
a selection tuple and evaluated with the SAME real Fuel/Cost/GHG values as
every other algorithm here (objective_evaluator.py / algo_common.py).
"""
from __future__ import annotations

import math
import random

import numpy as np

from algo_common import Solution, evaluate_selection, pareto_front
from objective_evaluator import EvaluatedCandidate


class MOQIGAOptimizer:
    def __init__(self, legs: list[list[EvaluatedCandidate]], population_size: int = 30,
                 generations: int = 60, rotation_step: float = 0.05 * math.pi,
                 seed: int | None = 0) -> None:
        self.legs = legs
        self.n_legs = len(legs)
        self.bits_per_leg = [max(1, math.ceil(math.log2(len(opts)))) for opts in legs]
        self.total_bits = sum(self.bits_per_leg)
        self.population_size = population_size
        self.generations = generations
        self.rotation_step = rotation_step
        self.rng = random.Random(seed)
        self.np_rng = np.random.default_rng(seed)
        self.theta = np.full((population_size, self.total_bits), math.pi / 4)  # 50/50 superposition start

    def _decode(self, bits: np.ndarray) -> tuple[int, ...]:
        selection = []
        pos = 0
        for leg_idx, n_bits in enumerate(self.bits_per_leg):
            chunk = bits[pos:pos + n_bits]
            pos += n_bits
            value = 0
            for b in chunk:
                value = (value << 1) | int(b)
            selection.append(value % len(self.legs[leg_idx]))
        return tuple(selection)

    def _observe(self, theta_row: np.ndarray) -> np.ndarray:
        beta_sq = np.sin(theta_row) ** 2
        draws = self.np_rng.random(self.total_bits)
        return (draws < beta_sq).astype(int)

    def _selection_to_bits(self, selection: tuple[int, ...]) -> list[int]:
        bits: list[int] = []
        for leg_idx, choice in enumerate(selection):
            n_bits = self.bits_per_leg[leg_idx]
            bits.extend((choice >> shift) & 1 for shift in range(n_bits - 1, -1, -1))
        return bits

    def run(self) -> tuple[list[Solution], dict]:
        archive: list[Solution] = []
        history = []
        for gen in range(self.generations):
            observed = [self._observe(self.theta[i]) for i in range(self.population_size)]
            selections = [self._decode(b) for b in observed]
            solutions = [evaluate_selection(self.legs, s) for s in selections]

            archive = pareto_front(archive + solutions)
            if len(archive) > 25:
                archive = self.rng.sample(archive, 25)

            for i in range(self.population_size):
                guide = self.rng.choice(archive)
                guide_bits = self._selection_to_bits(guide.selection)
                for b in range(self.total_bits):
                    if observed[i][b] == guide_bits[b]:
                        continue
                    direction = 1.0 if guide_bits[b] == 1 else -1.0
                    self.theta[i, b] = np.clip(self.theta[i, b] + direction * self.rotation_step, 1e-3, math.pi / 2 - 1e-3)
                if self.rng.random() < 0.05:
                    b = self.rng.randrange(self.total_bits)
                    self.theta[i, b] = math.pi / 2 - self.theta[i, b]

            history.append({"generation": gen, "archive_size": len(archive),
                             "best_fuel": min(s.fuel for s in archive)})

        final = [evaluate_selection(self.legs, self._decode(self._observe(self.theta[i])))
                 for i in range(self.population_size)]
        front = pareto_front(archive + final)
        metrics = {"generations": self.generations, "population_size": self.population_size, "history": history,
                   "quantum_disclaimer": "Classical simulation of a quantum-inspired heuristic. No quantum hardware used."}
        return front, metrics
