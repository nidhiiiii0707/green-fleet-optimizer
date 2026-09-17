"""Optional AI preprocessing for Green Fleet NLP."""

from .normalizer import NormalizationError, normalize_query

__all__ = ["NormalizationError", "normalize_query"]
