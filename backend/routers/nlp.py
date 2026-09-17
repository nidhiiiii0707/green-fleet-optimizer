"""NLP router — parses natural language into the SAME structured request the
manual optimization form uses. It never runs an optimization algorithm
itself; the frontend sends the (possibly user-edited) structured request to
POST /api/optimization/run, exactly like the manual form does.
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

log = logging.getLogger("nlp_router")
REPO_ROOT = Path(__file__).parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

router = APIRouter(prefix="/api/nlp", tags=["nlp"])


class NLPRequest(BaseModel):
    query: str


@router.post("/parse")
def parse_nlp_query(req: NLPRequest):
    """Parse a natural-language fleet request into the structured request
    contract (origin/destination/vessel_type/fuel_type/speed/cargo/objectives).
    Never invents a value; unspecified fields are returned as null/empty.
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    try:
        from nlp.service import parse_natural_language

        return parse_natural_language(req.query)
    except Exception as exc:
        log.exception("NLP parsing failed")
        raise HTTPException(status_code=422, detail=f"Could not parse that request: {exc}") from exc
