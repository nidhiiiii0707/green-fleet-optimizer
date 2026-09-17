# Robustness / Sensitivity Report (Stage 13)

All perturbations below are SCENARIO perturbations of SCENARIO_INPUT knobs (fuel price, emission factor, an assumed cargo-load multiplier, and the voyage-deadline multiplier). None of these are real measurements -- they test how sensitive the NSGA-II Pareto front is to the assumptions this pipeline must make because the real data layer has no absolute fuel price, no carbon price, and no per-route real cargo demand.

| scenario                |   n_candidates |   feasible_ratio |   pareto_front_size |   best_fuel |   best_cost |   best_ghg |
|:------------------------|---------------:|-----------------:|--------------------:|------------:|------------:|-----------:|
| baseline                |            252 |         0.666667 |                   4 |     181.888 |      119806 |     574526 |
| fuel_price_+30pct       |            252 |         0.666667 |                   4 |     181.888 |      155747 |     574526 |
| fuel_price_-30pct       |            252 |         0.666667 |                   4 |     181.888 |       83864 |     574526 |
| emission_factor_+50pct  |            252 |         0.666667 |                   3 |     182.673 |      116366 |     864920 |
| cargo_demand_+20pct     |            252 |         0.333333 |                   3 |     187.031 |      123260 |     590510 |
| tighter_deadline_-30pct |            252 |         0.666667 |                   4 |     181.888 |      119806 |     574526 |

## Observations

- **fuel_price_+30pct**: cost change +30.0%, GHG change +0.0%, feasible-ratio change +0.0 pts vs baseline.
- **fuel_price_-30pct**: cost change -30.0%, GHG change +0.0%, feasible-ratio change +0.0 pts vs baseline.
- **emission_factor_+50pct**: cost change -2.9%, GHG change +50.5%, feasible-ratio change +0.0 pts vs baseline.
- **cargo_demand_+20pct**: cost change +2.9%, GHG change +2.8%, feasible-ratio change -33.3 pts vs baseline.
- **tighter_deadline_-30pct**: cost change +0.0%, GHG change +0.0%, feasible-ratio change +0.0 pts vs baseline.

## Caveat

These sensitivities describe how the OPTIMIZER's answer moves under different SCENARIO_INPUT assumptions -- they are not evidence about real fuel-market or emissions-regulation volatility, since the underlying price/
emission-factor/demand numbers are themselves SCENARIO_INPUT, not measured.
