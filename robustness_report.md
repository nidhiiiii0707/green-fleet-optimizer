# Robustness / Sensitivity Report (Stage 13)

All perturbations below are SCENARIO perturbations of SCENARIO_INPUT knobs (fuel price, emission factor, an assumed cargo-load multiplier, and the voyage-deadline multiplier). None of these are real measurements -- they test how sensitive the MO-QIGA Pareto front is to the assumptions this pipeline must make because the real data layer has no absolute fuel price, no carbon price, and no per-route real cargo demand.

| algorithm   | scenario                |   n_candidates |   feasible_ratio |   pareto_front_size |   best_fuel |   best_cost |   best_ghg |
|:------------|:------------------------|---------------:|-----------------:|--------------------:|------------:|------------:|-----------:|
| MO-QIGA     | baseline                |            252 |         0.666667 |                   4 |     194.07  |    119765   |     610498 |
| MO-QIGA     | fuel_price_+30pct       |            252 |         0.666667 |                   4 |     194.07  |    155694   |     610498 |
| MO-QIGA     | fuel_price_-30pct       |            252 |         0.666667 |                   4 |     194.07  |     83835.2 |     610498 |
| MO-QIGA     | emission_factor_+50pct  |            252 |         0.666667 |                   4 |     194.07  |    119765   |     915747 |
| MO-QIGA     | cargo_demand_+20pct     |            252 |         0.333333 |                   3 |     192.824 |    109878   |     604701 |
| MO-QIGA     | tighter_deadline_-30pct |            252 |         0.666667 |                   4 |     194.07  |    119765   |     610498 |

## Observations

- **fuel_price_+30pct**: cost change +30.0%, GHG change +0.0%, feasible-ratio change +0.0 pts vs baseline.
- **fuel_price_-30pct**: cost change -30.0%, GHG change +0.0%, feasible-ratio change +0.0 pts vs baseline.
- **emission_factor_+50pct**: cost change +0.0%, GHG change +50.0%, feasible-ratio change +0.0 pts vs baseline.
- **cargo_demand_+20pct**: cost change -8.3%, GHG change -0.9%, feasible-ratio change -33.3 pts vs baseline.
- **tighter_deadline_-30pct**: cost change +0.0%, GHG change +0.0%, feasible-ratio change +0.0 pts vs baseline.

## Caveat

These sensitivities describe how the OPTIMIZER's answer moves under different SCENARIO_INPUT assumptions -- they are not evidence about real fuel-market or emissions-regulation volatility, since the underlying price/
emission-factor/demand numbers are themselves SCENARIO_INPUT, not measured.
