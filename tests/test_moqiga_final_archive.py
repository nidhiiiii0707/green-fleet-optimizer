"""Regression tests for MO-QIGA ownership of the decision archive."""
from __future__ import annotations

from algo_common import dominates
from algorithm_comparison import run_all as run_algorithm_comparison
from backend.data_adapter import load_precomputed_result
from robustness_analysis import PERTURBATIONS, run_scenario
from run_optimization_pipeline import generate_evaluated_legs, run_all_algorithms


def test_runtime_final_archive_is_the_moqiga_nondominated_front():
    """A benchmark optimizer must never contribute a dashboard plan."""
    _, legs, _ = generate_evaluated_legs(seed=0)

    final_front, final_sources, per_algorithm_fronts = run_all_algorithms(legs)

    moqiga_front = per_algorithm_fronts["MO-QIGA"]
    assert final_front
    assert {solution.selection for solution in final_front} == {
        solution.selection for solution in moqiga_front
    }
    assert final_sources == ["MO-QIGA"] * len(final_front)
    assert not any(
        dominates(other.objectives, candidate.objectives)
        for candidate in final_front
        for other in final_front
        if other is not candidate
    )


def test_precomputed_dashboard_archive_contains_only_moqiga_plans():
    """The instant-start dashboard archive must obey the runtime contract."""
    result = load_precomputed_result()

    assert result["method"] == "MO-QIGA"
    assert result["pareto_solutions"]
    assert {solution["algorithm"] for solution in result["pareto_solutions"]} == {
        "MO-QIGA"
    }


def test_performance_comparison_benchmarks_moqiga_against_reference_algorithms():
    """The comparison report must measure the decision optimizer too."""
    _, legs, _ = generate_evaluated_legs(seed=0)

    comparison = run_algorithm_comparison(legs[:1])

    assert set(comparison) == {"MO-QIGA", "NSGA-II", "QBHO", "CQM", "MILP"}


def test_robustness_sweep_analyzes_moqiga_recommendations():
    result = run_scenario(PERTURBATIONS[0])

    assert result["algorithm"] == "MO-QIGA"
