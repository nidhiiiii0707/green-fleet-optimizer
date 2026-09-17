"""STAGE 8 -- NSGA-II (Deb et al., 2002) over the per-leg option grid.

Adapted from the sibling prototype's
src/optimization/algorithms/nsga2.py: same fast non-dominated sort,
crowding-distance, binary-tournament selection, uniform crossover, and
random-reset mutation, now wired to this repo's real candidate/objective
pipeline (algo_common.py / objective_evaluator.py) instead of placeholder
assumptions.
"""
from __future__ import annotations

import random

from algo_common import Solution, dominates, evaluate_selection, pareto_front
from objective_evaluator import EvaluatedCandidate


def _fast_non_dominated_sort(pop: list[Solution]) -> list[list[int]]:
    n = len(pop)
    dominated_by = [set() for _ in range(n)]
    domination_count = [0] * n
    fronts: list[list[int]] = [[]]
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            if dominates(pop[i].objectives, pop[j].objectives):
                dominated_by[i].add(j)
            elif dominates(pop[j].objectives, pop[i].objectives):
                domination_count[i] += 1
        if domination_count[i] == 0:
            fronts[0].append(i)
    k = 0
    while fronts[k]:
        nxt = []
        for i in fronts[k]:
            for j in dominated_by[i]:
                domination_count[j] -= 1
                if domination_count[j] == 0:
                    nxt.append(j)
        k += 1
        fronts.append(nxt)
    return fronts[:-1]


def _crowding_distance(pop: list[Solution], front: list[int]) -> dict[int, float]:
    distance = {i: 0.0 for i in front}
    if len(front) <= 2:
        return {i: float("inf") for i in front}
    for m in range(3):
        fs = sorted(front, key=lambda i: pop[i].objectives[m])
        distance[fs[0]] = float("inf")
        distance[fs[-1]] = float("inf")
        lo, hi = pop[fs[0]].objectives[m], pop[fs[-1]].objectives[m]
        span = (hi - lo) or 1.0
        for idx in range(1, len(fs) - 1):
            prev_o = pop[fs[idx - 1]].objectives[m]
            next_o = pop[fs[idx + 1]].objectives[m]
            distance[fs[idx]] += (next_o - prev_o) / span
    return distance


class NSGA2Optimizer:
    def __init__(self, legs: list[list[EvaluatedCandidate]], population_size: int = 40,
                 generations: int = 60, crossover_rate: float = 0.9, mutation_rate: float = 0.15,
                 seed: int | None = 0) -> None:
        self.legs = legs
        self.n_legs = len(legs)
        self.population_size = population_size
        self.generations = generations
        self.crossover_rate = crossover_rate
        self.mutation_rate = mutation_rate
        self.rng = random.Random(seed)

    def _random_selection(self) -> tuple[int, ...]:
        return tuple(self.rng.randrange(len(opts)) for opts in self.legs)

    def _crossover(self, a, b):
        if self.rng.random() > self.crossover_rate:
            return a
        return tuple(a[i] if self.rng.random() < 0.5 else b[i] for i in range(self.n_legs))

    def _mutate(self, sel):
        genes = list(sel)
        for i in range(self.n_legs):
            if self.rng.random() < self.mutation_rate:
                genes[i] = self.rng.randrange(len(self.legs[i]))
        return tuple(genes)

    def _tournament(self, pop, rank, crowd):
        i, j = self.rng.randrange(len(pop)), self.rng.randrange(len(pop))
        if rank[i] < rank[j]:
            return pop[i]
        if rank[j] < rank[i]:
            return pop[j]
        return pop[i] if crowd[i] > crowd[j] else pop[j]

    def run(self) -> tuple[list[Solution], dict]:
        history = []
        pop = [evaluate_selection(self.legs, self._random_selection()) for _ in range(self.population_size)]

        for gen in range(self.generations):
            fronts = _fast_non_dominated_sort(pop)
            rank = {i: r for r, front in enumerate(fronts) for i in front}
            crowd: dict[int, float] = {}
            for front in fronts:
                crowd.update(_crowding_distance(pop, front))

            children = []
            while len(children) < self.population_size:
                p1 = self._tournament(pop, rank, crowd)
                p2 = self._tournament(pop, rank, crowd)
                child_sel = self._mutate(self._crossover(p1.selection, p2.selection))
                children.append(evaluate_selection(self.legs, child_sel))

            combined = pop + children
            fronts = _fast_non_dominated_sort(combined)
            new_pop: list[Solution] = []
            for front in fronts:
                if len(new_pop) + len(front) <= self.population_size:
                    new_pop.extend(combined[i] for i in front)
                else:
                    crowd_f = _crowding_distance(combined, front)
                    remaining = self.population_size - len(new_pop)
                    ordered = sorted(front, key=lambda i: -crowd_f[i])
                    new_pop.extend(combined[i] for i in ordered[:remaining])
                    break
            pop = new_pop
            best_fuel = min(s.fuel for s in pop)
            history.append({"generation": gen, "best_fuel": best_fuel, "front0_size": len(fronts[0])})

        final_front = pareto_front(pop)
        metrics = {"generations": self.generations, "population_size": self.population_size,
                   "history": history}
        return final_front, metrics
