"""STAGE 13 -- Sensitivity sweep over SCENARIO perturbations.

Perturbs SCENARIO_INPUT knobs only (fuel price, emission factor, cargo load
fraction, voyage-deadline multiplier) -- never real/derived data -- and reruns
NSGA-II on each perturbed scenario. This is explicitly a SCENARIO sensitivity
study, not a measurement of real-world robustness (see caveats throughout).

Run: python robustness_analysis.py
"""
from __future__ import annotations

import copy
import json

import numpy as np
import pandas as pd

import data_layer as DL
from candidate_generator import generate_candidates
from objective_evaluator import ObjectiveEvaluator
from algo_common import group_by_leg
from nsga2_optimizer import NSGA2Optimizer

PERTURBATIONS = [
    {"name": "baseline", "fuel_price_mult": 1.0, "emission_factor_mult": 1.0, "cargo_load_mult": 1.0, "deadline_mult": 1.0},
    {"name": "fuel_price_+30pct", "fuel_price_mult": 1.3, "emission_factor_mult": 1.0, "cargo_load_mult": 1.0, "deadline_mult": 1.0},
    {"name": "fuel_price_-30pct", "fuel_price_mult": 0.7, "emission_factor_mult": 1.0, "cargo_load_mult": 1.0, "deadline_mult": 1.0},
    {"name": "emission_factor_+50pct", "fuel_price_mult": 1.0, "emission_factor_mult": 1.5, "cargo_load_mult": 1.0, "deadline_mult": 1.0},
    {"name": "cargo_demand_+20pct", "fuel_price_mult": 1.0, "emission_factor_mult": 1.0, "cargo_load_mult": 1.2, "deadline_mult": 1.0},
    {"name": "tighter_deadline_-30pct", "fuel_price_mult": 1.0, "emission_factor_mult": 1.0, "cargo_load_mult": 1.0, "deadline_mult": 0.7},
]


def run_scenario(perturbation: dict) -> dict:
    original_price = dict(DL.SCENARIO_FUEL_PRICE_USD_PER_TONNE)
    original_ef = dict(DL.SCENARIO_EMISSION_FACTOR_KGCO2_PER_TONNE_FUEL)
    original_deadline_mult = DL.SCENARIO_VOYAGE_DEADLINE_MULTIPLIER

    try:
        DL.SCENARIO_FUEL_PRICE_USD_PER_TONNE = {k: v * perturbation["fuel_price_mult"] for k, v in original_price.items()}
        DL.SCENARIO_EMISSION_FACTOR_KGCO2_PER_TONNE_FUEL = {k: v * perturbation["emission_factor_mult"] for k, v in original_ef.items()}
        DL.SCENARIO_VOYAGE_DEADLINE_MULTIPLIER = original_deadline_mult * perturbation["deadline_mult"]

        candidates = generate_candidates(seed=0)
        if perturbation["cargo_load_mult"] != 1.0:
            candidates = [
                type(c)(**{**c.__dict__, "cargo_tons": c.cargo_tons * perturbation["cargo_load_mult"]})
                for c in candidates
            ]

        fleet = DL.load_fleet_classes()
        evaluator = ObjectiveEvaluator()
        evaluated = []
        for c in candidates:
            ctx = DL.build_feasibility_context(c, fleet)
            evaluated.append(evaluator.evaluate(c, ctx))
        legs = group_by_leg(evaluated)

        feasible_ratio = sum(1 for e in evaluated if e.feasible) / len(evaluated)

        opt = NSGA2Optimizer(legs, population_size=30, generations=40, seed=0)
        front, _ = opt.run()

        return {
            "scenario": perturbation["name"],
            "n_candidates": len(evaluated),
            "feasible_ratio": feasible_ratio,
            "pareto_front_size": len(front),
            "best_fuel": min((s.fuel for s in front), default=None),
            "best_cost": min((s.cost for s in front), default=None),
            "best_ghg": min((s.ghg for s in front), default=None),
        }
    finally:
        DL.SCENARIO_FUEL_PRICE_USD_PER_TONNE = original_price
        DL.SCENARIO_EMISSION_FACTOR_KGCO2_PER_TONNE_FUEL = original_ef
        DL.SCENARIO_VOYAGE_DEADLINE_MULTIPLIER = original_deadline_mult


def main():
    rows = [run_scenario(p) for p in PERTURBATIONS]
    df = pd.DataFrame(rows)
    df.to_csv("robustness_results.csv", index=False)

    baseline = df[df["scenario"] == "baseline"].iloc[0]
    with open("robustness_report.md", "w") as fh:
        fh.write("# Robustness / Sensitivity Report (Stage 13)\n\n")
        fh.write("All perturbations below are SCENARIO perturbations of SCENARIO_INPUT knobs "
                 "(fuel price, emission factor, an assumed cargo-load multiplier, and the "
                 "voyage-deadline multiplier). None of these are real measurements -- they test "
                 "how sensitive the NSGA-II Pareto front is to the assumptions this pipeline "
                 "must make because the real data layer has no absolute fuel price, no carbon "
                 "price, and no per-route real cargo demand.\n\n")
        fh.write(df.to_markdown(index=False))
        fh.write("\n\n## Observations\n\n")
        for _, row in df.iterrows():
            if row["scenario"] == "baseline":
                continue
            dcost = (row["best_cost"] - baseline["best_cost"]) / baseline["best_cost"] * 100 if row["best_cost"] and baseline["best_cost"] else None
            dghg = (row["best_ghg"] - baseline["best_ghg"]) / baseline["best_ghg"] * 100 if row["best_ghg"] and baseline["best_ghg"] else None
            dfeas = (row["feasible_ratio"] - baseline["feasible_ratio"]) * 100
            fh.write(f"- **{row['scenario']}**: cost change {dcost:+.1f}%, GHG change {dghg:+.1f}%, "
                     f"feasible-ratio change {dfeas:+.1f} pts vs baseline.\n")
        fh.write("\n## Caveat\n\nThese sensitivities describe how the OPTIMIZER's answer moves "
                 "under different SCENARIO_INPUT assumptions -- they are not evidence about real "
                 "fuel-market or emissions-regulation volatility, since the underlying price/\n"
                 "emission-factor/demand numbers are themselves SCENARIO_INPUT, not measured.\n")

    print(df.to_string(index=False))
    print("\nWrote robustness_results.csv, robustness_report.md")


if __name__ == "__main__":
    main()
