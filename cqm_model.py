"""CQM MATHEMATICAL FORMULATION of the per-leg selection problem.

Replaces QUBO-SA in the active algorithm set. Built on `dimod`'s real
`ConstrainedQuadraticModel` (the same object type D-Wave's hybrid CQM
service accepts) so the one-hot-per-leg rule is an EXPLICIT constraint,
not a quadratic penalty term folded into the objective the way
`qubo_model.py` had to embed it. This is the defining difference between a
QUBO and a CQM: a CQM can express "exactly one option per leg" directly and
have a solver reject any sample that violates it, instead of merely
penalizing it.

**No quantum hardware is used or claimed anywhere in this module or
cqm_solver.py.** There is no D-Wave Leap account/token in this environment,
so this is solved with a classical solver (see cqm_solver.py) -- the honest
classical stand-in for a CQM the same way qubo_builder.py's simulated
annealing stands in for a quantum annealer.

Binary variables x[leg, option] for every FEASIBLE option only (same
variable indexing convention as qubo_model.py / milp_model.py, so results
are directly comparable). Objective is a weighted-sum scalarization of the
real Fuel/Cost/GHG values (same scalarization approach used by
milp_model.py, since a CQM -- like MILP -- optimizes one scalar objective
per solve; multi-objective handling is done by sweeping the weight simplex,
see cqm_solver.py: CQMSolver.trace_pareto_front()).
"""
from __future__ import annotations

import dimod

from objective_evaluator import EvaluatedCandidate


class CQMModel:
    def __init__(self, legs: list[list[EvaluatedCandidate]],
                 weights: tuple[float, float, float] = (1.0, 1.0, 1.0)) -> None:
        self.legs = legs
        self.variables: list[tuple[int, EvaluatedCandidate]] = [
            (leg_idx, opt) for leg_idx, opts in enumerate(legs) for opt in opts if opt.feasible
        ]
        if not self.variables:
            raise ValueError("No feasible options for any leg; cannot build a CQM")

        wf, wc, wg = weights
        self.x = [dimod.Binary(f"x_{leg_idx}_{k}") for k, (leg_idx, _) in enumerate(self.variables)]

        cqm = dimod.ConstrainedQuadraticModel()
        objective = dimod.QuadraticModel()
        for k, (_, opt) in enumerate(self.variables):
            coeff = wf * opt.voyage_fuel + wc * opt.cost_usd + wg * opt.ghg_kgco2
            objective += coeff * self.x[k]
        cqm.set_objective(objective)

        for leg_idx in range(len(legs)):
            members = [k for k, (li, _) in enumerate(self.variables) if li == leg_idx]
            if not members:
                continue  # a leg with zero feasible options has no constraint to add
            cqm.add_constraint(
                dimod.quicksum(self.x[k] for k in members) == 1,
                label=f"leg_{leg_idx}_exactly_one_option",
            )

        self.cqm = cqm

    def sample_from_selection(self, selection: list[int | None]) -> dict[str, int]:
        """Build a full binary assignment (every declared CQM variable set to
        0 or 1) for a per-leg selection given as an option list-index per
        leg (None where a leg has no feasible option)."""
        chosen_keys = set()
        for leg_idx, choice in enumerate(selection):
            if choice is None:
                continue
            opt = self.legs[leg_idx][choice]
            for k, (li, o) in enumerate(self.variables):
                if li == leg_idx and o is opt:
                    chosen_keys.add(k)
                    break
        return {var.variables[0]: (1 if k in chosen_keys else 0) for k, var in enumerate(self.x)}

    def energy(self, sample: dict[str, int]) -> float:
        return float(self.cqm.objective.energy(sample))

    def violations(self, sample: dict[str, int]) -> dict[str, float]:
        return dict(self.cqm.violations(sample, skip_satisfied=True))
