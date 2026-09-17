"""STAGE 4 -- Static unit/dimension sanity checks for the objective chain.

These are NOT the pytest unit-conversion tests (see tests/test_unit_conversion.py);
this script is a quick, human-readable dimensional-analysis walk-through that can
be run standalone to see exactly which quantities are REAL/DERIVED/SCENARIO_INPUT
and what units they carry, before any optimizer runs.

Run: python optimization_unit_checks.py
"""
from __future__ import annotations

CHAIN = [
    ("Consumer_Total_MomentaryFuel (XGB prediction)", "undocumented mass/volume RATE per undocumented time unit", "MODEL_PREDICTION"),
    ("assumed sampling interval", "hours (SCENARIO_INPUT assumption: 1.0 h, since no timestamp column exists anywhere in CPS_Poseidon raw data)", "SCENARIO_INPUT"),
    ("voyage_hours", "distance_nm [DERIVED] / speed_knots [decision var, bounded by REAL fleet_parameters] = hours", "DERIVED"),
    ("voyage_fuel (ASSUMED_UNIT)", "rate [undocumented unit] * sampling_interval_hours [SCENARIO_INPUT] -- dimensionally rate*time -> a total, but the base unit itself is still undocumented, so this total is labelled ASSUMED_UNIT, not a verified physical tonnage", "SCENARIO_INPUT (chained through undocumented base unit)"),
    ("Cost (USD)", "voyage_fuel [ASSUMED_UNIT, treated as tonnes] * SCENARIO_FUEL_PRICE_USD_PER_TONNE [SCENARIO_INPUT, USD/tonne]", "SCENARIO_INPUT"),
    ("GHG (kgCO2)", "voyage_fuel [ASSUMED_UNIT, treated as tonnes] * SCENARIO_EMISSION_FACTOR_KGCO2_PER_TONNE_FUEL [SCENARIO_INPUT, kgCO2/tonne]", "SCENARIO_INPUT"),
]


def run() -> None:
    print("Objective unit chain (fuel -> cost -> GHG):")
    for name, unit, status in CHAIN:
        print(f"  [{status:22s}] {name}: {unit}")
    print()
    print("CAVEAT: Consumer_Total_MomentaryFuel's physical unit (kg/h? t/h? m3/h?) is")
    print("NOT documented anywhere in the training data, model metadata, or analysis/*.csv.")
    print("Every downstream Cost/GHG number in this pipeline is therefore an ASSUMED-UNIT")
    print("estimate, not a verified real-world tonnage/cost/emission figure. Relative")
    print("comparisons BETWEEN candidates (same assumed unit throughout) remain valid;")
    print("absolute magnitudes should not be quoted as real-world accurate.")


if __name__ == "__main__":
    run()
