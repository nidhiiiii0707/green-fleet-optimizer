"""Rule-based detection of optimization objectives."""

import re


OBJECTIVE_PATTERNS = {
    "fuel": (
        r"\bfuel[\s-]+efficient\b",
        r"\bminimum\s+fuel\b",
        r"\bminimi[sz]e\s+fuel\b",
        r"\bsave\s+fuel\b",
        r"\breduce\s+fuel\b",
        r"\bless\s+fuel\b",
    ),
    "cost": (
        r"\bcheap(?:est)?\b",
        r"\blow[\s-]+cost\b",
        r"\bminimum\s+cost\b",
        r"\bminimi[sz]e\s+cost\b",
        r"\bcost[\s-]+efficient\b",
        r"\breduce\s+cost\b",
    ),
    "ghg": (
        r"\blow(?:est)?[\s-]+emissions?\b",
        r"\bminimum\s+emissions?\b",
        r"\bminimi[sz]e\s+(?:\w+\s+and\s+)?emissions?\b",
        r"\bemissions?\b",
        r"\bgreen\b",
        r"\beco[\s-]+friendly\b",
        r"\breduce\s+carbon\b",
        r"\breduce\s+ghg\b",
        r"\bminimi[sz]e\s+(?:\w+\s+and\s+)?ghg\b",
    ),
}


def detect_objectives(text: str) -> list[str]:
    """Return detected objectives in the order they first appear in the text."""

    matches: list[tuple[int, str]] = []
    for objective, patterns in OBJECTIVE_PATTERNS.items():
        positions = [
            match.start()
            for pattern in patterns
            if (match := re.search(pattern, text, flags=re.IGNORECASE))
        ]
        if positions:
            matches.append((min(positions), objective))

    return [objective for _, objective in sorted(matches)]
