"""Glue: sequence the existing Gemini normalizer + deterministic parser into
one "parse only" call that produces the same structured request the manual
optimization form uses.

This module does not reimplement normalization or parsing, and it does not
run any optimization algorithm -- it only wires together the pre-existing
`ai.normalize_query` and `nlp.parser.parse_query` / `build_optimization_request`.
"""
from __future__ import annotations

from .optimization_adapter import build_optimization_request
from .parser import parse_query


def parse_natural_language(query: str) -> dict:
    """Normalize `query` with Gemini when configured, then run the
    deterministic parser, and build the same structured request the manual
    optimization form/API uses.

    Never raises for a normalization failure or for Gemini being
    unavailable/unconfigured (missing API key, package not installed, etc.)
    -- it always falls back to parsing the raw query text, so the
    deterministic parser's "never invent a value" guarantee still holds.
    """
    normalized_text: str | None = None
    gemini_used = False
    gemini_error: str | None = None

    try:
        from ai import NormalizationError, normalize_query

        try:
            normalized_text = normalize_query(query)
            gemini_used = True
        except NormalizationError as exc:
            gemini_error = str(exc)
    except Exception as exc:  # e.g. the optional `google-genai` package isn't installed
        gemini_error = str(exc)

    text_to_parse = normalized_text if normalized_text else query
    parsed = parse_query(text_to_parse)
    request = build_optimization_request(parsed)

    return {
        "query": query,
        "normalized_query": normalized_text,
        "gemini_used": gemini_used,
        "gemini_error": gemini_error,
        "parsed": parsed,
        "request": request,
    }
