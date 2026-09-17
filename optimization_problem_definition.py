"""STAGE 4 -- Formal definition of the constrained fleet-optimization problem.

Running this file (``python optimization_problem_definition.py``) regenerates
decision_variables.csv, constraints.csv and objectives.csv from the tables
below, so the CSVs and this file can never silently drift apart.

Scope decision (why shore power and vessel activation are excluded/limited):
  - Shore power: NO real or derived data anywhere in the optimization data
    layer describes shore-power availability, cold-ironing capability, or
    port electrical infrastructure. Including it would require inventing a
    number. EXCLUDED as a decision variable.
  - Vessel activation: not modelled as a separate binary, because in this
    prototype's leg-based formulation every leg is always served by exactly
    one (vessel, route, speed, fuel, cargo) tuple -- "activation" is implicit
    in whether a vessel class is chosen for a leg at all. A fleet-scheduling
    extension (multiple legs sharing a finite vessel pool) is future work
    (see FINAL_OPTIMIZATION_REPORT.md limitations).
  - Draft vs port depth / port capacity: included as CONSTRAINTS but their
    real-data status is SCENARIO_INPUT / UNAVAILABLE almost everywhere,
    because no physical port depth (metres) or rated port throughput
    capacity exists in the processed data (WPI depth codes are not physical
    metres; cargo_demand_derived.csv is observed annual traffic, not a
    capacity limit). The checker reports these as UNAVAILABLE rather than
    fabricating a pass/fail.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass, asdict

ROOT = __import__("pathlib").Path(__file__).resolve().parent


@dataclass(frozen=True)
class DecisionVariable:
    name: str
    symbol: str
    domain: str
    data_source: str
    status: str
    justification: str


DECISION_VARIABLES = [
    DecisionVariable(
        "vessel_class", "v", "categorical: {Bulk Carrier, Container Ship, Fish Carrier, Tanker}",
        "fleet_parameters.csv (segment_type=fleet_segment_ship_type)", "REAL",
        "Real ship-type categories observed in ship_performance.csv with real speed/draft/cargo stats per class.",
    ),
    DecisionVariable(
        "route", "r", "categorical: real port-pair rows of route_derived.csv",
        "route_derived.csv", "DERIVED",
        "Real port coordinates (fig2_port_coordinates.csv) with haversine-derived distance/voyage time.",
    ),
    DecisionVariable(
        "speed_knots", "s", "continuous/grid, bounded by [speed_min_kn, speed_max_kn] of the chosen vessel_class",
        "fleet_parameters.csv", "REAL",
        "Observed min/max speed per ship type from ship_performance.csv are real operating bounds.",
    ),
    DecisionVariable(
        "fuel_type", "f", "categorical: {DM, RM380}",
        "CPS_Poseidon_model_ready.csv fuel-type one-hot flags (via fuel_pipeline_utils)", "REAL",
        "The two fuel families actually observed/engineered as model inputs in the trained XGB pipeline.",
    ),
    DecisionVariable(
        "cargo_tons", "c", "continuous, bounded by [0, vessel capacity_tons]",
        "fleet_parameters.csv (DERIVED capacity) + cargo_demand_derived.csv (real Indian port aggregate demand as a reference target)",
        "DERIVED / SCENARIO_INPUT",
        "Capacity per vessel class is DERIVED from two real means (see data_layer.py); route-level cargo assignment target is SCENARIO_INPUT because no real OD (origin-destination) tonnage exists for the specific synthetic route pairs.",
    ),
]

EXCLUDED_VARIABLES = [
    ("vessel_activation", "Not modelled as a separate binary in this leg-based prototype; implicit in per-leg vessel_class choice. See module docstring."),
    ("shore_power", "No real/derived shore-power or cold-ironing data exists anywhere in the data layer; would require an invented number. EXCLUDED."),
]


@dataclass(frozen=True)
class Constraint:
    name: str
    formula: str
    data_source: str
    status: str


CONSTRAINTS = [
    Constraint("cargo_demand_fulfillment", "sum(cargo_tons over legs serving a port) >= demand_target[port]",
               "cargo_demand_derived.csv (real annual Indian port traffic used as an illustrative demand target)", "REAL/SCENARIO_INPUT"),
    Constraint("vessel_capacity_dwt", "cargo_tons <= capacity_tons[vessel_class]",
               "DERIVED capacity_tons (data_layer.py) from fleet_parameters.csv means", "DERIVED"),
    Constraint("vessel_availability_eligibility", "vessel_class in AVAILABLE_CLASSES (all 4 observed classes assumed always available)",
               "fleet_parameters.csv", "SCENARIO_INPUT (availability calendar not present)"),
    Constraint("vessel_fuel_compatibility", "fuel_type in SCENARIO_VESSEL_FUEL_COMPATIBILITY[vessel_class]",
               "data_layer.py SCENARIO_VESSEL_FUEL_COMPATIBILITY", "SCENARIO_INPUT (no real compatibility table)"),
    Constraint("speed_bounds", "speed_min_kn[vessel_class] <= speed_knots <= speed_max_kn[vessel_class]",
               "fleet_parameters.csv (REAL observed min/max)", "REAL"),
    Constraint("route_feasibility", "route in route_derived.csv (real port-pair rows only)",
               "route_derived.csv", "DERIVED"),
    Constraint("voyage_deadline", "distance_nm / speed_knots <= deadline_hours",
               "route_derived.csv distance_nm (DERIVED); deadline_hours = SCENARIO_VOYAGE_DEADLINE_MULTIPLIER * nominal voyage time", "DERIVED/SCENARIO_INPUT"),
    Constraint("draft_vs_port_depth", "draft_m[vessel_class] <= port_depth_m[port]",
               "port_master_derived.csv has no physical depth in metres (only lat/lon)", "UNAVAILABLE (checker reports UNAVAILABLE, never fabricates pass/fail)"),
    Constraint("port_capacity", "planned_port_flow_tons <= port_capacity_tons",
               "no rated port throughput capacity exists in processed data", "UNAVAILABLE (checker reports UNAVAILABLE)"),
    Constraint("fuel_availability", "fuel_type in available_fuel_types[port]",
               "data_layer.py SCENARIO_PORT_FUEL_AVAILABILITY (assumed both fuels available everywhere)", "SCENARIO_INPUT"),
]


@dataclass(frozen=True)
class Objective:
    name: str
    direction: str
    formula: str
    data_source: str
    status: str


OBJECTIVES = [
    Objective("Fuel", "minimize", "XGBoost pipeline prediction of Consumer_Total_MomentaryFuel (an instantaneous RATE, physical unit undocumented) x assumed sampling-interval hours -> voyage fuel",
              "models/fuel_xgb_pipeline.joblib (REAL trained model, not retrained)", "MODEL_PREDICTION (rate-to-total conversion is SCENARIO_INPUT; see unit_conversion.py)"),
    Objective("Cost", "minimize", "voyage_fuel_tons_ASSUMED_UNIT * SCENARIO_FUEL_PRICE_USD_PER_TONNE[fuel_type]",
              "data_layer.py SCENARIO_FUEL_PRICE_USD_PER_TONNE", "SCENARIO_INPUT (no absolute fuel price anywhere in processed data)"),
    Objective("GHG", "minimize", "voyage_fuel_tons_ASSUMED_UNIT * SCENARIO_EMISSION_FACTOR_KGCO2_PER_TONNE_FUEL[fuel_type]",
              "data_layer.py SCENARIO_EMISSION_FACTOR_KGCO2_PER_TONNE_FUEL (standard IMO/IPCC factors, not a repo-derived value)", "SCENARIO_INPUT"),
]


def write_csvs() -> None:
    with open(ROOT / "decision_variables.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["name", "symbol", "domain", "data_source", "status", "justification"])
        for dv in DECISION_VARIABLES:
            w.writerow(asdict(dv).values())
        w.writerow([])
        w.writerow(["EXCLUDED_VARIABLE", "reason"])
        for name, reason in EXCLUDED_VARIABLES:
            w.writerow([name, reason])

    with open(ROOT / "constraints.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["name", "formula", "data_source", "status"])
        for c in CONSTRAINTS:
            w.writerow(asdict(c).values())

    with open(ROOT / "objectives.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["name", "direction", "formula", "data_source", "status"])
        for o in OBJECTIVES:
            w.writerow(asdict(o).values())

    print("Wrote decision_variables.csv, constraints.csv, objectives.csv")


if __name__ == "__main__":
    write_csvs()
