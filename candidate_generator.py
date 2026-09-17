"""STAGE 6 -- Generate a small prototype candidate set from real/derived data.

Size choice: 6 real routes (route_derived.csv, first 6 distinct port pairs)
x 4 real vessel classes x 3 speeds (min/mean/max of that class) x 2 fuel
types x 2 cargo levels (50%% and 90%% of DERIVED capacity) = 6*4*3*2*2 = 288
raw combinations, then cheap rules drop vessel/fuel-incompatible combos
(Fish Carrier + RM380, per SCENARIO_VESSEL_FUEL_COMPATIBILITY) before any
model call, landing in the "tens to low hundreds" prototype range the task
asks for -- this keeps runtime manageable for NSGA-II/QBHO/CQM/MILP runs
below while still exercising every decision variable and constraint type.
"""
from __future__ import annotations

import itertools

import pandas as pd

import data_layer as DL
from candidate_schema import Candidate

N_ROUTES = 6
N_TELEMETRY_ROWS = 300  # matches data/cps_poseidon_sample.csv


def generate_candidates(seed: int = 0) -> list[Candidate]:
    routes = DL.load_routes().drop_duplicates(subset=["origin_port", "dest_port"]).head(N_ROUTES)
    fleet = DL.load_fleet_classes()

    candidates: list[Candidate] = []
    cid = 0
    rng_cursor = 0
    for _, route in routes.iterrows():
        for vessel_class, vc in fleet.items():
            if vc.speed_min_kn is None or vc.speed_max_kn is None:
                continue
            speeds = sorted({round(vc.speed_min_kn, 2), round(vc.speed_mean_kn, 2), round(vc.speed_max_kn, 2)})
            for speed, fuel_type in itertools.product(speeds, ("DM", "RM380")):
                if fuel_type not in DL.SCENARIO_VESSEL_FUEL_COMPATIBILITY.get(vessel_class, set()):
                    continue  # cheap skip: vessel-fuel incompatibility (SCENARIO_INPUT rule)
                if vc.capacity_tons is None:
                    continue
                for load_frac in (0.5, 0.9):
                    cargo = vc.capacity_tons * load_frac
                    telemetry_row_id = rng_cursor % N_TELEMETRY_ROWS
                    rng_cursor += 1
                    candidates.append(
                        Candidate(
                            candidate_id=f"C{cid:04d}",
                            leg_id=f"{route['origin_port'].strip()}->{route['dest_port'].strip()}",
                            vessel_class=vessel_class,
                            origin_port=route["origin_port"].strip(),
                            dest_port=route["dest_port"].strip(),
                            distance_nm=float(route["distance_nm"]),
                            speed_knots=float(speed),
                            fuel_type=fuel_type,
                            cargo_tons=float(cargo),
                            telemetry_row_id=telemetry_row_id,
                        )
                    )
                    cid += 1
    return candidates


def candidates_to_dataframe(candidates: list[Candidate]) -> pd.DataFrame:
    return pd.DataFrame([c.__dict__ for c in candidates])


if __name__ == "__main__":
    cands = generate_candidates()
    df = candidates_to_dataframe(cands)
    print(f"Generated {len(df)} candidates across {df['leg_id'].nunique()} routes and {df['vessel_class'].nunique()} vessel classes")
    df.to_csv("candidates_prototype.csv", index=False)
