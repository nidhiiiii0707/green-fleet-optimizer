"""Convert NLP parsed requests into optimizer-ready inputs and run the
existing optimization pipeline against them.

This module never invents values: unspecified fields are left unconstrained
(the optimizer's existing candidate grid / scenario defaults apply), and
specified fields that cannot be matched to anything the optimizer actually
generates are reported back as warnings rather than silently ignored or
silently satisfied.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from rapidfuzz import fuzz, process

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from run_optimization_pipeline import generate_evaluated_legs, run_all_algorithms  # noqa: E402
from objective_evaluator import EvaluatedCandidate  # noqa: E402

# Free-text vessel type phrases (as extracted by nlp/parser.py's VESSEL_TYPES)
# mapped onto this optimizer's real fleet_parameters.csv ship-type classes.
# Left unmapped on purpose where there is no real equivalent class -- we do
# not fabricate a mapping to a class the request didn't actually mean.
VESSEL_TYPE_ALIASES: dict[str, str] = {
    "container ship": "Container Ship",
    "bulk carrier": "Bulk Carrier",
    "tanker": "Tanker",
    "oil tanker": "Tanker",
}

# Free-text fuel phrases (as extracted by nlp/parser.py's FUEL_TYPES) mapped
# onto the two fuel types the real CPS_Poseidon telemetry / fuel model
# actually supports (see candidate_generator.py, data_layer.py). Fuels with
# no real equivalent in this data layer (methanol, ammonia, hydrogen, LNG,
# biofuel, ...) are intentionally left unmapped rather than guessed.
FUEL_TYPE_ALIASES: dict[str, str] = {
    "dm": "DM",
    "marine gas oil": "DM",
    "diesel": "DM",
    "rm380": "RM380",
    "heavy fuel oil": "RM380",
    "hfo": "RM380",
}

FUZZY_MATCH_THRESHOLD = 80


def build_optimization_request(parsed: dict) -> dict:
    """Convert the output of parse_query() into a structured optimization request."""

    return {
        "origin": parsed.get("origin"),
        "destination": parsed.get("destination"),
        "vessel_type": parsed.get("vessel_type"),
        "fuel_type": parsed.get("fuel_type"),
        "speed": parsed.get("speed"),
        "cargo": parsed.get("cargo"),
        "objectives": parsed.get("objectives", []),
    }


def _fuzzy_match(value: str, choices: set[str]) -> str | None:
    if not choices:
        return None
    normalized = value.strip().casefold()
    for choice in choices:
        if choice.strip().casefold() == normalized:
            return choice
    match = process.extractOne(value, list(choices), scorer=fuzz.WRatio)
    if match and match[1] >= FUZZY_MATCH_THRESHOLD:
        return match[0]
    return None


def _resolve_vessel_type(vessel_type: str) -> str | None:
    return VESSEL_TYPE_ALIASES.get(vessel_type.strip().casefold())


def _resolve_fuel_type(fuel_type: str) -> str | None:
    return FUEL_TYPE_ALIASES.get(fuel_type.strip().casefold())


def filter_legs(
    legs: list[list[EvaluatedCandidate]], request: dict[str, Any]
) -> tuple[list[list[EvaluatedCandidate]], list[str]]:
    """Filter the optimizer's existing evaluated candidate legs by the
    constraints present in `request`. Unspecified fields (None / empty)
    remain unrestricted. Returns (filtered_legs, warnings).

    Numeric constraints (speed, cargo) are matched to the *closest available*
    real candidate value on each leg rather than an exact value, since the
    optimizer's candidate set is a fixed discrete grid (see
    candidate_generator.py) -- this constrains the search without fabricating
    a new numeric input the optimizer never generated.
    """

    warnings: list[str] = []
    origin = request.get("origin")
    destination = request.get("destination")
    vessel_type = request.get("vessel_type")
    fuel_type = request.get("fuel_type")
    speed = request.get("speed")
    cargo = request.get("cargo")

    working_legs = legs

    if origin or destination:
        known_origins = {leg[0].candidate.origin_port for leg in working_legs if leg}
        known_dests = {leg[0].candidate.dest_port for leg in working_legs if leg}
        matched_origin = _fuzzy_match(origin, known_origins) if origin else None
        matched_dest = _fuzzy_match(destination, known_dests) if destination else None

        if origin and not matched_origin:
            warnings.append(
                f"origin '{origin}' does not match any route the optimizer has data for; "
                "route constraint not applied"
            )
        if destination and not matched_dest:
            warnings.append(
                f"destination '{destination}' does not match any route the optimizer has data for; "
                "route constraint not applied"
            )

        if matched_origin or matched_dest:
            def leg_matches(leg: list[EvaluatedCandidate]) -> bool:
                c = leg[0].candidate
                if matched_origin and c.origin_port != matched_origin:
                    return False
                if matched_dest and c.dest_port != matched_dest:
                    return False
                return True

            route_filtered = [leg for leg in working_legs if leg_matches(leg)]
            if route_filtered:
                working_legs = route_filtered
            else:
                warnings.append(
                    "no route in the optimizer's data matches both origin and destination; "
                    "route constraint not applied"
                )

    resolved_vessel = _resolve_vessel_type(vessel_type) if vessel_type else None
    if vessel_type and not resolved_vessel:
        warnings.append(
            f"vessel type '{vessel_type}' has no matching fleet class in this optimizer's data "
            f"(known classes come from fleet_parameters.csv); vessel constraint not applied"
        )

    resolved_fuel = _resolve_fuel_type(fuel_type) if fuel_type else None
    if fuel_type and not resolved_fuel:
        warnings.append(
            f"fuel type '{fuel_type}' is not one of the fuel types the fuel model supports (DM, RM380); "
            "fuel constraint not applied"
        )

    new_legs: list[list[EvaluatedCandidate]] = []
    for leg in working_legs:
        candidates = leg

        if resolved_vessel:
            filtered = [ec for ec in candidates if ec.candidate.vessel_class == resolved_vessel]
            if filtered:
                candidates = filtered
            else:
                warnings.append(
                    f"no {resolved_vessel} options on leg {leg[0].candidate.leg_id}; "
                    "vessel constraint not applied for this leg"
                )

        if resolved_fuel:
            filtered = [ec for ec in candidates if ec.candidate.fuel_type == resolved_fuel]
            if filtered:
                candidates = filtered
            else:
                warnings.append(
                    f"no {resolved_fuel} options on leg {leg[0].candidate.leg_id}; "
                    "fuel constraint not applied for this leg"
                )

        if speed is not None:
            best = min(abs(ec.candidate.speed_knots - speed) for ec in candidates)
            candidates = [ec for ec in candidates if abs(ec.candidate.speed_knots - speed) == best]

        if cargo is not None:
            best = min(abs(ec.candidate.cargo_tons - cargo) for ec in candidates)
            candidates = [ec for ec in candidates if abs(ec.candidate.cargo_tons - cargo) == best]

        new_legs.append(candidates)

    return new_legs, warnings


def _select_recommended(final_front, final_sources, objectives: list[str]) -> dict | None:
    """Pick one solution already present in the Pareto archive that best
    matches the requested objectives (min-max normalized sum over the
    requested axes). This ranks existing Pareto-optimal solutions -- it does
    not run any additional optimization."""

    if not objectives or not final_front:
        return None

    axis = {"fuel": 0, "cost": 1, "ghg": 2}
    axes = [axis[o] for o in objectives if o in axis]
    if not axes:
        return None

    values = [sol.objectives for sol in final_front]
    ranges = []
    for a in axes:
        col = [v[a] for v in values]
        lo, hi = min(col), max(col)
        ranges.append((a, lo, hi))

    def score(v: tuple[float, float, float]) -> float:
        total = 0.0
        for a, lo, hi in ranges:
            total += 0.0 if hi == lo else (v[a] - lo) / (hi - lo)
        return total

    best_idx = min(range(len(final_front)), key=lambda i: score(values[i]))
    return {"index": best_idx, "algorithm_source": final_sources[best_idx]}


def _solution_to_dict(sol, src: str, legs: list[list[EvaluatedCandidate]]) -> dict:
    legs_detail = []
    for leg_idx, choice in enumerate(sol.selection):
        ec = legs[leg_idx][choice]
        c = ec.candidate
        legs_detail.append({
            "leg": c.leg_id,
            "vessel_class": c.vessel_class,
            "origin": c.origin_port,
            "destination": c.dest_port,
            "cargo_tons": c.cargo_tons,
            "speed_knots": c.speed_knots,
            "fuel_type": c.fuel_type,
            "voyage_fuel": ec.voyage_fuel,
            "cost_usd": ec.cost_usd,
            "ghg_kgco2": ec.ghg_kgco2,
            "feasible": ec.feasible,
        })
    return {
        "algorithm_source": src,
        "total_fuel": sol.fuel,
        "total_cost": sol.cost,
        "total_ghg": sol.ghg,
        "legs": legs_detail,
    }


def optimize_from_query(text: str, seed: int = 0) -> dict:
    """End-to-end: natural language -> parsed request -> filtered candidates
    -> existing NSGA-II/QBHO/CQM/MILP pipeline -> Pareto results.

    Imported lazily from nlp.parser to avoid importing spaCy/rapidfuzz at
    module import time for callers that only need filter_legs().
    """
    from nlp.parser import parse_query

    parsed = parse_query(text)
    request = build_optimization_request(parsed)

    _, legs, _ = generate_evaluated_legs(seed=seed)
    filtered_legs, warnings = filter_legs(legs, request)

    if not filtered_legs or any(len(leg) == 0 for leg in filtered_legs):
        return {
            "parsed_query": parsed,
            "optimization_request": request,
            "warnings": warnings,
            "pareto_solutions": [],
            "recommended_solution": None,
            "error": "No candidates satisfy the given constraints; try relaxing one of them.",
        }

    final_front, final_sources, _ = run_all_algorithms(filtered_legs)
    recommended = _select_recommended(final_front, final_sources, request.get("objectives", []))

    solutions = [
        _solution_to_dict(sol, src, filtered_legs)
        for sol, src in zip(final_front, final_sources)
    ]

    return {
        "parsed_query": parsed,
        "optimization_request": request,
        "warnings": warnings,
        "pareto_solutions": solutions,
        "recommended_solution": recommended,
    }
