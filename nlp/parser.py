"""Main rule-based parser for Green Fleet Optimizer requests."""

import re
from functools import lru_cache

import spacy
from spacy.language import Language

from .models import ParsedQuery
from .objective_detector import detect_objectives
from .port_matcher import validate_port


NUMBER = r"\d+(?:,\d{3})*(?:\.\d+)?"

ROUTE_FROM_PATTERN = re.compile(
    r"\b(?:route\s+)?(?:travel\s+)?from\s+"
    r"(?P<origin>[A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){0,2}?)\s+to\s+"
    r"(?P<destination>[A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){0,2}?)"
    r"(?=\s+(?:at|with|carrying|using|via|for)\b|[.,!?]|$)",
    flags=re.IGNORECASE,
)

ROUTE_BARE_PATTERN = re.compile(
    r"\b(?P<origin>[A-Z][A-Za-z'\-]*(?:\s+[A-Z][A-Za-z'\-]*){0,2})\s+to\s+"
    r"(?P<destination>[A-Z][A-Za-z'\-]*(?:\s+[A-Z][A-Za-z'\-]*){0,2})"
    r"(?=\s+(?:at|with|carrying|using|via|for)\b|[.,!?]|$)"
)

SPEED_PATTERNS = (
    re.compile(rf"\b(?:at|speed(?:\s+of)?)\s+(?P<value>{NUMBER})\s*(?:knots?|kts?)\b", re.I),
    re.compile(rf"\bwith\s+(?:a\s+)?speed(?:\s+of)?\s+(?P<value>{NUMBER})\s*(?:knots?|kts?)\b", re.I),
)

CARGO_PATTERNS = (
    re.compile(rf"\bcarrying\s+(?P<value>{NUMBER})\s*(?:metric\s+)?(?:tonnes?|tons?)\b", re.I),
    re.compile(rf"\bwith\s+(?P<value>{NUMBER})\s*(?:metric\s+)?(?:tonnes?|tons?)(?:\s+of\s+cargo)?\b", re.I),
)

VESSEL_TYPES = (
    "container ship",
    "bulk carrier",
    "cargo ship",
    "oil tanker",
    "tanker",
    "ro-ro vessel",
    "ro-ro",
)

FUEL_TYPES = (
    "marine gas oil",
    "heavy fuel oil",
    "green methanol",
    "biofuel",
    "biodiesel",
    "methanol",
    "ammonia",
    "hydrogen",
    "diesel",
    "lng",
    "mgo",
    "hfo",
    "rm380",
    "dm",
)


@lru_cache(maxsize=1)
def _get_nlp() -> Language:
    """Create a lightweight, local spaCy tokenizer once per process."""

    return spacy.blank("en")


def _extract_route(text: str) -> tuple[str | None, str | None]:
    match = ROUTE_FROM_PATTERN.search(text) or ROUTE_BARE_PATTERN.search(text)
    if not match:
        return None, None
    return match.group("origin").strip(), match.group("destination").strip()


def _extract_number(text: str, patterns: tuple[re.Pattern, ...]) -> int | float | None:
    for pattern in patterns:
        if match := pattern.search(text):
            value = float(match.group("value").replace(",", ""))
            return int(value) if value.is_integer() else value
    return None


def _extract_term(text: str, terms: tuple[str, ...]) -> str | None:
    for term in terms:
        if re.search(rf"(?<!\w){re.escape(term)}(?!\w)", text, flags=re.IGNORECASE):
            return term
    return None


def parse_query(text: str) -> dict:
    """Convert a natural-language fleet request into a structured dictionary.

    The parser only returns information explicitly present in ``text``. Unknown
    values remain ``None`` and misspelled ports are never silently corrected.
    """

    if not isinstance(text, str):
        raise TypeError("text must be a string")

    cleaned_text = " ".join(text.strip().split())
    doc = _get_nlp()(cleaned_text)
    normalized_text = " ".join(token.text for token in doc)

    origin, destination = _extract_route(cleaned_text)
    origin_valid, origin_suggestion = validate_port(origin)
    destination_valid, destination_suggestion = validate_port(destination)

    parsed = ParsedQuery(
        origin=origin,
        destination=destination,
        vessel_type=_extract_term(normalized_text, VESSEL_TYPES),
        fuel_type=_extract_term(normalized_text, FUEL_TYPES),
        speed=_extract_number(cleaned_text, SPEED_PATTERNS),
        cargo=_extract_number(cleaned_text, CARGO_PATTERNS),
        objectives=detect_objectives(normalized_text),
        origin_valid=False if origin_valid is False else None,
        origin_suggestion=origin_suggestion,
        destination_valid=False if destination_valid is False else None,
        destination_suggestion=destination_suggestion,
    )
    return parsed.as_response()
