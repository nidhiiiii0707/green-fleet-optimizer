# Optimization Foundation Design

## Scope

Build the data, candidate, feasibility, fuel-prediction, and objective-evaluation foundation for later maritime optimization. This stage explicitly excludes NSGA-II, CQM, QUBO, MO-QIGA, and MILP.

## Evidence and constraints

- Source datasets remain separate and retain their own meaning and granularity.
- Parameter views carry field-level provenance: source dataset, original column, known unit, and transformation.
- Observations are not converted into engineering limits. In particular, maxima in cargo, speed, traffic, or vessel counts do not become capacities.
- WPI depth values are coded categories without a supplied metre mapping, so they cannot be compared with draft in metres.
- WPI `ELECTRICAL` is an electrical-service indicator, not evidence of shore-power capability.
- The fuel model predicts `Consumer_Total_MomentaryFuel`. Its physical time/mass unit is not documented.
- Cargo, load, and vessel draft were not fuel-model training features and must not enter XGBoost.
- Cost and GHG remain unavailable unless compatible price/emission parameters and unit conversions are explicitly supplied.

## Architecture

`src/config.py` resolves repository paths. `src/data/loaders.py` loads each named CSV independently. `src/data/parameter_builder.py` creates six traceable parameter views without cross-source merging: ports, port activity, cargo history, vessel observations, fleet statistics, and fuel/GHG reference.

`Candidate` stores planning decisions supported by the available schemas: vessel or vessel class, origin, destination/route, speed, cargo allocation, fuel/engine type, draft, and optional shore-power state. Fields may be unknown, and validation only enforces intrinsic rules such as non-negative cargo and positive speed.

`FeasibilityChecker` evaluates a fixed catalogue of constraints. Each result is `passed`, `failed`, or `unavailable`; it evaluates a constraint only when required, unit-compatible limits are supplied. It never derives limits from observations.

`CandidateFuelEvaluator` binds a candidate to the model scenario, checks shared speed and fuel decisions where comparable, verifies model-input completeness, and prevents a feasible candidate from being scored with a different scenario.

`FuelPredictor` imports the repository's `FuelTypeEngineer` before `joblib.load`, validates either the minimal raw scenario schema or the 34-column engineered schema, creates a safe model frame, and invokes the existing pipeline. It never passes cargo/load/draft columns to XGBoost.

`ObjectiveEvaluator` returns structured Fuel, Cost, and GHG results. Fuel uses XGBoost. Cost and GHG use pluggable, explicitly unit-labelled parameters when available; the repository's current inputs are reported unavailable rather than combined dimensionally.

## Parameter views

- `ports`: WPI port identity, coordinates, coded depth/max-vessel fields, service indicators, and fuel-oil/diesel availability.
- `port_activity`: historical Indian traffic plus global observed vessel activity, source-labelled and kept as separate records.
- `cargo_history`: historical monthly aggregate cargo traffic; not shipment demand.
- `vessel_observations`: ship-performance observations; not a vessel registry.
- `fleet_statistics`: aggregate fleet counts, DWT, and GT by year/category; not individual capacities.
- `fuel_ghg_reference`: long-form, source-labelled GHG, energy, scenario, and relative-cost reference records. Values keep their source units and are not treated as operational prices.

Each view is a `ParameterView` containing a DataFrame and a provenance table with `parameter`, `source_dataset`, `original_column`, `unit`, and `transformation`.

## Feasibility behavior

Supported checks accept explicit operational limits through `FeasibilityContext`: speed bounds, vessel cargo capacity, vessel draft and port depth (metres), route distance and deadline, fuel availability, fuel/vessel compatibility, and port flow/capacity. Missing candidate values, limits, or compatible units return `unavailable` with a precise reason. Supplied limits produce deterministic `passed` or `failed` outcomes.

A candidate is usable for fuel evaluation when no constraint has failed and its fuel scenario is complete. Unavailable future constraints remain visible and do not fabricate infeasibility.

## Testing and demonstration

Tests cover independent loading, view/provenance creation, candidate validation, all three feasibility outcomes, raw and engineered fuel inputs, exclusion of cargo/load/draft, objective availability, and missing data. Two smoke flows demonstrate dataset-row prediction and candidate-to-feasibility-to-prediction.
