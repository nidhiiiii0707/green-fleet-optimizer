import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scenario_setup import build_evaluated_legs
from algo_common import pareto_front
from qbho import QBHOOptimizer


def test_qbho_returns_a_nonempty_pareto_front_with_valid_selections():
    legs, _ = build_evaluated_legs(seed=0, use_cache=True, verbose=False)
    front, metrics = QBHOOptimizer(legs, population_size=15, generations=10, seed=0).run()

    assert len(front) > 0
    for sol in front:
        assert len(sol.selection) == len(legs)
        for leg_idx, choice in enumerate(sol.selection):
            assert 0 <= choice < len(legs[leg_idx])

    assert metrics["generations"] == 10
    assert metrics["population_size"] == 15
    assert "no quantum hardware" in metrics["quantum_disclaimer"].lower()


def test_qbho_front_is_actually_non_dominated():
    legs, _ = build_evaluated_legs(seed=0, use_cache=True, verbose=False)
    front, _ = QBHOOptimizer(legs, population_size=15, generations=10, seed=0).run()
    assert pareto_front(front) == front


def test_qbho_is_deterministic_given_a_seed():
    legs, _ = build_evaluated_legs(seed=0, use_cache=True, verbose=False)
    front_a, _ = QBHOOptimizer(legs, population_size=10, generations=8, seed=1).run()
    front_b, _ = QBHOOptimizer(legs, population_size=10, generations=8, seed=1).run()
    assert {s.selection for s in front_a} == {s.selection for s in front_b}
