"""Shared prototype-scenario builder used by every run_*.py entry point.

Generates the same 252-candidate prototype scenario, evaluates every
candidate exactly once through the real XGB model (cached in
candidate_cache.json across runs), and groups into per-leg option lists for
the algorithms in algo_common.py.
"""
from __future__ import annotations

import time

import data_layer as DL
from candidate_generator import generate_candidates
from candidate_cache import CandidateCache
from objective_evaluator import ObjectiveEvaluator, EvaluatedCandidate
from feasibility_checker import FeasibilityReport, ConstraintResult, ConstraintStatus
from algo_common import group_by_leg


def _rebuild_report(payload: dict) -> FeasibilityReport:
    results = tuple(
        ConstraintResult(r["name"], ConstraintStatus(r["status"]), r["reason"]) for r in payload
    )
    return FeasibilityReport(results)


def build_evaluated_legs(seed: int = 0, use_cache: bool = True, verbose: bool = True):
    candidates = generate_candidates(seed=seed)
    fleet = DL.load_fleet_classes()
    evaluator = ObjectiveEvaluator()
    cache = CandidateCache() if use_cache else None

    evaluated: list[EvaluatedCandidate] = []
    t0 = time.time()
    for c in candidates:
        ctx = DL.build_feasibility_context(c, fleet)
        cached = cache.get(c) if cache else None
        if cached is not None:
            ec = EvaluatedCandidate(
                candidate=c,
                predicted_fuel_rate=cached["predicted_fuel_rate"],
                voyage_hours=cached["voyage_hours"],
                voyage_fuel=cached["voyage_fuel"],
                cost_usd=cached["cost_usd"],
                ghg_kgco2=cached["ghg_kgco2"],
                feasible=cached["feasible"],
                feasibility_report=_rebuild_report(cached["feasibility_reasons"]),
            )
        else:
            ec = evaluator.evaluate(c, ctx)
            if cache:
                cache.put(c, {
                    "predicted_fuel_rate": ec.predicted_fuel_rate,
                    "voyage_hours": ec.voyage_hours,
                    "voyage_fuel": ec.voyage_fuel,
                    "cost_usd": ec.cost_usd,
                    "ghg_kgco2": ec.ghg_kgco2,
                    "feasible": ec.feasible,
                    "feasibility_reasons": [
                        {"name": r.name, "status": r.status.value, "reason": r.reason}
                        for r in ec.feasibility_report.results
                    ],
                })
        evaluated.append(ec)
    if cache:
        cache.save()
    elapsed = time.time() - t0

    legs = group_by_leg(evaluated)
    feasible_count = sum(1 for e in evaluated if e.feasible)
    if verbose:
        print(f"[scenario_setup] {len(evaluated)} candidates across {len(legs)} legs, "
              f"feasible={feasible_count}, infeasible={len(evaluated)-feasible_count}, "
              f"eval_time={elapsed:.2f}s")
    return legs, evaluated
