"""STAGE 7 -- Deterministic hard-feasibility checks with human-readable reasons.

Every check returns PASSED / FAILED / UNAVAILABLE (never a fabricated pass or
fail when the required real data is missing -- e.g. draft_vs_port_depth and
port_capacity are UNAVAILABLE everywhere in this repo's data layer).
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from candidate_schema import Candidate


class ConstraintStatus(str, Enum):
    PASSED = "passed"
    FAILED = "failed"
    UNAVAILABLE = "unavailable"


@dataclass(frozen=True)
class ConstraintResult:
    name: str
    status: ConstraintStatus
    reason: str


@dataclass(frozen=True)
class FeasibilityContext:
    speed_min_kn: float | None
    speed_max_kn: float | None
    capacity_tons: float | None
    compatible_fuel_types: frozenset[str] | None
    available_fuel_types: frozenset[str] | None
    deadline_hours: float | None
    port_depth_m: float | None = None          # UNAVAILABLE in this data layer
    draft_m: float | None = None                # UNAVAILABLE in this data layer
    planned_port_flow_tons: float | None = None  # UNAVAILABLE in this data layer
    port_capacity_tons: float | None = None      # UNAVAILABLE in this data layer


@dataclass(frozen=True)
class FeasibilityReport:
    results: tuple[ConstraintResult, ...]

    @property
    def is_usable(self) -> bool:
        return all(r.status is not ConstraintStatus.FAILED for r in self.results)

    def reasons(self) -> list[str]:
        return [f"{r.name}: {r.status.value} ({r.reason})" for r in self.results]


class FeasibilityChecker:
    def check(self, candidate: Candidate, ctx: FeasibilityContext) -> FeasibilityReport:
        results = (
            self._speed(candidate, ctx),
            self._cargo_capacity(candidate, ctx),
            self._draft(ctx),
            self._voyage_deadline(candidate, ctx),
            self._fuel_availability(candidate, ctx),
            self._fuel_compatibility(candidate, ctx),
            self._port_capacity(ctx),
        )
        return FeasibilityReport(results)

    @staticmethod
    def _speed(c: Candidate, ctx: FeasibilityContext) -> ConstraintResult:
        name = "speed_bounds"
        if ctx.speed_min_kn is None or ctx.speed_max_kn is None:
            return ConstraintResult(name, ConstraintStatus.UNAVAILABLE, "vessel speed bounds missing")
        ok = ctx.speed_min_kn <= c.speed_knots <= ctx.speed_max_kn
        return ConstraintResult(
            name, ConstraintStatus.PASSED if ok else ConstraintStatus.FAILED,
            f"speed {c.speed_knots:.2f}kn vs bounds [{ctx.speed_min_kn:.2f}, {ctx.speed_max_kn:.2f}]kn",
        )

    @staticmethod
    def _cargo_capacity(c: Candidate, ctx: FeasibilityContext) -> ConstraintResult:
        name = "cargo_capacity"
        if ctx.capacity_tons is None:
            return ConstraintResult(name, ConstraintStatus.UNAVAILABLE, "vessel capacity missing")
        ok = c.cargo_tons <= ctx.capacity_tons
        return ConstraintResult(
            name, ConstraintStatus.PASSED if ok else ConstraintStatus.FAILED,
            f"cargo {c.cargo_tons:.1f}t vs capacity {ctx.capacity_tons:.1f}t",
        )

    @staticmethod
    def _draft(ctx: FeasibilityContext) -> ConstraintResult:
        name = "draft_vs_port_depth"
        if ctx.draft_m is None or ctx.port_depth_m is None:
            return ConstraintResult(name, ConstraintStatus.UNAVAILABLE, "no physical port depth (metres) in processed data")
        ok = ctx.draft_m <= ctx.port_depth_m
        return ConstraintResult(name, ConstraintStatus.PASSED if ok else ConstraintStatus.FAILED,
                                 f"draft {ctx.draft_m:.2f}m vs port depth {ctx.port_depth_m:.2f}m")

    @staticmethod
    def _voyage_deadline(c: Candidate, ctx: FeasibilityContext) -> ConstraintResult:
        name = "voyage_deadline"
        if ctx.deadline_hours is None:
            return ConstraintResult(name, ConstraintStatus.UNAVAILABLE, "deadline missing")
        voyage_hours = c.distance_nm / c.speed_knots
        ok = voyage_hours <= ctx.deadline_hours
        return ConstraintResult(
            name, ConstraintStatus.PASSED if ok else ConstraintStatus.FAILED,
            f"voyage {voyage_hours:.2f}h vs deadline {ctx.deadline_hours:.2f}h",
        )

    @staticmethod
    def _fuel_availability(c: Candidate, ctx: FeasibilityContext) -> ConstraintResult:
        name = "fuel_availability"
        if ctx.available_fuel_types is None:
            return ConstraintResult(name, ConstraintStatus.UNAVAILABLE, "port fuel availability missing")
        ok = c.fuel_type in ctx.available_fuel_types
        return ConstraintResult(name, ConstraintStatus.PASSED if ok else ConstraintStatus.FAILED,
                                 f"fuel {c.fuel_type} availability={sorted(ctx.available_fuel_types)}")

    @staticmethod
    def _fuel_compatibility(c: Candidate, ctx: FeasibilityContext) -> ConstraintResult:
        name = "fuel_vessel_compatibility"
        if ctx.compatible_fuel_types is None:
            return ConstraintResult(name, ConstraintStatus.UNAVAILABLE, "vessel/fuel compatibility missing")
        ok = c.fuel_type in ctx.compatible_fuel_types
        return ConstraintResult(name, ConstraintStatus.PASSED if ok else ConstraintStatus.FAILED,
                                 f"fuel {c.fuel_type} vs compatible set {sorted(ctx.compatible_fuel_types)}")

    @staticmethod
    def _port_capacity(ctx: FeasibilityContext) -> ConstraintResult:
        name = "port_capacity"
        if ctx.planned_port_flow_tons is None or ctx.port_capacity_tons is None:
            return ConstraintResult(name, ConstraintStatus.UNAVAILABLE, "no rated port throughput capacity in processed data")
        ok = ctx.planned_port_flow_tons <= ctx.port_capacity_tons
        return ConstraintResult(name, ConstraintStatus.PASSED if ok else ConstraintStatus.FAILED,
                                 f"flow {ctx.planned_port_flow_tons:.1f}t vs capacity {ctx.port_capacity_tons:.1f}t")
