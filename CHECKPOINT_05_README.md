# Checkpoint 5 — Full Optimization Package

Everything from Checkpoint 4, plus Stages 8-15: NSGA-II, QUBO (simulated annealing,
classical), MO-QIGA (classical simulation of a quantum-inspired heuristic), exact MILP
reference, algorithm comparison (metrics + plots), robustness/sensitivity sweep, the
end-to-end driver, and final outputs.

## Reproduce everything
```
./.venv2/Scripts/python.exe run_optimization_pipeline.py   # end-to-end (fast path)
./.venv2/Scripts/python.exe run_nsga2.py
./.venv2/Scripts/python.exe run_qubo.py
./.venv2/Scripts/python.exe run_mo_qiga.py
./.venv2/Scripts/python.exe run_milp.py
./.venv2/Scripts/python.exe algorithm_comparison.py
./.venv2/Scripts/python.exe robustness_analysis.py
./.venv2/Scripts/python.exe -m pytest tests/ -q
```
Environment: `requirements.txt` (`xgboost==3.0.0` is required -- 3.4.1 fails to load the
model artifact; see README.md / FINAL_OPTIMIZATION_REPORT.md).

## Key outputs in this zip
- `final_pareto_fleet_plans.csv`, `FINAL_OPTIMIZATION_REPORT.md` (Stage 15)
- `algorithm_comparison.csv/.md`, `comparison_plots/*.png` (Stage 12)
- `robustness_results.csv`, `robustness_report.md` (Stage 13)
- `nsga2_*`, `qubo_results.csv`, `mo_qiga_*`, `milp_results.csv` (Stages 8-11)
- `run_optimization_pipeline.py` + `run_optimization_pipeline_summary.json` (Stage 14)
- All Stage 4-7 files (see CHECKPOINT_04_README.md)
- `tests/` (19 passing pytest tests covering unit conversion, feasibility, QUBO Q-matrix)

## REAL / DERIVED / SCENARIO_INPUT — final summary
See `FINAL_OPTIMIZATION_REPORT.md` for the full breakdown. In one line: decision-variable
DOMAINS (speeds, routes, fuel types) are REAL/DERIVED; the fuel PREDICTION is a real model
output; COST and GHG are SCENARIO_INPUT-dependent and explicitly caveated as not verified
real-world accurate; MO-QIGA and QUBO are classical computations, never quantum hardware.
