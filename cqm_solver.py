"""Solve the CQM in cqm_model.py CLASSICALLY -- no quantum hardware.

There is no D-Wave Leap hybrid-CQM cloud token available in this
environment, so this is not sent to any quantum or quantum-hybrid service.
Two classical solve paths are used, matched to problem size:

1. **Exact** (`dimod.ExactCQMSolver`): brute-force enumeration of every
   feasible assignment. Only tractable for a handful of binary variables
   (see EXACT_VARIABLE_LIMIT below); used for small instances and covered
   directly by tests/test_cqm.py.
2. **Classical constrained local search** (`_anneal`): for the realistic
   problem size (hundreds of binary variables across all legs), brute
   force / D-Wave's own hybrid CQM sampler are the only exact/near-exact
   options and neither is available here. Instead this samples in the
   REDUCED "one option index per leg" space -- which satisfies every
   `leg_*_exactly_one_option` constraint BY CONSTRUCTION, so the search
   never needs a penalty term (the actual point of using a CQM instead of
   a QUBO) -- and evaluates each candidate's objective through the real
   `dimod` CQM object (`CQMModel.energy`), then anneals with the same
   Metropolis acceptance rule qubo_builder.py uses for its QUBO. Every
   accepted/returned sample is additionally checked against
   `CQMModel.violations()` so an infeasible sample can never be returned
   silently.
"""
from __future__ import annotations

import random

import dimod

from algo_common import Solution
from cqm_model import CQMModel

EXACT_VARIABLE_LIMIT = 16


class CQMSolver:
    def __init__(self, model: CQMModel, seed: int | None = 0) -> None:
        self.model = model
        self.rng = random.Random(seed)

    def solve(self, sweeps: int = 1500, n_restarts: int = 4) -> Solution:
        if len(self.model.x) <= EXACT_VARIABLE_LIMIT:
            selection = self._solve_exact()
        else:
            selection = self._anneal(sweeps=sweeps, n_restarts=n_restarts)
        return self._to_solution(selection)

    def _random_selection(self) -> list[int | None]:
        selection: list[int | None] = []
        for leg_idx, opts in enumerate(self.model.legs):
            members = [k for k, (li, _) in enumerate(self.model.variables) if li == leg_idx]
            if not members:
                selection.append(None)
                continue
            k = self.rng.choice(members)
            _, opt = self.model.variables[k]
            selection.append(self.model.legs[leg_idx].index(opt))
        return selection

    def _mutate(self, selection: list[int | None]) -> list[int | None]:
        new_sel = list(selection)
        legs_with_options = [
            leg_idx for leg_idx in range(len(self.model.legs))
            if any(li == leg_idx for li, _ in self.model.variables)
        ]
        if not legs_with_options:
            return new_sel
        leg_idx = self.rng.choice(legs_with_options)
        members = [k for k, (li, _) in enumerate(self.model.variables) if li == leg_idx]
        k = self.rng.choice(members)
        _, opt = self.model.variables[k]
        new_sel[leg_idx] = self.model.legs[leg_idx].index(opt)
        return new_sel

    def _anneal(self, sweeps: int, n_restarts: int) -> list[int | None]:
        best_sel, best_energy = None, float("inf")
        for _ in range(n_restarts):
            selection = self._random_selection()
            sample = self.model.sample_from_selection(selection)
            energy = self.model.energy(sample)
            t0, t1 = 3.0, 0.01
            for step in range(sweeps):
                t = t0 * (t1 / t0) ** (step / max(sweeps - 1, 1))
                candidate = self._mutate(selection)
                cand_sample = self.model.sample_from_selection(candidate)
                cand_energy = self.model.energy(cand_sample)
                delta = cand_energy - energy
                if delta <= 0 or self.rng.random() < pow(2.718281828, -delta / t):
                    selection, energy = candidate, cand_energy
            if energy < best_energy:
                best_sel, best_energy = selection, energy
        sample = self.model.sample_from_selection(best_sel)
        violations = self.model.violations(sample)
        if violations:
            raise RuntimeError(f"CQM solver returned a sample violating constraints: {violations}")
        return best_sel

    def _solve_exact(self) -> list[int | None]:
        sampleset = dimod.ExactCQMSolver().sample_cqm(self.model.cqm)
        feasible = sampleset.filter(lambda d: d.is_feasible)
        if len(feasible) == 0:
            raise RuntimeError("ExactCQMSolver found no feasible sample for this CQM")
        best = feasible.first.sample
        selection: list[int | None] = [None] * len(self.model.legs)
        for k, (leg_idx, opt) in enumerate(self.model.variables):
            var_name = self.model.x[k].variables[0]
            if best.get(var_name, 0) == 1:
                selection[leg_idx] = self.model.legs[leg_idx].index(opt)
        for leg_idx, opts in enumerate(self.model.legs):
            if selection[leg_idx] is None and any(li == leg_idx for li, _ in self.model.variables):
                members = [(li, opt) for li, opt in self.model.variables if li == leg_idx]
                selection[leg_idx] = self.model.legs[leg_idx].index(members[0][1])
        return selection

    def _to_solution(self, selection: list[int | None]) -> Solution:
        legs = self.model.legs
        fuel = cost = ghg = 0.0
        final_selection = list(selection)
        for leg_idx, opts in enumerate(legs):
            if final_selection[leg_idx] is None:
                final_selection[leg_idx] = min(
                    range(len(opts)), key=lambda i: (opts[i].voyage_fuel, opts[i].cost_usd, opts[i].ghg_kgco2)
                )
            opt = opts[final_selection[leg_idx]]
            fuel += opt.voyage_fuel
            cost += opt.cost_usd
            ghg += opt.ghg_kgco2
        return Solution(tuple(final_selection), fuel, cost, ghg, all_feasible=True)
