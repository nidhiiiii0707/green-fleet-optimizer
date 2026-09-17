# Optimization Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the traceable optimization foundation without implementing an optimization algorithm.

**Architecture:** Independent CSV loaders feed six provenance-carrying parameter views. Typed candidate, feasibility, prediction, and objective components communicate through small dataclasses and explicit unavailable states.

**Tech Stack:** Python 3.14, pandas, scikit-learn 1.8.0, XGBoost, joblib, pytest.

**Spec:** `docs/superpowers/specs/2026-09-16-optimization-foundation-design.md`

## Global Constraints

- Do not merge all source datasets into one dataset.
- Do not retrain or modify `models/fuel_xgb_pipeline.joblib`.
- Never pass cargo, load, or draft to XGBoost.
- Never infer engineering capacity from observed maxima.
- Return unavailable with a reason whenever compatible parameters are missing.
- Do not implement NSGA-II, CQM, QUBO, MO-QIGA, or MILP.

---

### Task 1: Independent data loading and traceable parameter views

**Files:**
- Create: `src/__init__.py`, `src/config.py`, `src/data/__init__.py`, `src/data/loaders.py`, `src/data/parameter_builder.py`
- Test: `tests/test_loaders.py`, `tests/test_parameter_builder.py`

**Interfaces:**
- Produces: `DatasetLoader.load(name) -> DataFrame`, `ParameterView(data, provenance)`, `ParameterBuilder.build_all() -> dict[str, ParameterView]`.

- [x] Write loader tests for named independent datasets and missing-name errors; run them and observe missing-module failure.
- [x] Implement path configuration and named, copy-returning CSV loaders; rerun loader tests.
- [x] Write parameter-view tests for all six views, source labels, units, transformations, and non-use of observed maxima; observe failure.
- [x] Implement the six builders and provenance records; rerun parameter tests.

### Task 2: Candidate and feasibility contracts

**Files:**
- Create: `src/optimization/__init__.py`, `src/optimization/candidate.py`, `src/optimization/candidate_generator.py`, `src/optimization/feasibility.py`
- Test: `tests/test_candidate.py`, `tests/test_feasibility.py`

**Interfaces:**
- Produces: `Candidate`, `CandidateGenerator.from_vessel_observation`, `ConstraintStatus`, `ConstraintResult`, `FeasibilityContext`, `FeasibilityReport`, `FeasibilityChecker.check`.

- [x] Write candidate tests for supported optional fields and intrinsic invalid speed/cargo; observe failure.
- [x] Implement immutable candidate validation and a conservative observation-to-candidate generator; rerun tests.
- [x] Write feasibility tests that independently exercise passed, failed, and unavailable results; observe failure.
- [x] Implement explicit-limit checks for speed, cargo capacity, draft/depth, voyage time/deadline, fuel availability/compatibility, and port capacity; rerun tests.

### Task 3: Existing-model prediction boundary

**Files:**
- Create: `src/models/__init__.py`, `src/models/fuel_predictor.py`
- Test: `tests/test_fuel_predictor.py`

**Interfaces:**
- Produces: `FuelPredictor.load()`, `FuelPredictor.predict(DataFrame) -> Series`, raw/engineered input-column properties.

- [x] Write integration tests for artifact metadata, raw rows, engineered rows, missing inputs, and cargo/load/draft exclusion; observe failure.
- [x] Implement custom-transformer import, artifact loading, exact schema validation, safe frame selection, and prediction; rerun tests.

### Task 4: Objective availability contract

**Files:**
- Create: `src/optimization/objectives.py`
- Test: `tests/test_objectives.py`

**Interfaces:**
- Produces: `ObjectiveStatus`, `ObjectiveResult`, `ObjectiveEvaluation`, `ObjectiveEvaluator.evaluate`.

- [x] Write tests proving Fuel is available and current Cost/GHG are unavailable with reasons; observe failure.
- [x] Implement pluggable price/emission interfaces with dimensional guards and no defaults; rerun tests.

### Task 5: Smoke flows, documentation, and dependency definition

**Files:**
- Create: `src/main.py`, `tests/test_smoke.py`, `README.md`
- Modify: `requirements.txt`

**Interfaces:**
- Produces: executable `python -m src.main` with two deterministic smoke demonstrations.

- [x] Write smoke integration tests for dataset-row prediction and candidate/feasibility/prediction flow; observe failure.
- [x] Implement the command-line smoke flows; rerun smoke tests.
- [x] Document architecture, dataset contributions, constraints, model limitation, objectives, and exact missing data.
- [x] Pin runtime/test dependencies compatible with the artifact.

### Task 6: Verification

**Files:** All created files.

- [x] Install requirements in the project virtual environment.
- [x] Run the complete pytest suite and inspect the full result.
- [x] Run both smoke demonstrations and inspect outputs.
- [x] Compile all Python modules and inspect Git diff/status for accidental or out-of-scope changes.
- [x] Recheck every user requirement against implementation evidence.
