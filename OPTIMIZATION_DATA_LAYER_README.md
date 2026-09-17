# Optimization Data Layer — README

This is a pure DATA-PREPARATION layer for the fleet/vessel routing and fuel/GHG
optimization project. It does not touch NSGA-II, QUBO, CQM, MO-QIGA code, and it
does not retrain the existing fuel-consumption ML model.

## Status convention

Every derived numeric value is tagged one of:
- **REAL** — copied directly from a source file with no computation.
- **DERIVED** — computed only from REAL values, via a documented formula
  (see `derived_relationships.csv`).
- **SCENARIO_INPUT** — the literal string, written wherever a genuinely required
  optimization input has NO real source in the processed datasets. No numeric
  value is ever invented for these cells.

In per-row/long-format files, status is given in a `status` / `*_status` column
next to the value. In `optimization_master.csv`, every value column `<X>` has a
companion column `<X>__STATUS` holding REAL / DERIVED / SCENARIO_INPUT.

## Files (in build order)

1. `optimization_data_audit.csv` — every real source CSV inspected, with row count,
   columns+dtypes, description, and classification (fleet/vessel/port/route/cargo/
   fuel/cost/ghg/ais/lookup/reference).
2. `optimization_role_mapping.csv` — maps source columns to their role in the
   optimization data model, tagged REAL/DERIVED/SCENARIO_INPUT.
3. `port_master_derived.csv` — union of real port coordinates from
   `world_ports_master.csv`, `WPI_model_ready.csv`, `fig2_port_coordinates.csv`.
4. `route_derived.csv` — pairwise combinations of the 13 real named ports in
   `fig2_port_coordinates.csv` (a real route/map figure export), with haversine
   distance (DERIVED from REAL coordinates) and voyage time (DERIVED from that
   distance and a REAL fleet-wide mean speed proxy from `ship_performance.csv`).
   No real origin-destination traffic-volume data exists for these specific pairs,
   so `cargo_tonnage` is SCENARIO_INPUT.
5. `cargo_demand_derived.csv` — real Indian port cargo traffic (annual from
   `india_port_traffic_combined.csv`, monthly from `india_cargo_traffic_monthly.csv`).
6. `fleet_parameters.csv` — three clearly separated segment types:
   - `individual_vessel` = the single real vessel "Poseidon" (per-timestep telemetry
     aggregated to speed statistics).
   - `fleet_segment_ship_type` = `ship_performance.csv` grouped by Ship_Type (no
     vessel ID exists in that file, so granularity is conservatively treated as
     fleet-segment, not confirmed individual vessels).
   - `AGGREGATE_FLEET_STOCK` = `fleet_combined.csv` DWT stock sums by vessel
     category — explicitly NOT individual vessels.
7. `fuel_cost_parameters.csv` — real operational cost/revenue stats (ship_performance.csv),
   real fuel consumption stats (Poseidon), real relative fuel cost vs HFO
   (`fig5_lifecycle_cost_vs_hfo.csv`). Absolute fuel price ($/tonne) and carbon
   price are SCENARIO_INPUT — no real source found.
8. `ghg_parameters.csv` — real/derived GHG and CII reference values per fuel from
   the fig1/fig3/fig5/fig9 reference-chart exports (literature/report data, not
   vessel-specific).
9. `ais_optimization_schema.csv` — documents the AIS field dictionary, navigation
   status lookup, required-fields list, and vessel-type lookup. These are
   **SCHEMA/LOOKUP TABLES ONLY** — there are no real AIS position observations
   anywhere in the processed dataset.
10. `derived_relationships.csv` — every derivation formula used, its real inputs,
    and which output file/column it produced.
11. `optimization_master.csv` — one row per derived route, joining distance,
    voyage time, fleet speed proxy, GHG/CII reference values, with SCENARIO_INPUT
    placeholders for cargo tonnage, fuel price, and carbon price.

## Key data-quality notes / known gaps (documented, not silently filled)

- No real vessel-to-vessel or port-to-port observed voyage/route log exists in the
  processed data. Routes are geography-only (real port coordinates + haversine),
  not real sailed tracks or real OD traffic volumes.
- No real DWT (deadweight tonnage) exists for any individual vessel record, so
  cargo/DWT load ratios were never re-derived; where the source already provides
  a load percentage (`ship_performance.csv: Average_Load_Percentage`) it is used
  as-is (REAL), not recomputed.
- `ship_performance.csv` has no vessel ID column, so its rows are treated at
  fleet-segment (Ship_Type) granularity, not individual-vessel granularity.
- `fleet_combined.csv` is fleet-stock aggregate data by category/year — never
  treated as individual vessels.
- The `ais_processed_support_files` / `ais_reference` CSVs are schema/lookup
  tables for a planned AIS ingestion pipeline — never treated as AIS observations.
- Absolute fuel prices and carbon prices are not present anywhere in the
  processed data — both are marked SCENARIO_INPUT throughout.
