"""Port validation and spelling suggestions.

Matches against the project's real/derived ports data layer (data_layer.py /
port_master_derived.csv) instead of a hardcoded port list, so any real port
the optimizer's data actually contains can be recognized.
"""
from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path

from rapidfuzz import fuzz, process

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import data_layer as DL  # noqa: E402

SUGGESTION_THRESHOLD = 70


@lru_cache(maxsize=1)
def _real_port_names() -> tuple[str, ...]:
    """Real port names from the project's ports data layer (no hardcoded list)."""
    frame = DL.load_ports()
    names = {
        str(name).strip()
        for name in frame["port_name"].dropna()
        if str(name).strip()
    }
    return tuple(sorted(names))


def validate_port(port: str | None) -> tuple[bool | None, str | None]:
    """Validate a port against the real ports data and suggest a close match
    without changing the input."""

    if port is None:
        return None, None

    valid_ports = _real_port_names()
    normalized = port.casefold()
    if any(normalized == valid.casefold() for valid in valid_ports):
        return True, None

    match = process.extractOne(port, valid_ports, scorer=fuzz.WRatio)
    if match and match[1] >= SUGGESTION_THRESHOLD:
        return False, match[0]
    return False, None
