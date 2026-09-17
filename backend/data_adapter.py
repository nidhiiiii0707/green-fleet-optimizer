"""Adapters from the repository's real/derived data files to dashboard contracts.

The dashboard contract predates the optimization data layer, so a few legacy
field names (for example ``cargoTEU`` and projected ``x``/``y`` coordinates)
are retained for compatibility.  Their real units and provenance are exposed
alongside them; unavailable operational fields are returned as ``None`` rather
than invented.
"""
from __future__ import annotations

import math
import re
from pathlib import Path
from typing import Any, Iterable

import pandas as pd

import data_layer as DL

REPO_ROOT = Path(__file__).resolve().parent.parent
PARETO_PATH = REPO_ROOT / "final_pareto_fleet_plans.csv"
SUMMARY_PATH = REPO_ROOT / "run_optimization_pipeline_summary.json"


def _number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def port_id(name: str) -> str:
    """Stable API identifier derived only from the source port name."""
    return re.sub(r"[^A-Z0-9]+", "_", str(name).strip().upper()).strip("_")


def vessel_class_id(name: str) -> str:
    return f"CLASS_{port_id(name)}"


def _project(lon: float, lat: float) -> tuple[float, float]:
    """Equirectangular projection retained for the legacy x/y API fields."""
    return round((lon + 180.0) * 2.5, 3), round((90.0 - lat) * (440.0 / 180.0), 3)


def load_ports() -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for _, source in DL.load_ports().iterrows():
        name = str(source.get("port_name", "")).strip()
        lat, lon = _number(source.get("lat")), _number(source.get("lon"))
        if not name or lat is None or lon is None:
            continue
        identifier = port_id(name)
        if identifier in seen:
            continue
        seen.add(identifier)
        x, y = _project(lon, lat)
        country = str(source.get("country", "")).strip() or None
        rows.append({
            "id": identifier,
            "name": name,
            "country": country,
            "latitude": lat,
            "longitude": lon,
            "x": x,
            "y": y,
            "shorepower": None,
            "capacity": None,
            "coordinateStatus": str(source.get("lat_lon_status", "")).strip() or None,
        })
    return rows


def load_routes() -> list[dict[str, Any]]:
    routes: list[dict[str, Any]] = []
    for index, source in DL.load_routes().iterrows():
        origin = str(source["origin_port"]).strip()
        destination = str(source["dest_port"]).strip()
        origin_lat = _number(source.get("origin_lat"))
        origin_lon = _number(source.get("origin_lon"))
        destination_lat = _number(source.get("dest_lat"))
        destination_lon = _number(source.get("dest_lon"))
        if None in (origin_lat, origin_lon, destination_lat, destination_lon):
            continue
        origin_x, origin_y = _project(origin_lon, origin_lat)
        destination_x, destination_y = _project(destination_lon, destination_lat)
        routes.append({
            "id": f"R{index + 1:03d}",
            "name": f"{origin} to {destination}",
            "originId": port_id(origin),
            "destinationId": port_id(destination),
            "origin": origin,
            "destination": destination,
            "originLatitude": origin_lat,
            "originLongitude": origin_lon,
            "destinationLatitude": destination_lat,
            "destinationLongitude": destination_lon,
            "distanceNm": _number(source.get("distance_nm")),
            "voyageTimeHours": _number(source.get("voyage_time_hours")),
            "speedKnots": _number(source.get("speed_kn_assumed")),
            "distanceStatus": str(source.get("distance_status", "")).strip() or None,
            "voyageTimeStatus": str(source.get("voyage_time_status", "")).strip() or None,
            "controlX": round((origin_x + destination_x) / 2, 3),
            "controlY": round((origin_y + destination_y) / 2, 3),
        })
    return routes


def load_vessel_classes() -> list[dict[str, Any]]:
    vessels: list[dict[str, Any]] = []
    for name, vessel in DL.load_fleet_classes().items():
        vessels.append({
            "id": vessel_class_id(name),
            "name": name,
            "type": name,
            "capacity": vessel.capacity_tons,
            "capacityUnit": "metric tons",
            "capacityStatus": vessel.capacity_status,
            "fuelCompatibility": sorted(DL.SCENARIO_VESSEL_FUEL_COMPATIBILITY.get(name, set())),
            "fuelCompatibilityStatus": "SCENARIO_INPUT",
            "speed": vessel.speed_mean_kn,
            "speedMin": vessel.speed_min_kn,
            "speedMax": vessel.speed_max_kn,
            "availability": None,
            "maintenanceStatus": None,
            "shorepower": None,
            "currentPort": None,
            "recordCount": vessel.n_records,
            "dataLevel": "fleet_segment_ship_type",
        })
    return vessels


def _route_lookup(routes: Iterable[dict[str, Any]]) -> dict[tuple[str, str], dict[str, Any]]:
    return {(route["origin"], route["destination"]): route for route in routes}


def _constraints(summary: Any) -> list[dict[str, Any]]:
    constraints: list[dict[str, Any]] = []
    for item in str(summary or "").split(";"):
        item = item.strip()
        if not item:
            continue
        label, separator, detail = item.partition(":")
        normalized = detail.strip().lower()
        status = "unavailable"
        if normalized.startswith("passed"):
            status = "passed"
        elif normalized.startswith("failed"):
            status = "failed"
        constraints.append({
            "label": label.replace("_", " ").strip().title(),
            "satisfied": status == "passed",
            "status": status,
            "note": detail.strip() if separator else None,
        })
    return constraints


def _assignment_from_row(row: pd.Series, solution_api_id: str, leg_index: int,
                         route_lookup: dict[tuple[str, str], dict[str, Any]]) -> dict[str, Any]:
    origin, destination = str(row["origin"]).strip(), str(row["destination"]).strip()
    route = route_lookup.get((origin, destination))
    feasible = str(row.get("feasible", "")).strip().lower() == "true"
    return {
        "id": f"{solution_api_id}-L{leg_index + 1:02d}",
        "vesselId": vessel_class_id(str(row["vessel_class"])),
        "vesselType": str(row["vessel_class"]),
        "cargo": "Cargo",
        "cargoTEU": _number(row.get("cargo_tons")),
        "cargoTons": _number(row.get("cargo_tons")),
        "originId": port_id(origin),
        "destinationId": port_id(destination),
        "origin": origin,
        "destination": destination,
        "originLatitude": route["originLatitude"] if route else None,
        "originLongitude": route["originLongitude"] if route else None,
        "destinationLatitude": route["destinationLatitude"] if route else None,
        "destinationLongitude": route["destinationLongitude"] if route else None,
        "routeId": route["id"] if route else None,
        "routeName": route["name"] if route else str(row.get("leg", "")),
        "distanceNm": route["distanceNm"] if route else None,
        "voyageTimeHours": route["voyageTimeHours"] if route else None,
        "speed": _number(row.get("speed_knots")),
        "fuelType": str(row.get("fuel_type", "")),
        "shorepower": None,
        "eta": None,
        "fuelConsumption": _number(row.get("voyage_fuel_ASSUMED_UNIT")),
        "predictedFuelRate": _number(row.get("predicted_fuel_rate")),
        "cost": round((_number(row.get("cost_usd_SCENARIO_INPUT")) or 0) / 1000, 3),
        "costUsd": _number(row.get("cost_usd_SCENARIO_INPUT")),
        "ghg": _number(row.get("ghg_kgco2_SCENARIO_INPUT")),
        "ghgUnit": "kgCO2",
        "status": "on-schedule" if feasible else "warning",
        "constraints": _constraints(row.get("constraint_summary")),
    }


def _fuel_mix(assignments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    colors = {"DM": "#2563EB", "RM380": "#94A3B8"}
    totals: dict[str, dict[str, float]] = {}
    for assignment in assignments:
        fuel = assignment["fuelType"]
        aggregate = totals.setdefault(fuel, {"consumption": 0.0, "cost": 0.0, "ghg": 0.0, "vessels": 0})
        aggregate["consumption"] += assignment["fuelConsumption"] or 0
        aggregate["cost"] += (assignment["costUsd"] or 0) / 1_000_000
        aggregate["ghg"] += assignment["ghg"] or 0
        aggregate["vessels"] += 1
    count = max(len(assignments), 1)
    return [{"fuel": fuel, **values, "share": round(values["vessels"] * 100 / count, 1),
             "color": colors.get(fuel, "#64748B")} for fuel, values in totals.items()]


def _solution(group: pd.DataFrame, api_id: str, routes: list[dict[str, Any]]) -> dict[str, Any]:
    route_lookup = _route_lookup(routes)
    assignments = [_assignment_from_row(row, api_id, index, route_lookup)
                   for index, (_, row) in enumerate(group.iterrows())]
    constraints = [constraint for assignment in assignments for constraint in assignment["constraints"]]
    applicable = [constraint for constraint in constraints if constraint["status"] != "unavailable"]
    first = group.iloc[0]
    return {
        "id": api_id,
        "optimizerSolutionId": str(first["solution_id"]),
        "label": f"Solution #{api_id[1:]}",
        "algorithm": str(first.get("algorithm_source", "")),
        "fuel": _number(first.get("solution_total_fuel")),
        "cost": round((_number(first.get("solution_total_cost")) or 0) / 1_000_000, 6),
        "costUsd": _number(first.get("solution_total_cost")),
        "ghg": _number(first.get("solution_total_ghg")),
        "ghgUnit": "kgCO2",
        "cargoFulfillment": None,
        "vessels": len(assignments),
        "routes": len({assignment["routeId"] for assignment in assignments if assignment["routeId"]}),
        "constraintsSatisfied": sum(constraint["satisfied"] for constraint in applicable),
        "totalConstraints": len(applicable),
        "pareto": True,
        "assignments": assignments,
        "emptyStateReason": None if assignments else "The optimizer returned no leg assignments for this solution.",
    }


def load_precomputed_result() -> dict[str, Any]:
    if not PARETO_PATH.exists():
        raise FileNotFoundError(f"Real optimization output not found: {PARETO_PATH}")
    frame = pd.read_csv(PARETO_PATH)
    required = {"solution_id", "algorithm_source", "solution_total_fuel", "solution_total_cost",
                "solution_total_ghg", "origin", "destination", "vessel_class"}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f"Optimization output is missing columns: {sorted(missing)}")
    routes = load_routes()
    solutions = [_solution(group, f"S{index:02d}", routes)
                 for index, (_, group) in enumerate(frame.groupby("solution_id", sort=False), start=1)]
    if not solutions:
        raise ValueError("Real optimization output contains no solutions")
    selected = solutions[0]
    return {
        "run_id": "precomputed-final-pareto",
        "status": "completed",
        "data_mode": "real_precomputed",
        "source": str(PARETO_PATH.name),
        "method": "NSGA-II / QBHO / CQM / MILP / MO-QIGA",
        "feasible_solutions": len(solutions),
        "pareto_count": len(solutions),
        "runtime_seconds": None,
        "constraint_satisfaction": (
            f"{selected['constraintsSatisfied']}/{selected['totalConstraints']}"
            if selected["totalConstraints"] else "unavailable"
        ),
        "pareto_solutions": solutions,
        "baseline": None,
        "optimized": {key: selected[key] for key in ("fuel", "cost", "ghg", "cargoFulfillment")},
        "fuel_mix": _fuel_mix(selected["assignments"]),
        "selected_solution_id": selected["id"],
    }


def build_runtime_result(final_front, final_sources, legs) -> dict[str, Any]:
    """Map aggregate ``Solution`` objects to the selected candidate per leg."""
    routes = load_routes()
    route_lookup = _route_lookup(routes)
    solutions: list[dict[str, Any]] = []
    for index, (solution, source) in enumerate(zip(final_front, final_sources), start=1):
        api_id = f"S{index:02d}"
        assignments = []
        for leg_index, choice in enumerate(solution.selection):
            evaluated = legs[leg_index][choice]
            candidate = evaluated.candidate
            route = route_lookup.get((candidate.origin_port, candidate.dest_port))
            constraints = [{
                "label": result.name.replace("_", " ").title(),
                "satisfied": result.status.value == "passed",
                "status": result.status.value,
                "note": result.reason,
            } for result in evaluated.feasibility_report.results]
            assignments.append({
                "id": f"{api_id}-L{leg_index + 1:02d}",
                "vesselId": vessel_class_id(candidate.vessel_class),
                "vesselType": candidate.vessel_class,
                "cargo": "Cargo",
                "cargoTEU": candidate.cargo_tons,
                "cargoTons": candidate.cargo_tons,
                "originId": port_id(candidate.origin_port),
                "destinationId": port_id(candidate.dest_port),
                "origin": candidate.origin_port,
                "destination": candidate.dest_port,
                "originLatitude": route["originLatitude"] if route else None,
                "originLongitude": route["originLongitude"] if route else None,
                "destinationLatitude": route["destinationLatitude"] if route else None,
                "destinationLongitude": route["destinationLongitude"] if route else None,
                "routeId": route["id"] if route else None,
                "routeName": route["name"] if route else candidate.leg_id,
                "distanceNm": candidate.distance_nm,
                "voyageTimeHours": evaluated.voyage_hours,
                "speed": candidate.speed_knots,
                "fuelType": candidate.fuel_type,
                "shorepower": None,
                "eta": None,
                "fuelConsumption": evaluated.voyage_fuel,
                "predictedFuelRate": evaluated.predicted_fuel_rate,
                "cost": round(evaluated.cost_usd / 1000, 3),
                "costUsd": evaluated.cost_usd,
                "ghg": evaluated.ghg_kgco2,
                "ghgUnit": "kgCO2",
                "status": "on-schedule" if evaluated.feasible else "warning",
                "constraints": constraints,
            })
        applicable = [c for a in assignments for c in a["constraints"] if c["status"] != "unavailable"]
        solutions.append({
            "id": api_id, "optimizerSolutionId": f"{source}-{solution.selection}",
            "label": f"Solution #{index:02d}", "algorithm": source,
            "fuel": solution.fuel, "cost": solution.cost / 1_000_000,
            "costUsd": solution.cost, "ghg": solution.ghg, "ghgUnit": "kgCO2",
            "cargoFulfillment": None, "vessels": len(assignments),
            "routes": len({a["routeId"] for a in assignments if a["routeId"]}),
            "constraintsSatisfied": sum(c["satisfied"] for c in applicable),
            "totalConstraints": len(applicable), "pareto": True,
            "assignments": assignments,
            "emptyStateReason": None if assignments else "The optimizer returned no leg assignments for this solution.",
        })
    if not solutions:
        raise ValueError("Optimization pipeline returned an empty Pareto front")
    selected = solutions[0]
    return {
        "run_id": f"runtime-{id(final_front)}", "status": "completed", "data_mode": "real_runtime",
        "source": "run_optimization_pipeline.py", "method": "NSGA-II / QBHO / CQM / MILP / MO-QIGA",
        "feasible_solutions": len(solutions), "pareto_count": len(solutions), "runtime_seconds": None,
        "constraint_satisfaction": f"{selected['constraintsSatisfied']}/{selected['totalConstraints']}",
        "pareto_solutions": solutions, "baseline": None,
        "optimized": {key: selected[key] for key in ("fuel", "cost", "ghg", "cargoFulfillment")},
        "fuel_mix": _fuel_mix(selected["assignments"]), "selected_solution_id": selected["id"],
    }
