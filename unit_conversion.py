"""STAGE 5 -- Explicit, guarded unit conversions for the objective chain.

Investigated before writing this module (see optimization_unit_checks.py):
- analysis/02_feature_audit.csv describes Consumer_Total_MomentaryFuel as
  "Ground-truth measured total INSTANTANEOUS fuel consumption" -> it is a
  RATE, not a per-voyage total.
- The raw CPS_Poseidon telemetry has NO timestamp/time column at all (checked
  the header of Raw/Fuel/CPS_Poseidon.csv), so the real sampling interval
  between rows cannot be recovered from data.
- Therefore converting the model's rate prediction into a voyage total
  REQUIRES an assumed time base. That assumption is a SCENARIO_INPUT, stated
  explicitly wherever it is used -- never silently baked in.

This module refuses to multiply the rate by anything the caller has not
explicitly labelled as an hours quantity, precisely to prevent an
incompatible-unit multiplication bug.
"""
from __future__ import annotations

from dataclasses import dataclass

# SCENARIO_INPUT: no timestamp column exists in the raw telemetry, so the
# per-row sampling interval implied by "momentary" is assumed to be 1 hour.
ASSUMED_SAMPLING_INTERVAL_HOURS = 1.0


@dataclass(frozen=True)
class HoursQuantity:
    """Wrapper that proves a float is genuinely an hours duration."""
    hours: float

    def __post_init__(self) -> None:
        if self.hours < 0:
            raise ValueError("hours cannot be negative")


@dataclass(frozen=True)
class FuelRate:
    """The model's raw output: an undocumented-unit RATE, never a total."""
    value: float


@dataclass(frozen=True)
class VoyageFuel:
    """A rate x time product. Still an ASSUMED_UNIT total (see module docstring)."""
    value: float
    unit_status: str = "ASSUMED_UNIT (ratexhours; base physical unit of the XGB target is undocumented)"


def voyage_distance_to_hours(distance_nm: float, speed_knots: float) -> HoursQuantity:
    if speed_knots <= 0:
        raise ValueError("speed_knots must be > 0 to compute voyage hours")
    return HoursQuantity(distance_nm / speed_knots)


def rate_to_voyage_fuel(
    rate: FuelRate,
    duration: HoursQuantity | None = None,
    *,
    assumed_interval_hours: float = ASSUMED_SAMPLING_INTERVAL_HOURS,
) -> VoyageFuel:
    """voyage_fuel = rate * time. `time` is REQUIRED to be an explicit HoursQuantity
    (voyage duration) or falls back to the SCENARIO_INPUT single-sample interval.
    Never accepts a bare, unlabelled number for the time term.
    """
    hours = duration.hours if duration is not None else assumed_interval_hours
    return VoyageFuel(rate.value * hours)


def fuel_to_cost_usd(fuel: VoyageFuel, price_usd_per_unit: float) -> float:
    """price_usd_per_unit must already be denominated in the SAME assumed
    fuel unit as `fuel` (see data_layer.SCENARIO_FUEL_PRICE_USD_PER_TONNE).
    """
    return fuel.value * price_usd_per_unit


def fuel_to_ghg_kgco2(fuel: VoyageFuel, emission_factor_kgco2_per_unit: float) -> float:
    return fuel.value * emission_factor_kgco2_per_unit
