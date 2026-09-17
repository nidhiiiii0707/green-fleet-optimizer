"""STAGE 4 -- Validates that the real data-layer files this pipeline depends
on exist, load, and have the columns the rest of the pipeline assumes.

Run: python optimization_input_validator.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent

REQUIRED_FILES = {
    "optimization_master.csv": ["origin_port", "dest_port", "distance_nm", "cargo_tonnage"],
    "fleet_parameters.csv": ["segment_type", "segment_key", "parameter", "value"],
    "port_master_derived.csv": ["port_name", "country", "lat", "lon"],
    "route_derived.csv": ["origin_port", "dest_port", "distance_nm", "voyage_time_hours"],
    "cargo_demand_derived.csv": ["granularity", "port_or_state", "period", "cargo_type", "value"],
    "fuel_cost_parameters.csv": ["parameter_group", "key", "parameter", "value"],
    "ghg_parameters.csv": ["parameter_group", "fuel", "parameter", "value"],
    "derived_relationships.csv": ["derived_output_file", "derived_column", "formula"],
    "ais_optimization_schema.csv": None,
}
REQUIRED_MODEL_FILES = ["models/fuel_xgb_pipeline.joblib", "models/fuel_pipeline_utils.py"]


def validate() -> list[str]:
    errors: list[str] = []
    for fname, required_cols in REQUIRED_FILES.items():
        path = ROOT / fname
        if not path.exists():
            errors.append(f"MISSING FILE: {fname}")
            continue
        try:
            df = pd.read_csv(path, nrows=5)
        except Exception as e:  # noqa: BLE001
            errors.append(f"UNREADABLE FILE: {fname} ({e})")
            continue
        if required_cols:
            missing = [c for c in required_cols if c not in df.columns]
            if missing:
                errors.append(f"{fname}: missing expected columns {missing}")

    for fname in REQUIRED_MODEL_FILES:
        if not (ROOT / fname).exists():
            errors.append(f"MISSING FILE: {fname}")

    return errors


if __name__ == "__main__":
    errs = validate()
    if errs:
        print("INPUT VALIDATION FAILED:")
        for e in errs:
            print(" -", e)
        sys.exit(1)
    print("INPUT VALIDATION PASSED: all required data-layer and model files present with expected columns.")
