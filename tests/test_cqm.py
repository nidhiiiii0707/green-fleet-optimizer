import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scenario_setup import build_evaluated_legs
from cqm_model import CQMModel
from cqm_solver import CQMSolver, EXACT_VARIABLE_LIMIT


class _FakeOpt:
    def __init__(self, fuel, cost, ghg, feasible=True):
        self.voyage_fuel = fuel
        self.cost_usd = cost
        self.ghg_kgco2 = ghg
        self.feasible = feasible


def _tiny_legs():
    return [
        [_FakeOpt(1, 10, 100), _FakeOpt(5, 50, 500)],
        [_FakeOpt(3, 30, 300), _FakeOpt(9, 90, 900)],
    ]


def test_cqm_model_has_one_constraint_per_leg_with_feasible_options():
    legs, _ = build_evaluated_legs(seed=0, use_cache=True, verbose=False)
    model = CQMModel(legs, weights=(1.0, 1.0, 1.0))
    leg_indices = {li for li, _ in model.variables}
    assert len(leg_indices) > 0
    assert leg_indices.issubset(set(range(len(legs))))
    assert len(model.cqm.constraints) == len(leg_indices)


def test_cqm_constraint_is_violated_by_two_hot_and_zero_hot_samples():
    model = CQMModel(_tiny_legs(), weights=(1.0, 0.0, 0.0))
    one_hot = model.sample_from_selection([0, 1])
    assert model.violations(one_hot) == {}

    zero_hot_leg0 = dict(one_hot)
    zero_hot_leg0["x_0_0"] = 0  # unset the chosen leg-0 option without setting any other
    assert model.violations(zero_hot_leg0) != {}

    two_hot_leg0 = dict(one_hot)
    two_hot_leg0["x_0_1"] = 1  # both leg-0 options now selected
    assert model.violations(two_hot_leg0) != {}


def test_cqm_solver_picks_the_minimum_objective_feasible_combination():
    legs = _tiny_legs()
    model = CQMModel(legs, weights=(1.0, 0.0, 0.0))
    assert len(model.x) <= EXACT_VARIABLE_LIMIT  # exercises the exact solve path
    solution = CQMSolver(model, seed=0).solve()
    assert solution.selection == (0, 0)  # cheapest fuel option on each leg
    assert solution.all_feasible


def test_cqm_solver_never_returns_a_constraint_violating_sample_at_realistic_scale():
    legs, _ = build_evaluated_legs(seed=0, use_cache=True, verbose=False)
    model = CQMModel(legs, weights=(1.0, 0.0, 0.0))
    assert len(model.x) > EXACT_VARIABLE_LIMIT  # exercises the classical-anneal path
    solution = CQMSolver(model, seed=0).solve(sweeps=200, n_restarts=1)
    sample = model.sample_from_selection(list(solution.selection))
    assert model.violations(sample) == {}
