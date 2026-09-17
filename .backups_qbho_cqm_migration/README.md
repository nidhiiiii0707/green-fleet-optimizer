# Green Fleet Optimization Foundation

This repository implements a full, working maritime fleet optimization pipeline. It loads the supplied datasets independently, exposes traceable parameter views, validates candidates against explicit feasibility constraints, calls the existing (un-retrained) XGBoost `XGBRegressor` fuel model, converts predictions into Fuel/Cost/GHG objectives, and searches the resulting decision space with four independent optimizers -- **NSGA-II**, **QUBO-SA** (classical simulated annealing), **MO-QIGA** (a classical simulation of a quantum-inspired heuristic), and an exact **MILP** reference -- merging their outputs into one Pareto-optimal fleet-plan archive. A natural-language front end (`nlp/`) sits in front of this pipeline and translates plain-English fleet requests into the same structured candidates/constraints the pipeline already consumes.

See [FINAL_OPTIMIZATION_REPORT.md](FINAL_OPTIMIZATION_REPORT.md) for the full data-provenance and results write-up, and [mathematical_formulation.md](mathematical_formulation.md) for the exact objective/constraint formulation used by each optimizer.

## Architecture

```text
independent source CSVs
  -> named loaders (data_layer.py)
  -> source-labelled parameter views
  -> Candidate (candidate_generator.py / candidate_schema.py)
  -> deterministic feasibility report (feasibility_checker.py: passed / failed / unavailable)
  -> candidate/scenario binding (speed, fuel, model completeness)
  -> real XGBoost XGBRegressor fuel prediction (fuel_model_adapter.py, models/fuel_xgb_pipeline.joblib)
  -> Fuel/Cost/GHG objectives (objective_evaluator.py, SCENARIO_INPUT price/emission factors)
  -> NSGA-II / QUBO-SA / MO-QIGA / MILP (run_optimization_pipeline.py)
  -> merged Pareto archive -> final_pareto_fleet_plans.csv
```

with an optional natural-language front end ahead of candidate filtering:

```text
natural language request
  -> nlp/parser.py                       (origin/destination, vessel type, fuel type, speed, cargo, objectives)
  -> nlp/optimization_adapter.py         (build_optimization_request + filter_legs: constrains the
                                           SAME candidates the pipeline already generates -- never invents one)
  -> run_optimization_pipeline.run_all_algorithms()   (the unmodified four-optimizer pipeline above)
  -> Pareto fleet plans + parsed request + warnings
```

Run tests and demonstrations after installing `requirements.txt` (the optimizer/model stack targets the `.venv2` environment, XGBoost 3.0.0):

```bash
./.venv2/Scripts/python.exe -m pytest -q
./.venv2/Scripts/python.exe run_optimization_pipeline.py

# natural-language entry point
./.venv2/Scripts/python.exe -c "from nlp.optimization_adapter import optimize_from_query; print(optimize_from_query('Find a low emission route from Yokohama to Singapore carrying 5000 tonnes at 18 knots'))"
```

## Parameter views

Every `ParameterView` contains a `data` table and a `provenance` table. Provenance records the processed parameter, source dataset, original column, known unit, and transformation.

| View | Supported content | Important limitation |
|---|---|---|
| `ports` | WPI identity, coordinates, harbor/depth/max-vessel codes, fuel/diesel/electrical service indicators | Depth and vessel-size values are codes, not physical limits; electrical service is not treated as shore power |
| `port_activity` | Historical Indian port traffic and global observed vessel counts as source-separated long records | Activity is not rated port capacity |
| `cargo_history` | Monthly/FYTD aggregate coastal, overseas, and total cargo history | Not shipment demand; no origin-destination pair or deadline |
| `vessel_observations` | Ship class, route class, engine, speed, distance, draft, cargo, weather, cost, and operational observations | No vessel identifier, rated capacity, or operating envelope |
| `fleet_statistics` | Aggregate annual fleet counts, DWT, and GT by category, with row-level unit labels | Not individual vessel specifications; source scaling for DWT/GT is undocumented |
| `fuel_ghg_reference` | Fuel/scenario GHG, CII, energy, economic, relative-cost, and probability reference records with source units | Fuel taxonomies/scenarios differ; records are not automatically compatible with XGBoost output |

No parameter view performs a cross-source key join or builds a giant combined dataset.

## Dataset contributions

| Dataset | Optimization-relevant information |
|---|---|
| `CPS_Poseidon_model_ready (1).csv` | XGBoost scenarios: speed, heading/bearing, sea-floor depth, detailed weather/ocean conditions, raw fuel flags, and measured instantaneous fuel target |
| `WPI_model_ready.csv` | Ports, coordinates, coded depths/max-vessel class, navigation/cargo services, fuel-oil/diesel/electrical service indicators |
| `ship_performance.csv` | Vessel-class observations, route class, speed, distance, draft, cargo, engine type, weather class, cost/revenue, turnaround and load percentage |
| `fleet_combined.csv` | Historical aggregate fleet DWT, GT, and vessel counts by segment/category |
| `india_port_traffic_combined.csv` | Historical loaded/unloaded coastal/overseas/total traffic by port |
| `india_cargo_traffic_monthly.csv` | 2026 monthly and FYTD aggregate cargo traffic by major port or non-major-port state |
| `world_ports_master.csv` | Port coordinates, observed vessel counts/types, trade industries and national import/export shares |
| `fig1_ghg_cii_by_fuel.csv` | Source-labelled GHG/CII-like values by fuel; source units/scenario blocks are not fully documented |
| `fig1_scenario_comparison.csv` | Current/FuelEU/IMO scenario comparisons; one expected source row was unreliably recovered according to the manifest |
| `fig3_fuel_perspectives_by_power_source.csv` | Climate, environmental, energy, and economic values per tonne-nautical-mile by fuel/power source |
| `fig4_national_decarbonisation_scenarios.csv` | National/scenario CO2eq projections; repository content covers only EU and Malaysia despite a broader manifest description |
| `fig5_ghg_pathway_scenarios.csv` | Scenario/year/fuel GHG intensity in kgCO2eq/MJ |
| `fig5_lifecycle_cost_vs_hfo.csv` | Relative lifecycle cost ratios versus HFO, not absolute prices |
| `fig9_fuel_probability_distributions.csv` | Samples for GWP, carbon intensity, energy consumption and profitability by fuel |
| `fig2_country_renewable_capacity.csv` | Country renewable-capacity context; not a direct optimization constraint |
| `fig2_port_coordinates.csv` | Coordinates for 13 figure-specific ports; not joined because names contain source inconsistencies/typos |
| `fig2_regional_power_mix.csv` | Regional electricity mix context; no explicit port-to-region optimization mapping |
| `fig7_containership_sales_cgt.csv` / `fig7_containership_sales_numships.csv` | Historical sales context; no candidate or constraint parameters |

## Fuel model contract

The immutable artifact predicts `Consumer_Total_MomentaryFuel`. Its physical unit and time basis are not documented.

The pipeline's 34 XGBoost inputs are:

```text
Ship_SpeedOverGround, Ship_SpeedThroughWater, Ship_Heading, Ship_Bearing,
Environment_SeaFloorDepth, Weather_DiffuseRadiation,
Weather_DirectNormalIrradiance, Weather_DirectRadiation,
Weather_OceanCurrentDirection, Weather_OceanCurrentVelocity,
Weather_Precipitation, Weather_RelativeHumidity2M,
Weather_ShortwaveRadiation, Weather_SunshineDuration,
Weather_SurfacePressure, Weather_SwellWaveDirection,
Weather_SwellWaveHeight, Weather_SwellWavePeakPeriod,
Weather_SwellWavePeriod, Weather_Temperature2M,
Weather_WaveDirection, Weather_WaveHeight, Weather_WavePeriod,
Weather_WeatherCode, Weather_WindDirection10M, Weather_WindGusts10M,
Weather_WindSpeed10M, Weather_WindWaveDirection,
Weather_WindWaveHeight, Weather_WindWavePeakPeriod,
Weather_WindWavePeriod, Boiler_FuelType_RM380,
GenEngine_RM380_Count, GenEngine_DM_Count
```

The last three fields are generated internally from one boiler RM380 flag and five RM380 plus five DM generator flags. `FuelPredictor` also accepts these three fields precomputed. It selects only trained fields before prediction, so extra candidate cargo/load/draft values never reach XGBoost.

The serving boundary rejects duplicate columns, non-numeric/non-finite inputs, non-binary raw fuel flags, non-integral or out-of-range engine counts, and mutually inconsistent fuel encodings. The joblib file is trusted executable input and is loaded only with its required companion transformer. Verified checksums are:

```text
fuel_xgb_pipeline.joblib  88934777becc221eb7c8f764f68575381ef7002a721c53c9d070bbb2d3e471a0
fuel_pipeline_utils.py    b525e477eaa51601b2e56127288f6fe1612b7c3b4a72d0dd189ebf484b8a7a3f
```

### Cargo/load limitation

True cargo, load, and vessel draft were not training features. Cargo remains a candidate/feasibility variable, and draft remains a feasibility variable when physical limits become available, but neither directly changes the current prediction. No artificial cargo multiplier or load coefficient is implemented.

## Feasibility

The checker has deterministic branches for:

- vessel speed bounds in knots;
- cargo allocation versus rated vessel capacity in tonnes;
- vessel draft versus physical port depth in metres;
- distance/speed voyage time versus deadline in hours;
- port fuel availability using an explicit common fuel taxonomy;
- vessel/fuel compatibility using an explicit compatibility mapping;
- planned aggregate port flow versus rated port capacity.

Each check returns `passed`, `failed`, or `unavailable`. With the supplied repository alone, the engineering limits needed for these checks are unavailable: there are no vessel-level rated capacities or speed envelopes, physical WPI depth values in metres, shipment deadlines/routes, fuel-taxonomy crosswalk and compatibility matrix, or rated port throughput capacities. Observed maxima are never substituted.

`CandidateFuelEvaluator` binds a candidate to the exact scenario scored by XGBoost. It verifies candidate speed against `Ship_SpeedOverGround`, checks a single DM/RM380 decision only when all modeled consumers can be compared, validates scenario completeness, and blocks prediction on mismatches or failed feasibility checks. A missing single-fuel decision remains explicitly unavailable while retaining the supplied observed fuel mix; an explicit unsupported fuel decision blocks prediction, and no fuel-taxonomy mapping is guessed.

## Objectives

- **Fuel:** available from XGBoost as `Consumer_Total_MomentaryFuel`; physical unit/time basis remains undocumented.
- **Cost:** unavailable *from the raw model/data alone*. The data contains observed voyage operating cost, USD/(tonne nm) scenario references, profitability indices, and relative lifecycle cost versus HFO, but no absolute fuel price per unit compatible with the model output.
- **GHG:** unavailable *from the raw model/data alone*. The data contains kgCO2eq/MJ, kgCO2eq/(tonne nm), carbon-intensity, GWP, and scenario references, but their denominators do not match the undocumented model target.

To make Cost/GHG usable for optimization anyway, the running pipeline (`data_layer.py`) supplies two explicitly labelled `SCENARIO_INPUT` conversion tables -- standard order-of-magnitude bunker fuel prices (USD/tonne) and IMO/IPCC-reference CO2 emission factors (kgCO2/tonne fuel), one entry per real fuel type (`DM`, `RM380`) -- and multiplies them against the real predicted voyage fuel quantity. These are declared assumptions, not measured values; see `FINAL_OPTIMIZATION_REPORT.md` for the exact figures and their provenance. The objective evaluator performs no implicit unit conversion beyond this explicit, documented multiplication.

The items below remain true prerequisites for replacing those `SCENARIO_INPUT` figures with production-grade, dimensionally verified Cost/GHG objectives:

1. the exact physical unit and time basis of `Consumer_Total_MomentaryFuel`;
2. the prediction aggregation method over a voyage (timestamps or sampling interval and voyage/leg identifiers);
3. absolute, dated fuel prices by port and normalized fuel type, expressed per compatible fuel quantity;
4. a documented crosswalk between model fuels (`DM`, `RM 180`, `RM 380`) and reference fuels (`MDO`, `HFO`, LNG/methanol/hydrogen/ammonia variants);
5. either emission factors per exact predicted fuel unit or documented fuel-specific lower-heating values/density needed to convert fuel quantity to MJ;
6. the intended lifecycle boundary (WTT, TTW, or WTW), scenario/year, and factor provenance;
7. for broader cost, explicit port, operating-time, and shore-power tariffs with compatible units.

## Natural-language integration

`nlp/optimization_adapter.optimize_from_query(text)` translates a plain-English
fleet request into the constraints/objectives above and runs the unmodified
optimizer on them:

- **Route** (origin/destination), **vessel type**, **fuel type**, **speed**,
  **cargo**, and **objectives** (`fuel`/`cost`/`ghg`) can all be expressed in
  natural language and are extracted by `nlp/parser.py`.
- The adapter only ever *filters* the candidates this pipeline already
  generates -- it never fabricates a candidate, a vessel class, a fuel type,
  or a numeric value the optimizer wasn't already going to consider.
- Route names are fuzzy-matched against the real port names in the data;
  vessel/fuel names are mapped only onto the real fleet classes
  (`fleet_parameters.csv`) and real fuel types (`DM`, `RM380`) this pipeline
  actually models -- other vessel/fuel words (e.g. methanol, ammonia, LNG)
  have no real equivalent here and are left unconstrained with a warning
  instead of being guessed.
- Speed/cargo constrain the search to the *closest available* real candidate
  value on the discrete candidate grid (`candidate_generator.py`), since that
  grid is finite.
- A field the user doesn't mention is left completely unconstrained; the
  optimizer's existing full candidate grid and defaults apply.
- Objectives only re-rank the *already Pareto-optimal* solutions the four
  optimizers produced -- they never change how those optimizers search.

## Current status

Implemented and passing (`./.venv2/Scripts/python.exe -m pytest -q`):

- Real/derived candidate generation, deterministic feasibility screening, and
  the real (un-retrained) XGBoost `XGBRegressor` fuel model, exactly as
  described above.
- All four optimizers -- **NSGA-II** (`nsga2_optimizer.py`), **QUBO-SA**
  (`qubo_model.py` / `qubo_builder.py`, classical simulated annealing),
  **MO-QIGA** (`mo_qiga.py`, a classical simulation of a quantum-inspired
  heuristic), and **MILP** (`milp_model.py`, exact reference) -- run on the
  identical decision space and merge into one Pareto archive
  (`run_optimization_pipeline.py`).
- The natural-language front end described above, tested end-to-end from raw
  text through to Pareto fleet plans (`tests/test_nlp_optimization_adapter.py`).

Still true limitations, carried over unchanged from the sections above:

- Only the fuel types and vessel classes actually present in this data layer
  (`DM`/`RM380`; `Bulk Carrier`/`Container Ship`/`Fish Carrier`/`Tanker`) are
  ever selected by the optimizer or the NLP layer -- nothing is fabricated
  for unsupported values.
- Cost and GHG objectives depend on the explicitly labelled `SCENARIO_INPUT`
  price/emission-factor assumptions described above, not on measured
  fuel-price or emissions data.
- QUBO-SA and MO-QIGA are classical algorithms (simulated annealing / a
  classical simulation of a quantum-inspired heuristic, respectively); neither
  runs on, nor claims to run on, quantum hardware anywhere in this repository.
- The candidate set remains prototype-scale (252 candidates / 6 legs / 4
  vessel classes), chosen to keep all four optimizers' runtimes manageable for
  validation, not a production fleet size.
