# FINAL OPTIMIZATION REPORT

## What this pipeline does
Real/derived fleet, route, port, and fuel-cost data -> candidate generation ->
hard feasibility screening -> real (un-retrained) XGBoost fuel-consumption
model -> SCENARIO_INPUT cost/GHG conversion -> four optimizers (NSGA-II,
QUBO/simulated-annealing, MO-QIGA, MILP) searching the identical decision
space -> merged Pareto archive -> `final_pareto_fleet_plans.csv`.

Run the whole thing with: `./.venv2/Scripts/python.exe run_optimization_pipeline.py`
(see README.md / NEXT_STEPS.md for full environment setup).

## REAL data used
- Vessel-class speed bounds (min/max/mean knots) — `fleet_parameters.csv` (`ship_performance.csv` observations).
- Port coordinates and the 13-port real route figure — `port_master_derived.csv`, `route_derived.csv` origin.
- Fuel-type categories (DM, RM380) and every operating-condition feature fed to the XGB model — real CPS_Poseidon telemetry (`data/cps_poseidon_sample.csv`, a 300-row real sample used as operating-condition templates).
- The trained fuel model itself — `models/fuel_xgb_pipeline.joblib`, loaded and called, never retrained.

## DERIVED data used
- Route distance (haversine of real port coordinates) and nominal voyage time — `route_derived.csv`.
- Vessel cargo capacity per class = real mean cargo tons / real mean load ratio (`data_layer.py`).
- Voyage fuel = XGB rate prediction x voyage hours (distance/speed) — a DERIVED total built from a real prediction, but the base physical unit is undocumented (see below).

## SCENARIO_INPUT parameters (assumed, not measured)
- Fuel price (USD/tonne) and GHG emission factor (kgCO2/tonne) per fuel type — standard order-of-magnitude/IMO reference values, NOT measured in this dataset.
- Vessel-fuel compatibility matrix, port fuel availability, voyage-deadline multiplier (1.5x nominal), per-route cargo target.
- The 1.0-hour fuel-rate sampling interval assumption (the raw telemetry has no timestamp column at all, so the real interval cannot be recovered from data).

## MODEL PREDICTIONS
- `predicted_fuel_rate` in `final_pareto_fleet_plans.csv` = live call to `fuel_xgb_pipeline.joblib` (test R2 = 0.970 on its own held-out split, per the artifact's stored `test_metrics`). Cargo/load/draft are confirmed NOT model inputs (checked against `models/fuel_pipeline_utils.py` and the artifact's `raw_input_columns`/`engineered_features`).

## OPTIMIZATION OUTPUTS
- `final_pareto_fleet_plans.csv` — merged non-dominated set across NSGA-II, QUBO-SA, MO-QIGA, and exact MILP, all run on the identical 252-candidate / 6-leg prototype scenario, same seed.
- `algorithm_comparison.csv/.md` + `comparison_plots/*.png` — hypervolume (Monte-Carlo, normalized), IGD (vs. union-of-fronts proxy, no true front is known), runtime, feasibility ratio, diversity.
- `robustness_results.csv` / `robustness_report.md` — sensitivity of the NSGA-II front to SCENARIO_INPUT perturbations only.

## LIMITATIONS (read before using any number here for a real decision)
1. **Fuel/Cost/GHG absolute magnitudes are NOT verified real-world accurate.** The XGB
   target's physical unit is undocumented, the sampling interval is an assumption, and
   fuel price / emission factor are SCENARIO_INPUT. Only RELATIVE comparisons between
   candidates/algorithms under this one fixed assumption set are meaningful.
2. **Draft-vs-port-depth and port-capacity constraints are UNAVAILABLE everywhere** — no
   physical port depth (metres) or rated port throughput exists in the processed data. The
   feasibility checker reports this explicitly rather than fabricating a pass/fail.
3. **No individual-vessel DWT exists anywhere** — vessel capacity is a DERIVED
   fleet-segment-level estimate (mean cargo / mean load ratio), not a rated capacity for any
   specific ship.
4. **Route cargo demand is SCENARIO_INPUT** — no real origin-destination tonnage exists for
   the specific synthetic port pairs used (real port coordinates, but no real sailed-track
   traffic between them).
5. **MO-QIGA is a classical simulation of a quantum-inspired heuristic. QUBO here is a
   mathematical formulation solved by classical simulated annealing.** Neither runs on, nor
   claims to run on, quantum hardware anywhere in this repository.
6. **Prototype scale only** — 252 candidates / 6 legs / 4 vessel classes, chosen to keep
   NSGA-II/QUBO/MO-QIGA/MILP runtimes manageable for validation; not a production fleet size.
7. Pre-existing `tests/test_candidate.py`, `test_candidate_evaluation.py`, `test_feasibility.py`,
   `test_fuel_predictor.py`, `test_loaders.py`, `test_objectives.py`, `test_parameter_builder.py`,
   `test_smoke.py` reference a `src.*` package that does not exist in this repo (orphaned from
   an earlier/sibling attempt) and are excluded via `pytest.ini`; they were not authored or
   relied upon by this pipeline.

## Natural-language front end (`nlp/`)

A thin translation layer sits in front of this pipeline; it never performs any
optimization itself:

```
natural language request
        -> nlp/parser.py            (deterministic regex/spaCy-tokenizer parsing:
                                      origin/destination, vessel type, fuel type,
                                      speed, cargo, objectives)
        -> nlp/optimization_adapter.build_optimization_request()
                                     (parsed fields -> a plain optimization request dict)
        -> nlp/optimization_adapter.filter_legs()
                                     (constrains the SAME candidates/legs this pipeline
                                      already generates and evaluates -- it filters,
                                      it never invents a new candidate or numeric value)
        -> run_optimization_pipeline.run_all_algorithms()
                                     (the unmodified NSGA-II / QUBO-SA / MO-QIGA / MILP
                                      pipeline described above, run on the filtered legs)
        -> merged Pareto archive, returned alongside the parsed request and any warnings
```

`run_optimization_pipeline.py` was refactored (not rewritten) into two reusable
functions -- `generate_evaluated_legs()` (Steps 1-2: candidate generation, real
XGB fuel prediction, feasibility) and `run_all_algorithms()` (Steps 3-7: the four
optimizers + Pareto merge) -- so `run_optimization_pipeline.main()` and the NLP
adapter call the exact same code path. `python run_optimization_pipeline.py`
still produces identical `final_pareto_fleet_plans.csv` / summary output.

`nlp/optimization_adapter.optimize_from_query(text)` is the single entry point:
it parses the text, builds the request, filters the pipeline's legs, runs the
four optimizers, and returns the Pareto solutions plus the parsed request and
any warnings (e.g. an unmatched port or an unsupported fuel name).

Constraint handling rules (see `nlp/optimization_adapter.py` docstrings for the
full rationale):
- **Route** (origin/destination): fuzzy-matched (rapidfuzz) against the real
  port names already present on the pipeline's generated legs, so a spelling
  variant (e.g. "Yokohama" vs. the source data's "Yohohama") still resolves.
  No match -> the route constraint is skipped and a warning is returned; the
  optimizer still runs across all legs rather than fabricating a match.
- **Vessel type / fuel type**: mapped from the parser's free-text vocabulary
  onto this optimizer's real fleet classes (`fleet_parameters.csv`) and real
  fuel types (`DM`, `RM380`). Terms with no real equivalent (e.g. methanol,
  ammonia, LNG) are left unmapped and reported as a warning rather than
  guessed.
- **Speed / cargo**: the candidate grid is discrete (see `candidate_generator.py`),
  so a requested value selects the *closest available* real candidate value
  per leg instead of fabricating an exact match.
- **Objectives** (`fuel`/`cost`/`ghg`): used only to rank the *existing*
  Pareto-optimal solutions (min-max normalized sum over the requested axes)
  when suggesting a `recommended_solution` -- it never changes how the
  optimizers search.
- Fields the user did not mention (vessel type, fuel type, speed, cargo, or
  objectives) are left completely unconstrained; the optimizer's existing full
  candidate grid and defaults apply.

Run the integration tests with:
`./.venv2/Scripts/python.exe -m pytest tests/test_nlp_optimization_adapter.py -v`
