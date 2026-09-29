"""Model-backed fuel prediction endpoint for the Fuel Prediction Lab.

The saved XGBoost artifact does not contain draft, cargo-load, or hull
condition features. Those inputs are therefore applied as transparent
planning adjustments after inference and are never described as learned
effects.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

import data_layer as DL
from fuel_model_adapter import FuelModelAdapter


router = APIRouter(prefix="/api/fuel-prediction", tags=["fuel-prediction"])

KNOT_TO_METRES_PER_SECOND = 0.514444
MODEL_MAX_SOG_KNOTS = 12.1
MODEL_MAX_STW_KNOTS = 12.398
BASE_LOAD_PCT = 70.0
TELEMETRY = pd.read_csv(DL.ROOT / "data" / "cps_poseidon_sample.csv")


class FuelPredictionRequest(BaseModel):
    vessel_type: str
    origin: str
    destination: str
    speed_knots: float = Field(gt=0, le=30)
    draft_m: float | None = Field(default=None, gt=0, le=25)
    cargo_load_pct: float = Field(ge=0, le=100)
    wind_speed_knots: float = Field(ge=0, le=80)
    wave_height_m: float = Field(ge=0, le=15)
    current_speed_knots: float = Field(ge=-5, le=5)
    sea_state: Literal["Calm", "Slight", "Moderate", "Rough", "Very rough"]
    fuel_type: Literal["DM", "RM380"]
    hull_condition_pct: float = Field(default=0, ge=0, le=30)


@lru_cache(maxsize=1)
def _model() -> FuelModelAdapter:
    return FuelModelAdapter()


def _route(origin: str, destination: str) -> pd.Series:
    routes = DL.load_routes()
    match = routes[
        routes["origin_port"].astype(str).str.strip().str.casefold().eq(origin.strip().casefold())
        & routes["dest_port"].astype(str).str.strip().str.casefold().eq(destination.strip().casefold())
    ]
    if match.empty:
        raise HTTPException(status_code=422, detail=f"Unknown route: {origin} to {destination}")
    return match.iloc[0]


def _vessel(vessel_type: str) -> DL.VesselClass:
    vessel = DL.load_fleet_classes().get(vessel_type)
    if vessel is None:
        raise HTTPException(status_code=422, detail=f"Unknown vessel type: {vessel_type}")
    return vessel


def _set_fuel(row: pd.Series, fuel_type: str) -> None:
    for boiler in (1, 2):
        for fuel in ("DM", "RM 380"):
            column = f"Consumer_Boiler{boiler}_FuelType_{fuel}"
            if column in row.index:
                row[column] = int((fuel_type == "DM" and fuel == "DM") or (fuel_type == "RM380" and fuel == "RM 380"))
    for engine in range(1, 6):
        for fuel in ("DM", "RM 180", "RM 380"):
            column = f"Consumer_GeneratorEngine{engine}_FuelType_{fuel}"
            row[column] = int((fuel_type == "DM" and fuel == "DM") or (fuel_type == "RM380" and fuel == "RM 380"))


def _scenario_row(request: FuelPredictionRequest) -> pd.Series:
    row = TELEMETRY.iloc[0].copy()
    model_sog = min(request.speed_knots, MODEL_MAX_SOG_KNOTS)
    speed_through_water = request.speed_knots - request.current_speed_knots
    row["Ship_SpeedOverGround"] = model_sog
    row["Ship_SpeedThroughWater"] = min(max(speed_through_water, 0), MODEL_MAX_STW_KNOTS)
    row["Weather_WindSpeed10M"] = request.wind_speed_knots * KNOT_TO_METRES_PER_SECOND
    row["Weather_WindGusts10M"] = max(float(row["Weather_WindSpeed10M"]), request.wind_speed_knots * KNOT_TO_METRES_PER_SECOND * 1.25)
    row["Weather_WaveHeight"] = request.wave_height_m
    row["Weather_WindWaveHeight"] = request.wave_height_m * 0.65
    row["Weather_SwellWaveHeight"] = request.wave_height_m * 0.35
    row["Weather_OceanCurrentVelocity"] = abs(request.current_speed_knots) * KNOT_TO_METRES_PER_SECOND
    row["Weather_OceanCurrentDirection"] = 0 if request.current_speed_knots >= 0 else 180
    _set_fuel(row, request.fuel_type)
    return row


def _predict(row: pd.Series) -> float:
    return float(_model().predict(pd.DataFrame([row])).iloc[0])


def _pct_delta(value: float, baseline: float) -> float:
    if baseline == 0:
        return 0.0
    return round((value - baseline) * 100 / baseline, 1)


def _counterfactual_effect(row: pd.Series, columns: tuple[str, ...]) -> float:
    baseline = row.copy()
    medians = TELEMETRY[list(columns)].median(numeric_only=True)
    for column in columns:
        baseline[column] = medians[column]
    return _pct_delta(_predict(row), _predict(baseline))


def _validation_history() -> list[dict[str, float | int]]:
    samples = []
    for number, row_index in enumerate((0, 50, 100, 150, 200, 250), start=1):
        row = TELEMETRY.iloc[row_index]
        samples.append({
            "sample": number,
            "actual": round(float(row["Consumer_Total_MomentaryFuel"]) * 24, 1),
            "predicted": round(_predict(row) * 24, 1),
        })
    return samples


@router.post("/predict")
def predict_fuel(request: FuelPredictionRequest):
    route = _route(request.origin, request.destination)
    vessel = _vessel(request.vessel_type)
    row = _scenario_row(request)
    model_rate = _predict(row)

    # The trained tree model cannot extrapolate beyond its observed speed range.
    # Continue the curve with the standard naval-architecture V^3 relationship
    # and disclose this in the response instead of silently clipping the input.
    speed_extrapolation = max(1.0, (request.speed_knots / MODEL_MAX_SOG_KNOTS) ** 3)
    learned_daily_rate = model_rate * 24 * speed_extrapolation

    cargo_adjustment = (request.cargo_load_pct - BASE_LOAD_PCT) * 0.003
    draft_adjustment = 0.0
    if request.draft_m is not None and vessel.draft_m_mean:
        draft_adjustment = ((request.draft_m / vessel.draft_m_mean) - 1) * 0.15
    hull_adjustment = request.hull_condition_pct / 100
    planning_multiplier = max(0.5, 1 + cargo_adjustment + draft_adjustment + hull_adjustment)
    daily_rate = learned_daily_rate * planning_multiplier

    rmse = float(_model().test_metrics.get("RMSE", 0.088)) * 24 * speed_extrapolation * planning_multiplier
    interval = 1.96 * rmse
    out_of_distribution_penalty = max(0, request.speed_knots / MODEL_MAX_SOG_KNOTS - 1) * 10
    confidence = max(70.0, min(99.0, float(_model().test_metrics.get("R2", 0.97)) * 100 - out_of_distribution_penalty))

    distance_nm = float(route["distance_nm"])
    duration_days = distance_nm / request.speed_knots / 24
    rounded_daily_rate = round(daily_rate, 1)
    voyage_fuel = rounded_daily_rate * duration_days
    rounded_voyage_fuel = round(voyage_fuel, 1)
    price = DL.SCENARIO_FUEL_PRICE_USD_PER_TONNE[request.fuel_type]
    emission_factor = DL.SCENARIO_EMISSION_FACTOR_KGCO2_PER_TONNE_FUEL[request.fuel_type]

    weather_effect = _counterfactual_effect(row, (
        "Weather_WindSpeed10M", "Weather_WindGusts10M", "Weather_WaveHeight",
        "Weather_WindWaveHeight", "Weather_SwellWaveHeight",
    ))
    current_baseline = row.copy()
    current_baseline["Weather_OceanCurrentVelocity"] = TELEMETRY["Weather_OceanCurrentVelocity"].median()
    current_baseline["Weather_OceanCurrentDirection"] = TELEMETRY["Weather_OceanCurrentDirection"].median()
    current_baseline["Ship_SpeedThroughWater"] = min(request.speed_knots, MODEL_MAX_STW_KNOTS)
    current_effect = _pct_delta(_predict(row), _predict(current_baseline))
    speed_effect = _counterfactual_effect(row, ("Ship_SpeedOverGround", "Ship_SpeedThroughWater"))

    return {
        "mode": "xgboost_with_planning_adjustments",
        "route": {
            "origin": str(route["origin_port"]).strip(),
            "destination": str(route["dest_port"]).strip(),
            "distance_nm": round(distance_nm, 2),
        },
        "prediction": {
            "consumption_tonnes_per_day": rounded_daily_rate,
            "lower_tonnes_per_day": round(max(0, daily_rate - interval), 1),
            "upper_tonnes_per_day": round(daily_rate + interval, 1),
            "uncertainty_tonnes_per_day": round(interval, 1),
            "confidence_pct": round(confidence),
        },
        "voyage": {
            "duration_days": round(duration_days, 2),
            "fuel_tonnes": rounded_voyage_fuel,
            "co2e_tonnes": round(rounded_voyage_fuel * emission_factor / 1000, 1),
            "cost_usd": round(rounded_voyage_fuel * price),
        },
        "breakdown": [
            {"key": "speed", "label": "Speed effect", "percent": speed_effect, "source": "xgboost"},
            {"key": "weather", "label": "Weather effect", "percent": weather_effect, "source": "xgboost"},
            {"key": "draft", "label": "Draft effect", "percent": round(draft_adjustment * 100, 1), "source": "planning_adjustment"},
            {"key": "cargo", "label": "Cargo loading", "percent": round(cargo_adjustment * 100, 1), "source": "planning_adjustment"},
            {"key": "current", "label": "Ocean current", "percent": current_effect, "source": "xgboost"},
            {"key": "hull", "label": "Hull condition", "percent": round(hull_adjustment * 100, 1), "source": "planning_adjustment"},
        ],
        "history": _validation_history(),
        "model": {
            "name": "XGBRegressor",
            "test_r2": round(float(_model().test_metrics.get("R2", 0)), 3),
            "test_mae": round(float(_model().test_metrics.get("MAE", 0)), 3),
            "excluded_from_training": ["draft_m", "cargo_load_pct", "hull_condition_pct"],
            "speed_extrapolation_applied": request.speed_knots > MODEL_MAX_SOG_KNOTS,
            "model_speed_range_knots": [0, MODEL_MAX_SOG_KNOTS],
            "unit_assumption": "The source target unit is undocumented; tonnes/hour is a planning assumption used for daily, voyage, cost, and CO2e totals.",
            "history_note": "Actual versus predicted values are six reference telemetry samples, not voyage totals; the source data has no voyage identifier or timestamp.",
        },
    }
