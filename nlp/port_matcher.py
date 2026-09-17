"""Port validation and spelling suggestions."""

from rapidfuzz import fuzz, process


VALID_PORTS = [
    "Yokohama",
    "Singapore",
    "Shanghai",
    "Busan",
    "Hong Kong",
    "Guangzhou",
    "Nagoya",
]

SUGGESTION_THRESHOLD = 70


def validate_port(port: str | None) -> tuple[bool | None, str | None]:
    """Validate a port and suggest a close match without changing the input."""

    if port is None:
        return None, None

    normalized = port.casefold()
    if any(normalized == valid.casefold() for valid in VALID_PORTS):
        return True, None

    match = process.extractOne(port, VALID_PORTS, scorer=fuzz.WRatio)
    if match and match[1] >= SUGGESTION_THRESHOLD:
        return False, match[0]
    return False, None
