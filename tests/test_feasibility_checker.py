import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from candidate_schema import Candidate
from feasibility_checker import FeasibilityChecker, FeasibilityContext, ConstraintStatus


def make_candidate(**overrides):
    base = dict(
        candidate_id="C1", leg_id="A->B", vessel_class="Bulk Carrier",
        origin_port="A", dest_port="B", distance_nm=100.0, speed_knots=15.0,
        fuel_type="DM", cargo_tons=500.0, telemetry_row_id=0,
    )
    base.update(overrides)
    return Candidate(**base)


def full_context(**overrides):
    base = dict(
        speed_min_kn=10.0, speed_max_kn=20.0, capacity_tons=1000.0,
        compatible_fuel_types=frozenset({"DM", "RM380"}),
        available_fuel_types=frozenset({"DM", "RM380"}),
        deadline_hours=20.0,
    )
    base.update(overrides)
    return FeasibilityContext(**base)


def test_all_pass_when_within_bounds():
    checker = FeasibilityChecker()
    report = checker.check(make_candidate(), full_context())
    assert report.is_usable


def test_speed_out_of_bounds_fails():
    checker = FeasibilityChecker()
    c = make_candidate(speed_knots=99.0)
    report = checker.check(c, full_context())
    assert not report.is_usable
    named = {r.name: r.status for r in report.results}
    assert named["speed_bounds"] == ConstraintStatus.FAILED


def test_cargo_exceeds_capacity_fails():
    checker = FeasibilityChecker()
    c = make_candidate(cargo_tons=5000.0)
    report = checker.check(c, full_context())
    named = {r.name: r.status for r in report.results}
    assert named["cargo_capacity"] == ConstraintStatus.FAILED


def test_missing_capacity_is_unavailable_not_a_fabricated_pass():
    checker = FeasibilityChecker()
    c = make_candidate()
    report = checker.check(c, full_context(capacity_tons=None))
    named = {r.name: r.status for r in report.results}
    assert named["cargo_capacity"] == ConstraintStatus.UNAVAILABLE


def test_voyage_deadline_exceeded_fails():
    checker = FeasibilityChecker()
    c = make_candidate(distance_nm=1000.0, speed_knots=10.0)  # 100h voyage
    report = checker.check(c, full_context(deadline_hours=20.0))
    named = {r.name: r.status for r in report.results}
    assert named["voyage_deadline"] == ConstraintStatus.FAILED


def test_voyage_within_deadline_passes():
    checker = FeasibilityChecker()
    c = make_candidate(distance_nm=100.0, speed_knots=15.0)  # 6.67h voyage
    report = checker.check(c, full_context(deadline_hours=20.0))
    named = {r.name: r.status for r in report.results}
    assert named["voyage_deadline"] == ConstraintStatus.PASSED


def test_fuel_incompatible_with_vessel_fails():
    checker = FeasibilityChecker()
    c = make_candidate(fuel_type="RM380")
    report = checker.check(c, full_context(compatible_fuel_types=frozenset({"DM"})))
    named = {r.name: r.status for r in report.results}
    assert named["fuel_vessel_compatibility"] == ConstraintStatus.FAILED


def test_fuel_unavailable_at_port_fails():
    checker = FeasibilityChecker()
    c = make_candidate(fuel_type="RM380")
    report = checker.check(c, full_context(available_fuel_types=frozenset({"DM"})))
    named = {r.name: r.status for r in report.results}
    assert named["fuel_availability"] == ConstraintStatus.FAILED


def test_draft_and_port_capacity_always_unavailable_in_this_data_layer():
    checker = FeasibilityChecker()
    report = checker.check(make_candidate(), full_context())
    named = {r.name: r.status for r in report.results}
    assert named["draft_vs_port_depth"] == ConstraintStatus.UNAVAILABLE
    assert named["port_capacity"] == ConstraintStatus.UNAVAILABLE
