"""Fuel Prediction Lab API contract tests."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


BASE_REQUEST = {
    "vessel_type": "Bulk Carrier",
    "origin": "Yohohama",
    "destination": "Singapore",
    "speed_knots": 17.5,
    "draft_m": 9.2,
    "cargo_load_pct": 82,
    "wind_speed_knots": 18,
    "wave_height_m": 2.4,
    "current_speed_knots": 0.8,
    "sea_state": "Moderate",
    "fuel_type": "RM380",
    "hull_condition_pct": 8,
}


def test_prediction_uses_real_route_and_returns_auditable_totals() -> None:
    response = client.post("/api/fuel-prediction/predict", json=BASE_REQUEST)

    assert response.status_code == 200, response.text
    body = response.json()
    prediction = body["prediction"]
    voyage = body["voyage"]

    assert body["mode"] == "xgboost_with_planning_adjustments"
    assert body["route"]["distance_nm"] == pytest.approx(2863.76)
    assert prediction["consumption_tonnes_per_day"] > 0
    assert prediction["lower_tonnes_per_day"] < prediction["consumption_tonnes_per_day"]
    assert prediction["upper_tonnes_per_day"] > prediction["consumption_tonnes_per_day"]
    assert 0 < prediction["confidence_pct"] <= 100

    expected_days = 2863.76 / BASE_REQUEST["speed_knots"] / 24
    expected_voyage_fuel = prediction["consumption_tonnes_per_day"] * expected_days
    assert voyage["duration_days"] == pytest.approx(expected_days, abs=0.01)
    assert voyage["fuel_tonnes"] == pytest.approx(expected_voyage_fuel, abs=0.1)
    assert voyage["co2e_tonnes"] == pytest.approx(voyage["fuel_tonnes"] * 3.114, abs=0.2)
    assert voyage["cost_usd"] == pytest.approx(voyage["fuel_tonnes"] * 550, abs=1)


def test_prediction_distinguishes_learned_drivers_from_planning_adjustments() -> None:
    response = client.post("/api/fuel-prediction/predict", json=BASE_REQUEST)

    assert response.status_code == 200, response.text
    body = response.json()
    breakdown = {item["key"]: item for item in body["breakdown"]}

    assert breakdown["speed"]["source"] == "xgboost"
    assert breakdown["weather"]["source"] == "xgboost"
    assert breakdown["current"]["source"] == "xgboost"
    assert breakdown["draft"]["source"] == "planning_adjustment"
    assert breakdown["cargo"]["source"] == "planning_adjustment"
    assert breakdown["hull"]["source"] == "planning_adjustment"
    assert set(body["model"]["excluded_from_training"]) == {
        "draft_m",
        "cargo_load_pct",
        "hull_condition_pct",
    }
    assert body["model"]["test_r2"] == pytest.approx(0.97, abs=0.01)


def test_current_counterfactual_does_not_double_count_the_speed_effect() -> None:
    response = client.post("/api/fuel-prediction/predict", json=BASE_REQUEST)

    assert response.status_code == 200, response.text
    breakdown = {item["key"]: item for item in response.json()["breakdown"]}
    assert breakdown["speed"]["percent"] > 20
    assert -5 < breakdown["current"]["percent"] < 5


def test_hull_penalty_is_a_transparent_multiplicative_adjustment() -> None:
    clean = client.post(
        "/api/fuel-prediction/predict",
        json={**BASE_REQUEST, "draft_m": None, "cargo_load_pct": 70, "hull_condition_pct": 0},
    )
    fouled = client.post(
        "/api/fuel-prediction/predict",
        json={**BASE_REQUEST, "draft_m": None, "cargo_load_pct": 70, "hull_condition_pct": 10},
    )

    assert clean.status_code == 200, clean.text
    assert fouled.status_code == 200, fouled.text
    clean_rate = clean.json()["prediction"]["consumption_tonnes_per_day"]
    fouled_rate = fouled.json()["prediction"]["consumption_tonnes_per_day"]
    assert fouled_rate == pytest.approx(clean_rate * 1.10, rel=0.002)


def test_prediction_rejects_unknown_route() -> None:
    response = client.post(
        "/api/fuel-prediction/predict",
        json={**BASE_REQUEST, "destination": "Atlantis"},
    )

    assert response.status_code == 422
    assert "route" in response.json()["detail"].lower()
