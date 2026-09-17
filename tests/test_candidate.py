import pandas as pd
import pytest

from src.optimization.candidate import Candidate
from src.optimization.candidate_generator import CandidateGenerator


def test_candidate_supports_only_grounded_planning_fields() -> None:
    candidate = Candidate(
        candidate_id="c-1",
        vessel_class="Container Ship",
        origin="Mumbai",
        destination="Chennai",
        route="Coastal",
        speed_knots=13.0,
        cargo_tons=1_000.0,
        fuel_type="DM",
        engine_type="Diesel",
        draft_m=8.0,
        shore_power=None,
    )

    assert candidate.origin == "Mumbai"
    assert candidate.shore_power is None


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        ({"speed_knots": 0.0}, "speed_knots must be greater than zero"),
        ({"cargo_tons": -1.0}, "cargo_tons cannot be negative"),
        ({"draft_m": -0.1}, "draft_m cannot be negative"),
    ],
)
def test_candidate_rejects_intrinsically_invalid_values(kwargs, message) -> None:
    with pytest.raises(ValueError, match=message):
        Candidate(**kwargs)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"speed_knots": float("nan")},
        {"speed_knots": float("inf")},
        {"cargo_tons": float("nan")},
        {"cargo_tons": float("inf")},
        {"draft_m": float("nan")},
        {"draft_m": float("inf")},
    ],
)
def test_candidate_rejects_non_finite_numeric_values(kwargs) -> None:
    with pytest.raises(ValueError, match="finite"):
        Candidate(**kwargs)


def test_generator_maps_observation_without_inventing_route_endpoints_or_fuel() -> None:
    row = pd.Series(
        {
            "vessel_class": "Bulk Carrier",
            "route_type": "Long-haul",
            "engine_type": "Heavy Fuel Oil (HFO)",
            "speed_over_ground_knots": 12.5,
            "cargo_weight_tons": 900.0,
            "draft_m": 9.2,
        }
    )

    candidate = CandidateGenerator.from_vessel_observation(row, candidate_id="obs-7")

    assert candidate.vessel_class == "Bulk Carrier"
    assert candidate.route == "Long-haul"
    assert candidate.engine_type == "Heavy Fuel Oil (HFO)"
    assert candidate.origin is None
    assert candidate.destination is None
    assert candidate.fuel_type is None
    assert candidate.shore_power is None
