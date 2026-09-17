"""STAGE 6 -- Cache evaluated candidates (fuel/cost/GHG/feasibility) keyed by
candidate signature, so repeated optimizer runs against the same prototype
scenario don't re-call the XGB pipeline needlessly.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from candidate_schema import Candidate

CACHE_PATH = Path(__file__).resolve().parent / "candidate_cache.json"


def _key(c: Candidate) -> str:
    return "|".join(
        str(x) for x in (
            c.leg_id, c.vessel_class, c.speed_knots, c.fuel_type,
            c.cargo_tons, c.telemetry_row_id,
        )
    )


class CandidateCache:
    def __init__(self, path: Path = CACHE_PATH) -> None:
        self.path = path
        self._data: dict[str, dict] = {}
        if path.exists():
            self._data = json.loads(path.read_text())

    def get(self, candidate: Candidate) -> dict | None:
        return self._data.get(_key(candidate))

    def put(self, candidate: Candidate, evaluation: dict) -> None:
        self._data[_key(candidate)] = evaluation

    def save(self) -> None:
        self.path.write_text(json.dumps(self._data, indent=2))

    def __len__(self) -> int:
        return len(self._data)
