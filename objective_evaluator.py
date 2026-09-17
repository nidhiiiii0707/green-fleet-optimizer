"""STAGE 5 -- Candidate -> XGB fuel prediction -> voyage fuel -> Fuel/Cost/GHG.

Builds one scenario row (real CPS_Poseidon telemetry template + candidate's
speed/fuel_type override) per candidate, calls the real fuel model exactly
once per candidate, and returns all three objective values plus the
feasibility report.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from candidate_schema import Candidate
from feasibility_checker import FeasibilityChecker, FeasibilityContext, FeasibilityReport
from fuel_model_adapter import FuelModelAdapter
from unit_conversion import FuelRate, HoursQuantity, rate_to_voyage_fuel, fuel_to_cost_usd, fuel_to_ghg_kgco2
import data_layer as DL

ROOT = Path(__file__).resolve().parent
_TELEMETRY = pd.read_csv(ROOT / "data" / "cps_poseidon_sample.csv")


@dataclass(frozen=True)
class EvaluatedCandidate:
    candidate: Candidate
    predicted_fuel_rate: float
    voyage_hours: float
    voyage_fuel: float
    cost_usd: float
    ghg_kgco2: float
    feasible: bool
    feasibility_report: FeasibilityReport


def build_scenario_row(candidate: Candidate) -> pd.DataFrame:
    """Real Poseidon telemetry row as operating-condition template, with the
    candidate's speed and fuel_type substituted in (never cargo/load/draft --
    those are not model inputs)."""
    row = _TELEMETRY.iloc[candidate.telemetry_row_id].copy()
    row["Ship_SpeedOverGround"] = candidate.speed_knots

    fuel_cols = {
        "Consumer_Boiler1_FuelType_DM": 0, "Consumer_Boiler1_FuelType_RM 380": 0,
    }
    for i in range(1, 6):
        fuel_cols[f"Consumer_GeneratorEngine{i}_FuelType_DM"] = 0
        fuel_cols[f"Consumer_GeneratorEngine{i}_FuelType_RM 180"] = 0
        fuel_cols[f"Consumer_GeneratorEngine{i}_FuelType_RM 380"] = 0
    if candidate.fuel_type == "DM":
        fuel_cols["Consumer_Boiler1_FuelType_DM"] = 1
        for i in range(1, 6):
            fuel_cols[f"Consumer_GeneratorEngine{i}_FuelType_DM"] = 1
    else:  # RM380
        fuel_cols["Consumer_Boiler1_FuelType_RM 380"] = 1
        for i in range(1, 6):
            fuel_cols[f"Consumer_GeneratorEngine{i}_FuelType_RM 380"] = 1
    for col, val in fuel_cols.items():
        if col in row.index:
            row[col] = val
    return pd.DataFrame([row])


class ObjectiveEvaluator:
    def __init__(self, model: FuelModelAdapter | None = None, fuel_price_multiplier: float = 1.0) -> None:
        self.model = model or FuelModelAdapter()
        self.checker = FeasibilityChecker()
        self.fuel_price_multiplier = fuel_price_multiplier

    def evaluate(self, candidate: Candidate, ctx: FeasibilityContext) -> EvaluatedCandidate:
        scenario = build_scenario_row(candidate)
        rate = float(self.model.predict(scenario).iloc[0])
        voyage_hours = candidate.distance_nm / candidate.speed_knots
        voyage_fuel = rate_to_voyage_fuel(FuelRate(rate), HoursQuantity(voyage_hours))

        price = DL.SCENARIO_FUEL_PRICE_USD_PER_TONNE.get(candidate.fuel_type)
        if price is not None:
            price = price * self.fuel_price_multiplier
        ef = DL.SCENARIO_EMISSION_FACTOR_KGCO2_PER_TONNE_FUEL.get(candidate.fuel_type)
        cost = fuel_to_cost_usd(voyage_fuel, price)
        ghg = fuel_to_ghg_kgco2(voyage_fuel, ef)

        report = self.checker.check(candidate, ctx)
        return EvaluatedCandidate(
            candidate=candidate,
            predicted_fuel_rate=rate,
            voyage_hours=voyage_hours,
            voyage_fuel=voyage_fuel.value,
            cost_usd=cost,
            ghg_kgco2=ghg,
            feasible=report.is_usable,
            feasibility_report=report,
        )
