# Algorithm Comparison (Stage 12)

> **HISTORICAL / SUPERSEDED.** This comparison was generated *before* the QUBO-SA/MO-QIGA
> → QBHO/CQM migration (see `README.md` and `mathematical_formulation.md`). The table
> below compares the pre-migration algorithm set (NSGA-II, MO-QIGA, QUBO-SA, MILP) and is
> **not part of the current active pipeline** — it is kept as-is (not recomputed) for
> historical reference. The current active algorithm set is:
>
> 1. NSGA-II
> 2. QBHO
> 3. CQM
> 4. MILP
>
> `qubo_model.py`, `qubo_builder.py`, `mo_qiga.py`, and their runner scripts have since
> been deleted from the repository. To get a current comparison, re-run
> `algorithm_comparison.py` against today's active set.

Same 252-candidate / 6-leg prototype scenario, same seed (0), same real XGB fuel model, same SCENARIO_INPUT cost/GHG parameters for all four algorithms.

**IGD** is computed against the union of all four fronts (the best available approximation), NOT a verified true Pareto front -- none is known for this problem.

**Hypervolume** is Monte-Carlo estimated (200,000 samples, seed 0) in normalized objective space against a shared reference point.

**QUBO and MO-QIGA are classical computations** (simulated annealing / a classical simulation of a quantum-inspired heuristic respectively) -- no quantum hardware is used anywhere in this comparison.

| algorithm   |   pareto_front_size |   runtime_seconds |   hypervolume_normalized |   igd_vs_union_front |   diversity_spacing_std |   feasible_ratio |   best_fuel |   best_cost |         best_ghg |
|:------------|--------------------:|------------------:|-------------------------:|---------------------:|------------------------:|-----------------:|------------:|------------:|-----------------:|
| NSGA-II     |                   2 |          1.09633  |                 0.983465 |             0.266167 |             0           |                1 |     183.55  |      104967 | 577383           |
| MO-QIGA     |                   4 |          0.181932 |                 0.809985 |             0.232142 |             4.79016e-18 |                1 |     194.07  |      119765 | 610498           |
| QUBO-SA     |                   2 |          2.46432  |                 0.01837  |             0.9686   |             0           |                1 |     324.747 |      239178 |      1.03322e+06 |
| MILP        |                   4 |          0.541699 |                 0.993755 |             0.257247 |             0.0370838   |                1 |     181.888 |      104967 | 574526           |

## Caveat

Cost and GHG values above are SCENARIO_INPUT-dependent (fuel price, emission factor, and the fuel-rate-to-voyage-total sampling-interval assumption are all SCENARIO_INPUT). They are valid for RELATIVE comparison between algorithms under one fixed assumption set, not verified real-world magnitudes.
