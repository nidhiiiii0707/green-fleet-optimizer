"""Tests for the NLP -> optimizer integration (nlp/optimization_adapter.py).

Uses the real, existing candidate/evaluation pipeline (generate_evaluated_legs)
so these tests exercise the actual optimizer data, not mocks.
"""
from __future__ import annotations

import pytest

from nlp.parser import parse_query
from nlp.optimization_adapter import (
    build_optimization_request,
    filter_legs,
    optimize_from_query,
)
from run_optimization_pipeline import generate_evaluated_legs


@pytest.fixture(scope="module")
def evaluated_legs():
    _, legs, _ = generate_evaluated_legs(seed=0)
    return legs


def test_origin_destination_extraction():
    parsed = parse_query("Find a low emission route from Yokohama to Singapore carrying 5000 tonnes at 18 knots")
    assert parsed["origin"] == "Yokohama"
    assert parsed["destination"] == "Singapore"


def test_cargo_constraint_selects_closest_available_cargo(evaluated_legs):
    request = {"origin": None, "destination": None, "vessel_type": None,
               "fuel_type": None, "speed": None, "cargo": 5000, "objectives": []}
    filtered, warnings = filter_legs(evaluated_legs, request)
    assert len(filtered) == len(evaluated_legs)
    for original_leg, filtered_leg in zip(evaluated_legs, filtered):
        assert len(filtered_leg) <= len(original_leg)
        best = min(abs(ec.candidate.cargo_tons - 5000) for ec in original_leg)
        assert all(abs(ec.candidate.cargo_tons - 5000) == best for ec in filtered_leg)


def test_speed_constraint_selects_closest_available_speed(evaluated_legs):
    request = {"origin": None, "destination": None, "vessel_type": None,
               "fuel_type": None, "speed": 18, "cargo": None, "objectives": []}
    filtered, warnings = filter_legs(evaluated_legs, request)
    for original_leg, filtered_leg in zip(evaluated_legs, filtered):
        best = min(abs(ec.candidate.speed_knots - 18) for ec in original_leg)
        assert all(abs(ec.candidate.speed_knots - 18) == best for ec in filtered_leg)


def test_vessel_constraint_filters_to_matching_class(evaluated_legs):
    request = {"origin": None, "destination": None, "vessel_type": "container ship",
               "fuel_type": None, "speed": None, "cargo": None, "objectives": []}
    filtered, warnings = filter_legs(evaluated_legs, request)
    for leg in filtered:
        assert all(ec.candidate.vessel_class == "Container Ship" for ec in leg)


def test_fuel_constraint_filters_to_matching_fuel(evaluated_legs):
    request = {"origin": None, "destination": None, "vessel_type": None,
               "fuel_type": "heavy fuel oil", "speed": None, "cargo": None, "objectives": []}
    filtered, warnings = filter_legs(evaluated_legs, request)
    for leg in filtered:
        assert all(ec.candidate.fuel_type == "RM380" for ec in leg)


def test_route_constraint_filters_to_single_leg(evaluated_legs):
    request = {"origin": "Yokohama", "destination": "Singapore", "vessel_type": None,
               "fuel_type": None, "speed": None, "cargo": None, "objectives": []}
    filtered, warnings = filter_legs(evaluated_legs, request)
    assert len(filtered) == 1
    leg_id = filtered[0][0].candidate.leg_id
    assert "Singapore" in leg_id


def test_unspecified_fields_remain_unrestricted(evaluated_legs):
    request = {"origin": None, "destination": None, "vessel_type": None,
               "fuel_type": None, "speed": None, "cargo": None, "objectives": []}
    filtered, warnings = filter_legs(evaluated_legs, request)
    assert warnings == []
    for original_leg, filtered_leg in zip(evaluated_legs, filtered):
        assert len(filtered_leg) == len(original_leg)


def test_single_objective_detected():
    parsed = parse_query("Minimize fuel from Yokohama to Singapore")
    assert parsed["objectives"] == ["fuel"]


def test_multiple_objectives_detected():
    parsed = parse_query("Minimize fuel and emissions from Yokohama to Singapore")
    assert set(parsed["objectives"]) >= {"fuel", "ghg"}


def test_end_to_end_nlp_to_optimizer():
    result = optimize_from_query(
        "Find a low emission route from Yokohama to Singapore carrying 5000 tonnes at 18 knots"
    )
    assert result["parsed_query"]["origin"] == "Yokohama"
    assert result["parsed_query"]["destination"] == "Singapore"
    assert result["optimization_request"]["objectives"] == ["ghg"]
    assert "pareto_solutions" in result
    for sol in result["pareto_solutions"]:
        for leg in sol["legs"]:
            assert leg["destination"].strip() == "Singapore"
