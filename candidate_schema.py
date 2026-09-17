"""STAGE 6 -- Candidate (decision-variable tuple) schema.

Matches the decision variable set from optimization_problem_definition.py:
vessel_class, route, speed_knots, fuel_type, cargo_tons. No shore_power /
vessel_activation fields (excluded -- see that module's docstring).
"""
from __future__ import annotations

from dataclasses import dataclass
import math


@dataclass(frozen=True)
class Candidate:
    candidate_id: str
    leg_id: str
    vessel_class: str
    origin_port: str
    dest_port: str
    distance_nm: float
    speed_knots: float
    fuel_type: str
    cargo_tons: float
    telemetry_row_id: int  # index into data/cps_poseidon_sample.csv used as the real operating-condition template

    def __post_init__(self) -> None:
        for name in ("distance_nm", "speed_knots", "cargo_tons"):
            v = getattr(self, name)
            if not math.isfinite(v):
                raise ValueError(f"{name} must be finite")
        if self.speed_knots <= 0:
            raise ValueError("speed_knots must be > 0")
        if self.cargo_tons < 0:
            raise ValueError("cargo_tons cannot be negative")
        if self.distance_nm < 0:
            raise ValueError("distance_nm cannot be negative")
