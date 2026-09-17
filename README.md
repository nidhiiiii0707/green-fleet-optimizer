# Green Fleet Optimization Foundation

This repository currently implements the verified foundation for a later maritime optimizer. It loads the supplied datasets independently, exposes traceable parameter views, validates candidates and explicit constraints, calls the existing XGBoost fuel pipeline, and reports Fuel/Cost/GHG objective availability. It does **not** implement NSGA-II, CQM, QUBO, MO-QIGA, or MILP.

## Architecture

```text
independent source CSVs
  -> named loaders
  -> source-labelled parameter views
  -> Candidate
  -> deterministic feasibility report (passed / failed / unavailable)
  -> candidate/scenario binding (speed, fuel, model completeness)
  -> safe FuelPredictor input boundary
  -> Fuel available; Cost/GHG dimensionally guarded
```

Run tests and demonstrations after installing `requirements.txt`:

```bash
python -m pytest -q
python -m src.main
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
- **Cost:** unavailable by default. The data contains observed voyage operating cost, USD/(tonne nm) scenario references, profitability indices, and relative lifecycle cost versus HFO, but no absolute fuel price per unit compatible with the model output.
- **GHG:** unavailable by default. The data contains kgCO2eq/MJ, kgCO2eq/(tonne nm), carbon-intensity, GWP, and scenario references, but their denominators do not match the undocumented model target.

The objective evaluator accepts future `FuelPrice` and `EmissionFactor` objects only when their denominator exactly matches an explicitly declared prediction unit. It performs no implicit conversion.

To enable production Cost and GHG objectives, provide:

1. the exact physical unit and time basis of `Consumer_Total_MomentaryFuel`;
2. the prediction aggregation method over a voyage (timestamps or sampling interval and voyage/leg identifiers);
3. absolute, dated fuel prices by port and normalized fuel type, expressed per compatible fuel quantity;
4. a documented crosswalk between model fuels (`DM`, `RM 180`, `RM 380`) and reference fuels (`MDO`, `HFO`, LNG/methanol/hydrogen/ammonia variants);
5. either emission factors per exact predicted fuel unit or documented fuel-specific lower-heating values/density needed to convert fuel quantity to MJ;
6. the intended lifecycle boundary (WTT, TTW, or WTW), scenario/year, and factor provenance;
7. for broader cost, explicit port, operating-time, and shore-power tariffs with compatible units.

## Scope boundary

The next stage remains blocked from scientifically defensible multi-objective optimization until candidate-level vessel/route/demand limits and dimensionally compatible Cost/GHG parameters are supplied. No optimization algorithm is included in this stage.
