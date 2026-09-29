"""Pipeline-level comparison input and benchmark isolation tests."""
from __future__ import annotations

from types import SimpleNamespace

from algo_common import Solution
import run_optimization_pipeline as pipeline


def _legs():
    return [[SimpleNamespace(
        candidate=SimpleNamespace(candidate_id="C-STABLE-1"),
        feasible=True,
    )]]


def _install_fast_optimizers(monkeypatch, seen: dict[str, object], *, nsga_error: str | None = None):
    solution = Solution((0,), 10.0, 20.0, 30.0, True)

    class Evolutionary:
        def __init__(self, name, legs, **_kwargs):
            seen[name] = legs
            self.name = name

        def run(self):
            if self.name == "NSGA-II" and nsga_error:
                raise RuntimeError(nsga_error)
            return [solution], {}

    monkeypatch.setattr(
        pipeline,
        "NSGA2Optimizer",
        lambda legs, **kwargs: Evolutionary("NSGA-II", legs, **kwargs),
    )
    monkeypatch.setattr(
        pipeline,
        "QBHOOptimizer",
        lambda legs, **kwargs: Evolutionary("QBHO", legs, **kwargs),
    )
    monkeypatch.setattr(
        pipeline,
        "MOQIGAOptimizer",
        lambda legs, **kwargs: Evolutionary("MO-QIGA", legs, **kwargs),
    )

    class FakeCQMModel:
        def __init__(self, legs, **_kwargs):
            seen["CQM"] = legs

    class FakeCQMSolver:
        def __init__(self, model, **_kwargs):
            self.model = model

        def solve(self, **_kwargs):
            return solution

    monkeypatch.setattr(pipeline, "CQMModel", FakeCQMModel)
    monkeypatch.setattr(pipeline, "CQMSolver", FakeCQMSolver)

    class FakeMILP:
        def __init__(self, legs):
            seen["MILP"] = legs

        def trace_pareto_front(self, **_kwargs):
            return [solution]

        def solve(self, weights):
            return {
                (1.0, 0.0, 0.0): Solution((0,), 9.0, 25.0, 29.0, True),
                (0.0, 1.0, 0.0): Solution((0,), 11.0, 19.0, 31.0, True),
                (0.0, 0.0, 1.0): Solution((0,), 8.0, 26.0, 28.0, True),
            }[weights]

    monkeypatch.setattr(pipeline, "MILPModel", FakeMILP)


def test_moqiga_nsga2_and_milp_receive_the_exact_same_legs_object(monkeypatch):
    """Copying, filtering, or regenerating candidates for one algorithm is a bug."""
    legs = _legs()
    seen: dict[str, object] = {}
    artifacts = {}
    _install_fast_optimizers(monkeypatch, seen)

    pipeline.run_all_algorithms(legs, comparison_recorder=artifacts.update)

    assert seen["MO-QIGA"] is legs
    assert seen["NSGA-II"] is legs
    assert seen["MILP"] is legs
    assert artifacts["candidate_ids"] == ("C-STABLE-1",)
    assert artifacts["algorithm_candidate_ids"] == {
        "MO-QIGA": ("C-STABLE-1",),
        "NSGA-II": ("C-STABLE-1",),
        "MILP Reference": ("C-STABLE-1",),
    }


def test_nsga2_exception_does_not_prevent_moqiga_primary_archive(monkeypatch):
    """A benchmark exception must be captured after the primary run remains usable."""
    legs = _legs()
    seen: dict[str, object] = {}
    artifacts = {}
    _install_fast_optimizers(monkeypatch, seen, nsga_error="NSGA exploded")

    final_front, final_sources, per_algorithm = pipeline.run_all_algorithms(
        legs, comparison_recorder=artifacts.update
    )

    assert final_front == [Solution((0,), 10.0, 20.0, 30.0, True)]
    assert final_sources == ["MO-QIGA"]
    assert per_algorithm["NSGA-II"] == []
    assert artifacts["errors"]["NSGA-II"] == "NSGA exploded"
