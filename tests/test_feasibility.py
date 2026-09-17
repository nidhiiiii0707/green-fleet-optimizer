from src.optimization.candidate import Candidate
from src.optimization.feasibility import (
    ConstraintStatus,
    FeasibilityChecker,
    FeasibilityContext,
)
import pytest


def _candidate(**overrides) -> Candidate:
    values = {
        "speed_knots": 12.0,
        "cargo_tons": 800.0,
        "draft_m": 8.0,
        "fuel_type": "DM",
    }
    values.update(overrides)
    return Candidate(**values)


def test_all_supported_constraints_pass_with_explicit_compatible_limits() -> None:
    context = FeasibilityContext(
        min_speed_knots=10.0,
        max_speed_knots=15.0,
        vessel_capacity_tons=1_000.0,
        port_depth_m=10.0,
        route_distance_nm=120.0,
        deadline_hours=12.0,
        available_fuel_types=frozenset({"DM", "RM380"}),
        compatible_fuel_types=frozenset({"DM"}),
        planned_port_flow_tons=1_500.0,
        port_capacity_tons=2_000.0,
    )

    report = FeasibilityChecker().check(_candidate(), context)

    assert report.is_usable
    assert {result.status for result in report.results} == {ConstraintStatus.PASSED}


def test_constraints_fail_deterministically_when_explicit_limits_are_violated() -> None:
    context = FeasibilityContext(
        min_speed_knots=13.0,
        max_speed_knots=15.0,
        vessel_capacity_tons=700.0,
        port_depth_m=7.0,
        route_distance_nm=240.0,
        deadline_hours=10.0,
        available_fuel_types=frozenset({"RM380"}),
        compatible_fuel_types=frozenset({"RM380"}),
        planned_port_flow_tons=2_500.0,
        port_capacity_tons=2_000.0,
    )

    report = FeasibilityChecker().check(_candidate(), context)

    assert not report.is_usable
    assert {result.status for result in report.results} == {ConstraintStatus.FAILED}


def test_missing_limits_return_unavailable_with_specific_reasons() -> None:
    report = FeasibilityChecker().check(_candidate(), FeasibilityContext())

    assert report.is_usable
    assert {result.status for result in report.results} == {ConstraintStatus.UNAVAILABLE}
    reasons = " ".join(result.reason for result in report.results)
    assert "minimum and maximum vessel speed limits" in reasons
    assert "rated vessel cargo capacity" in reasons
    assert "physical port depth in metres" in reasons
    assert "route distance and delivery deadline" in reasons
    assert "port fuel-availability mapping" in reasons
    assert "vessel/fuel compatibility mapping" in reasons
    assert "rated port capacity and planned aggregate port flow" in reasons


def test_missing_candidate_value_returns_unavailable_even_when_limit_exists() -> None:
    candidate = _candidate(draft_m=None)
    context = FeasibilityContext(port_depth_m=10.0)

    report = FeasibilityChecker().check(candidate, context)
    draft = report.by_name("draft_at_port")

    assert draft.status is ConstraintStatus.UNAVAILABLE
    assert "candidate draft" in draft.reason


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        ({"min_speed_knots": 15.0, "max_speed_knots": 10.0}, "cannot exceed"),
        ({"min_speed_knots": float("nan")}, "finite"),
        ({"max_speed_knots": float("inf")}, "finite"),
        ({"vessel_capacity_tons": -1.0}, "non-negative"),
        ({"port_depth_m": -1.0}, "non-negative"),
        ({"route_distance_nm": -1.0}, "non-negative"),
        ({"deadline_hours": 0.0}, "greater than zero"),
        ({"planned_port_flow_tons": -1.0}, "non-negative"),
        ({"port_capacity_tons": -1.0}, "non-negative"),
    ],
)
def test_context_rejects_malformed_operational_limits(kwargs, message) -> None:
    with pytest.raises(ValueError, match=message):
        FeasibilityContext(**kwargs)
