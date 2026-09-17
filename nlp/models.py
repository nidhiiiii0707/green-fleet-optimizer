"""Pydantic models used by the NLP service."""

from typing import Literal

from pydantic import BaseModel, Field


Objective = Literal["fuel", "cost", "ghg"]


class ParseRequest(BaseModel):
    """Request body accepted by the /parse endpoint."""

    query: str = Field(min_length=1, description="Natural-language fleet request")


class ParsedQuery(BaseModel):
    """Structured fields extracted from a natural-language request."""

    origin: str | None = None
    destination: str | None = None
    vessel_type: str | None = None
    fuel_type: str | None = None
    speed: int | float | None = None
    cargo: int | float | None = None
    objectives: list[Objective] = Field(default_factory=list)

    # These fields are emitted only when the corresponding port is invalid.
    origin_valid: bool | None = None
    origin_suggestion: str | None = None
    destination_valid: bool | None = None
    destination_suggestion: str | None = None

    def as_response(self) -> dict:
        """Keep absent extracted fields as null, but omit unused port metadata."""

        if hasattr(self, "model_dump"):
            result = self.model_dump()
        else:  # Pydantic v1 compatibility
            result = self.dict()

        for key in (
            "origin_valid",
            "origin_suggestion",
            "destination_valid",
            "destination_suggestion",
        ):
            if result[key] is None:
                result.pop(key)
        return result
