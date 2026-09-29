# Algorithm Comparison (Stage 12)

Same 252-candidate / 6-leg prototype scenario, same seed (0), same real XGB fuel model, same SCENARIO_INPUT cost/GHG parameters for all five algorithms.

**IGD** is computed against the union of all five fronts (the best available approximation), NOT a verified true Pareto front -- none is known for this problem.

**Hypervolume** is Monte-Carlo estimated (200,000 samples, seed 0) in normalized objective space against a shared reference point.

**MO-QIGA, QBHO, and CQM are classical computations** (a quantum-inspired genetic algorithm, a Harris-Hawks-based metaheuristic with quantum-behaved position updates, and a Constrained Quadratic Model solved by exact/classical-annealing search, respectively) -- no quantum hardware is used anywhere in this comparison.

| algorithm   |   pareto_front_size |   runtime_seconds |   hypervolume_normalized |   igd_vs_union_front |   diversity_spacing_std |   feasible_ratio |   best_fuel |   best_cost |   best_ghg |
|:------------|--------------------:|------------------:|-------------------------:|---------------------:|------------------------:|-----------------:|------------:|------------:|-----------:|
| NSGA-II     |                   2 |         0.341925  |                 0.92041  |             0.210738 |             0           |                1 |     183.55  |      104967 |     577383 |
| QBHO        |                   1 |         0.0273447 |                 0.027685 |             0.880926 |           nan           |                1 |     231.647 |      145446 |     726882 |
| CQM         |                   4 |        12.4352    |                 0.942555 |             0.177894 |             0.114005    |                1 |     181.888 |      104967 |     574526 |
| MILP        |                   4 |         0.0903971 |                 0.942555 |             0.177894 |             0.114005    |                1 |     181.888 |      104967 |     574526 |
| MO-QIGA     |                   4 |         0.038027  |                 0.464785 |             0.221421 |             1.04083e-17 |                1 |     194.07  |      119765 |     610498 |

## Caveat

Cost and GHG values above are SCENARIO_INPUT-dependent (fuel price, emission factor, and the fuel-rate-to-voyage-total sampling-interval assumption are all SCENARIO_INPUT). They are valid for RELATIVE comparison between algorithms under one fixed assumption set, not verified real-world magnitudes.
