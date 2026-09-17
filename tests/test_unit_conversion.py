import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest

from unit_conversion import (
    FuelRate, HoursQuantity, rate_to_voyage_fuel, fuel_to_cost_usd,
    fuel_to_ghg_kgco2, voyage_distance_to_hours, ASSUMED_SAMPLING_INTERVAL_HOURS,
)


def test_voyage_distance_to_hours_is_distance_over_speed():
    h = voyage_distance_to_hours(distance_nm=100.0, speed_knots=10.0)
    assert h.hours == pytest.approx(10.0)


def test_voyage_distance_to_hours_rejects_zero_speed():
    with pytest.raises(ValueError):
        voyage_distance_to_hours(distance_nm=100.0, speed_knots=0.0)


def test_rate_to_voyage_fuel_multiplies_rate_by_explicit_hours():
    rate = FuelRate(2.0)
    hours = HoursQuantity(5.0)
    total = rate_to_voyage_fuel(rate, hours)
    assert total.value == pytest.approx(10.0)


def test_rate_to_voyage_fuel_falls_back_to_assumed_interval():
    rate = FuelRate(2.0)
    total = rate_to_voyage_fuel(rate, duration=None)
    assert total.value == pytest.approx(2.0 * ASSUMED_SAMPLING_INTERVAL_HOURS)


def test_hours_quantity_rejects_negative():
    with pytest.raises(ValueError):
        HoursQuantity(-1.0)


def test_fuel_to_cost_and_ghg_are_linear_in_fuel():
    fuel = rate_to_voyage_fuel(FuelRate(3.0), HoursQuantity(2.0))  # 6.0 units
    cost = fuel_to_cost_usd(fuel, price_usd_per_unit=100.0)
    ghg = fuel_to_ghg_kgco2(fuel, emission_factor_kgco2_per_unit=50.0)
    assert cost == pytest.approx(600.0)
    assert ghg == pytest.approx(300.0)
