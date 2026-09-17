"""Shared solution representation for all four optimizers (Stages 8-11).

A "solution" here is one option-index PER LEG (a leg = one distinct
origin->destination route the prototype scenario must serve). Each leg has
its own list of pre-evaluated Candidate options (from candidate_generator.py
+ objective_evaluator.py); every algorithm below searches over exactly this
representation so their outputs are directly comparable (Stage 12).
"""
from __future__ import annotations

from dataclasses import dataclass

from objective_evaluator import EvaluatedCandidate

INFEASIBILITY_PENALTY = 1.0e6


@dataclass(frozen=True)
class Solution:
    selection: tuple[int, ...]
    fuel: float
    cost: float
    ghg: float
    all_feasible: bool

    @property
    def objectives(self) -> tuple[float, float, float]:
        return (self.fuel, self.cost, self.ghg)


def evaluate_selection(legs: list[list[EvaluatedCandidate]], selection: tuple[int, ...]) -> Solution:
    fuel = cost = ghg = 0.0
    all_feasible = True
    for leg_options, choice in zip(legs, selection):
        opt = leg_options[choice]
        fuel += opt.voyage_fuel
        cost += opt.cost_usd
        ghg += opt.ghg_kgco2
        if not opt.feasible:
            all_feasible = False
            fuel += INFEASIBILITY_PENALTY
            cost += INFEASIBILITY_PENALTY
            ghg += INFEASIBILITY_PENALTY
    return Solution(selection, fuel, cost, ghg, all_feasible)


def dominates(a: tuple[float, float, float], b: tuple[float, float, float]) -> bool:
    return all(x <= y for x, y in zip(a, b)) and any(x < y for x, y in zip(a, b))


def pareto_front(solutions: list[Solution]) -> list[Solution]:
    front: list[Solution] = []
    for cand in solutions:
        if any(dominates(o.objectives, cand.objectives) for o in solutions if o is not cand):
            continue
        if any(cand.selection == e.selection for e in front):
            continue
        front.append(cand)
    return front


def group_by_leg(evaluated: list[EvaluatedCandidate]) -> list[list[EvaluatedCandidate]]:
    """Group evaluated candidates by leg_id, preserving first-seen leg order."""
    legs: dict[str, list[EvaluatedCandidate]] = {}
    for ec in evaluated:
        legs.setdefault(ec.candidate.leg_id, []).append(ec)
    return list(legs.values())
