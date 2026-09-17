"""Thin, honest loader over the existing optimization data layer CSVs.

This module performs NO new derivation of its own beyond what is explicitly
documented in derived_relationships.csv, except for two small,
clearly-labelled arithmetic combinations of two already-REAL/DERIVED numbers
(vessel cargo capacity from mean cargo / load ratio). Every value handed out
carries its status (REAL / DERIVED / SCENARIO_INPUT) so downstream code never
has to guess.

Nothing here retrains or touches the fuel model.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent


@dataclass(frozen=True)
class VesselClass:
    ship_type: str
    speed_min_kn: float
    speed_max_kn: float
    speed_mean_kn: float
    cargo_weight_tons_mean: float
    load_ratio_pct_mean: float
    draft_m_mean: float
    capacity_tons: float  # DERIVED = cargo_weight_tons_mean / (load_ratio_pct_mean/100)
    capacity_status: str
    n_records: int


def load_fleet_classes() -> dict[str, VesselClass]:
    """Real fleet_segment_ship_type rows from fleet_parameters.csv."""
    df = pd.read_csv(ROOT / "fleet_parameters.csv")
    seg = df[df["segment_type"] == "fleet_segment_ship_type"]
    out: dict[str, VesselClass] = {}
    for ship_type, g in seg.groupby("segment_key"):
        vals = dict(zip(g["parameter"], g["value"]))

        def num(key):
            v = vals.get(key)
            try:
                return float(v)
            except (TypeError, ValueError):
                return None

        cargo_mean = num("cargo_weight_tons_mean")
        load_ratio = num("load_ratio_pct_mean")
        capacity_tons = None
        capacity_status = "SCENARIO_INPUT"
        if cargo_mean is not None and load_ratio not in (None, 0):
            capacity_tons = cargo_mean / (load_ratio / 100.0)
            capacity_status = (
                "DERIVED = cargo_weight_tons_mean / (load_ratio_pct_mean/100); "
                "both source values are REAL/DERIVED means from ship_performance.csv "
                "(no individual-vessel DWT exists, so this is a fleet-segment-level "
                "capacity ESTIMATE, not a rated DWT)"
            )
        out[ship_type] = VesselClass(
            ship_type=ship_type,
            speed_min_kn=num("speed_min_kn"),
            speed_max_kn=num("speed_max_kn"),
            speed_mean_kn=num("speed_mean_kn"),
            cargo_weight_tons_mean=cargo_mean,
            load_ratio_pct_mean=load_ratio,
            draft_m_mean=num("draft_meters_mean"),
            capacity_tons=capacity_tons,
            capacity_status=capacity_status,
            n_records=int(num("n_records") or 0),
        )
    return out


def load_routes() -> pd.DataFrame:
    """Real port pairs + DERIVED haversine distance/voyage time (route_derived.csv)."""
    return pd.read_csv(ROOT / "route_derived.csv")


def load_ports() -> pd.DataFrame:
    return pd.read_csv(ROOT / "port_master_derived.csv")


def load_cargo_demand() -> pd.DataFrame:
    return pd.read_csv(ROOT / "cargo_demand_derived.csv")


def load_fuel_cost_parameters() -> pd.DataFrame:
    return pd.read_csv(ROOT / "fuel_cost_parameters.csv")


def load_ghg_parameters() -> pd.DataFrame:
    return pd.read_csv(ROOT / "ghg_parameters.csv")


def load_optimization_master() -> pd.DataFrame:
    return pd.read_csv(ROOT / "optimization_master.csv")


# --- SCENARIO_INPUT parameters (no real source; used only where explicitly labelled) ---
# These are NOT invented "facts" -- they are optimizer configuration knobs that a real
# planner would supply, and the data layer confirms no real source exists for them.
SCENARIO_FUEL_PRICE_USD_PER_TONNE = {
    "DM": 850.0,      # SCENARIO_INPUT: distillate marine fuel, order-of-magnitude bunker price
    "RM380": 550.0,   # SCENARIO_INPUT: residual/HFO-class fuel, order-of-magnitude bunker price
}
SCENARIO_EMISSION_FACTOR_KGCO2_PER_TONNE_FUEL = {
    # SCENARIO_INPUT: standard IMO/IPCC marine-fuel CO2 emission factors (tCO2/t fuel),
    # NOT drawn from this repo's ghg_parameters.csv (whose reference values are
    # unitless chart means from literature figures, not a documented per-tonne factor
    # compatible with the model's fuel unit).
    "DM": 3206.0,
    "RM380": 3114.0,
}
SCENARIO_VESSEL_FUEL_COMPATIBILITY = {
    # SCENARIO_INPUT: assumed compatibility -- no real vessel-class-to-fuel-type
    # compatibility table exists in the processed data. All classes are assumed able
    # to burn either fuel observed in the real CPS_Poseidon telemetry (DM, RM380).
    "Bulk Carrier": {"DM", "RM380"},
    "Container Ship": {"DM", "RM380"},
    "Fish Carrier": {"DM"},
    "Tanker": {"DM", "RM380"},
}
SCENARIO_PORT_FUEL_AVAILABILITY = frozenset({"DM", "RM380"})  # SCENARIO_INPUT
SCENARIO_VOYAGE_DEADLINE_MULTIPLIER = 1.5  # SCENARIO_INPUT: deadline = 1.5x nominal voyage time


def build_feasibility_context(candidate, fleet_classes: dict[str, VesselClass]):
    """Assemble a FeasibilityContext for one candidate from the real/derived
    fleet parameters plus the SCENARIO_INPUT compatibility/availability/deadline
    knobs above. Imported lazily to avoid a circular import at module load."""
    from feasibility_checker import FeasibilityContext

    vc = fleet_classes.get(candidate.vessel_class)
    nominal_hours = candidate.distance_nm / candidate.speed_knots
    return FeasibilityContext(
        speed_min_kn=vc.speed_min_kn if vc else None,
        speed_max_kn=vc.speed_max_kn if vc else None,
        capacity_tons=vc.capacity_tons if vc else None,
        compatible_fuel_types=frozenset(SCENARIO_VESSEL_FUEL_COMPATIBILITY.get(candidate.vessel_class, set())),
        available_fuel_types=SCENARIO_PORT_FUEL_AVAILABILITY,
        deadline_hours=nominal_hours * SCENARIO_VOYAGE_DEADLINE_MULTIPLIER,
    )
