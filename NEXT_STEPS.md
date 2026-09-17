# NEXT STEPS / Handoff Notes

## What is COMPLETE
- Full REAL/DERIVED/SCENARIO_INPUT-tagged data layer (pre-existing, Stages 1-3).
- Stage 4: formal problem definition (`mathematical_formulation.md`, `decision_variables.csv`,
  `constraints.csv`, `objectives.csv`), input validator, unit-chain checker.
- Stage 5: fuel model adapter (`fuel_model_adapter.py`, un-retrained), guarded unit
  conversions (`unit_conversion.py`), full objective evaluator (`objective_evaluator.py`).
- Stage 6-7: candidate generation (252 prototype candidates, 6 legs) and deterministic hard
  feasibility checking with human-readable reasons.
- Stage 8-11: NSGA-II, QUBO (simulated annealing), MO-QIGA (classical quantum-inspired
  simulation), exact MILP reference — all run on the identical scenario/seed.
- Stage 12: algorithm comparison (hypervolume, IGD-vs-union-front, runtime, feasibility,
  diversity) + 4 comparison plots.
- Stage 13: SCENARIO_INPUT sensitivity sweep (fuel price, emission factor, cargo load,
  deadline).
- Stage 14-15: end-to-end driver (`run_optimization_pipeline.py`) and final outputs
  (`final_pareto_fleet_plans.csv`, `FINAL_OPTIMIZATION_REPORT.md`).
- 19 passing pytest tests (unit conversion, feasibility checker, QUBO Q-matrix validation).
- Environment fixed and pinned: `xgboost==3.0.0` (3.4.1 fails to load the model artifact).

## What is SCIENTIFICALLY VALIDATED vs PROTOTYPE-ONLY
**Validated / real:**
- The fuel model itself (XGBoost, test R2≈0.97 on its own held-out split, per the stored
  artifact metadata) — used exactly as trained, never retrained.
- Route geometry (real port coordinates, haversine distance), vessel speed bounds (real
  observed min/max per ship type), feasibility-check logic (deterministic, unit-tested).
- Algorithm correctness: NSGA-II/QUBO/MO-QIGA/MILP all search the identical decision space
  and objective functions, verified by direct comparison (`algorithm_comparison.csv`) and the
  MILP exact reference consistently finding the best or near-best fuel value.

**Prototype-only / not scientifically validated as real-world accurate:**
- Absolute Cost and GHG magnitudes (SCENARIO_INPUT fuel price, emission factor, and an
  assumed 1-hour fuel-rate sampling interval — the real telemetry has no timestamp column).
- Per-route cargo demand assignment (no real OD tonnage exists for these specific port pairs).
- Draft-vs-port-depth and port-capacity constraints (UNAVAILABLE everywhere; no physical port
  depth in metres or rated port capacity in the processed data).
- Vessel-fuel compatibility and port fuel availability (assumed, not measured).
- Scenario scale (252 candidates / 6 legs) is a prototype size chosen for runtime, not a
  production fleet.

## What REMAINS (future work)
- A real fleet-scheduling extension where a finite vessel pool serves multiple legs over time
  (this prototype treats each leg independently — no shared-vessel capacity-over-time model).
- Sourcing real absolute fuel prices, carbon prices, physical port depths, and rated port
  capacities to convert the SCENARIO_INPUT constraints/objectives above into REAL ones.
- Determining the true physical unit and sampling interval of `Consumer_Total_MomentaryFuel`
  from the original data provider, to remove the ASSUMED_UNIT caveat entirely.
- Scaling candidate generation and re-tuning NSGA-II/QUBO/MO-QIGA population/generation counts
  for a production-size fleet and route network.

## Main entry points
- `run_optimization_pipeline.py` — the full end-to-end pipeline (recommended starting point).
- `run_nsga2.py`, `run_qubo.py`, `run_mo_qiga.py`, `run_milp.py` — individual algorithms.
- `algorithm_comparison.py` — cross-algorithm metrics + plots (run the four above first, or
  it recomputes internally via `run_all()`).
- `robustness_analysis.py` — SCENARIO_INPUT sensitivity sweep.
- `optimization_input_validator.py` — sanity-checks the data layer before any run.

## Exact command to rerun the full pipeline
```
cd green-fleet-optimizer
./.venv2/Scripts/python.exe -m pip install -r requirements.txt   # first time only
./.venv2/Scripts/python.exe run_optimization_pipeline.py
```
(On the `.venv2` interpreter created for this task — the repo's original `.venv` has broken
`python3.14` symlinks. Any Python 3.11+ environment with `requirements.txt` installed, and
`xgboost` pinned to `3.0.0` specifically, will work identically.)
