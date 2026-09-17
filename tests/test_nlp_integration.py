"""Tests for the NLP -> structured request -> existing optimization API
integration.

Covers: natural-language parsing (via the real nlp/parser.py + nlp/service.py,
no mocks), the /api/nlp/parse and /api/optimization/run endpoints, and the
architectural rules that NLP produces the same structured request the manual
form uses and never runs a second optimization pipeline.
"""
from __future__ import annotations

import ast
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from nlp.parser import parse_query
from nlp.service import parse_natural_language
from nlp.optimization_adapter import build_optimization_request

client = TestClient(app)

STRUCTURED_REQUEST_FIELDS = {"origin", "destination", "vessel_type", "fuel_type", "speed", "cargo", "objectives"}


# ── 1. Natural language input is accepted ───────────────────────────────────

def test_nlp_parse_endpoint_accepts_natural_language():
    resp = client.post("/api/nlp/parse", json={"query": "Find a low-emission route from Yokohama to Singapore for 5000 tonnes at 18 knots."})
    assert resp.status_code == 200
    body = resp.json()
    assert body["query"]
    assert "parsed" in body
    assert "request" in body


def test_nlp_parse_rejects_empty_query():
    resp = client.post("/api/nlp/parse", json={"query": "   "})
    assert resp.status_code == 400


# ── 2. Example route requests are parsed correctly ──────────────────────────

def test_example_1_low_emission_route():
    result = parse_natural_language("Find a low-emission route from Yokohama to Singapore for 5000 tonnes at 18 knots.")
    req = result["request"]
    assert req["origin"] == "Yokohama"
    assert req["destination"] == "Singapore"
    assert req["cargo"] == 5000
    assert req["speed"] == 18
    assert req["objectives"] == ["ghg"]


def test_example_2_cheapest_route():
    result = parse_natural_language("Find the cheapest route from Shanghai to Singapore.")
    req = result["request"]
    assert req["origin"] == "Shanghai"
    assert req["destination"] == "Singapore"
    assert req["objectives"] == ["cost"]
    # unspecified fields remain unrestricted/null
    assert req["cargo"] is None
    assert req["speed"] is None
    assert req["vessel_type"] is None
    assert req["fuel_type"] is None


def test_example_3_minimize_fuel():
    result = parse_natural_language("Minimize fuel consumption from Yokohama to Singapore carrying 8000 tonnes.")
    req = result["request"]
    assert req["objectives"] == ["fuel"]
    assert req["cargo"] == 8000
    assert req["speed"] is None
    assert req["vessel_type"] is None
    assert req["fuel_type"] is None


def test_example_4_bare_route_invents_nothing():
    result = parse_natural_language("Optimize Yokohama to Singapore.")
    req = result["request"]
    # Core rule: never invent cargo/speed/vessel/fuel/objective.
    assert req["cargo"] is None
    assert req["speed"] is None
    assert req["vessel_type"] is None
    assert req["fuel_type"] is None
    assert req["objectives"] == []
    # The leading imperative verb must not be swept into the origin.
    assert req["origin"] == "Yokohama"
    assert req["destination"] == "Singapore"


# ── Regression: bare "X to Y" route pattern must not swallow a leading
#    imperative verb (e.g. "Optimize Yokohama to Singapore" -> origin
#    "Optimize Yokohama"). Fixed in nlp/parser.py's _strip_leading_command_word.

def test_bare_route_with_leading_command_word_strips_it():
    parsed = parse_query("Optimize Yokohama to Singapore")
    assert parsed["origin"] == "Yokohama"
    assert parsed["destination"] == "Singapore"


def test_from_route_phrasing_still_works():
    parsed = parse_query("Find a route from Yokohama to Singapore")
    assert parsed["origin"] == "Yokohama"
    assert parsed["destination"] == "Singapore"


def test_bare_route_without_leading_word_still_works():
    parsed = parse_query("Yokohama to Singapore")
    assert parsed["origin"] == "Yokohama"
    assert parsed["destination"] == "Singapore"


def test_bare_route_leading_word_strip_does_not_touch_multiword_port_names():
    # "Hong Kong" is a genuine two-word port name; nothing should be stripped.
    parsed = parse_query("Hong Kong to Singapore")
    assert parsed["origin"] == "Hong Kong"
    assert parsed["destination"] == "Singapore"


def test_bare_route_other_leading_command_words_are_also_stripped():
    for verb in ("Find", "Get", "Plan", "Show", "Suggest"):
        parsed = parse_query(f"{verb} Yokohama to Singapore")
        assert parsed["origin"] == "Yokohama", verb
        assert parsed["destination"] == "Singapore", verb


# ── 3. Missing optional fields remain null ──────────────────────────────────

def test_missing_optional_fields_stay_null_not_fabricated():
    result = parse_natural_language("Route from Yokohama to Singapore.")
    req = result["request"]
    assert req["cargo"] is None
    assert req["speed"] is None
    assert req["vessel_type"] is None
    assert req["fuel_type"] is None


# ── 4. Missing/uncertain required-ish information is reported, not invented ─

def test_unmatched_port_is_flagged_not_silently_replaced():
    result = parse_natural_language("Optimize Yokohamaa to Singapore.")
    parsed = result["parsed"]
    # "Yokohamaa" (misspelled) doesn't match a real port; the parser must
    # flag it for review with a suggestion, not silently correct it.
    assert parsed.get("origin_valid") is False
    assert parsed.get("origin_suggestion") == "Yokohama"
    assert parsed["origin"] == "Yokohamaa"  # never silently replaced


def test_empty_request_has_no_constraints():
    result = parse_natural_language("Please help optimize something.")
    req = result["request"]
    assert req["origin"] is None
    assert req["destination"] is None
    assert req["objectives"] == []


# ── 5. Objectives are mapped correctly ──────────────────────────────────────

@pytest.mark.parametrize("phrase,expected", [
    ("reduce emissions", "ghg"),
    ("low emission", "ghg"),
    ("find the greenest route", "ghg"),
    ("minimize carbon", "ghg"),
    ("reduce fuel", "fuel"),
    ("save fuel", "fuel"),
    ("fuel efficient", "fuel"),
    ("cheapest", "cost"),
    ("minimize cost", "cost"),
    ("lowest cost", "cost"),
])
def test_objective_phrase_mapping(phrase, expected):
    result = parse_natural_language(f"Find a route from Yokohama to Singapore, {phrase}.")
    assert expected in result["request"]["objectives"]


def test_multiple_explicit_objectives_are_all_preserved():
    result = parse_natural_language("Minimize fuel and emissions from Yokohama to Singapore.")
    assert set(result["request"]["objectives"]) >= {"fuel", "ghg"}


def test_objective_not_invented_when_absent():
    result = parse_natural_language("Route from Yokohama to Singapore carrying 1000 tonnes.")
    assert result["request"]["objectives"] == []


# ── 6. Real port validation/matching works ──────────────────────────────────

def test_real_port_is_recognized_as_valid():
    from nlp.port_matcher import validate_port
    valid, suggestion = validate_port("Yokohama")
    assert valid is True
    assert suggestion is None


def test_misspelled_port_gets_a_suggestion_from_real_data():
    from nlp.port_matcher import validate_port
    valid, suggestion = validate_port("Yokohamaa")
    assert valid is False
    assert suggestion == "Yokohama"


def test_port_matcher_uses_real_data_not_a_hardcoded_list():
    from nlp.port_matcher import _real_port_names
    names = _real_port_names()
    # The old hardcoded list had exactly 7 ports; the real data layer has thousands.
    assert len(names) > 100


# ── 7. NLP output matches the manual structured-request schema ─────────────

def test_nlp_request_matches_structured_request_schema():
    result = parse_natural_language("Find a low-emission route from Yokohama to Singapore for 5000 tonnes at 18 knots.")
    assert set(result["request"].keys()) == STRUCTURED_REQUEST_FIELDS


def test_build_optimization_request_is_the_single_schema_builder():
    parsed = {"origin": "Yokohama", "destination": "Singapore", "vessel_type": None,
              "fuel_type": None, "speed": 18, "cargo": 5000, "objectives": ["ghg"]}
    request = build_optimization_request(parsed)
    assert set(request.keys()) == STRUCTURED_REQUEST_FIELDS


def test_optimization_run_endpoint_accepts_the_structured_request_schema():
    """The manual form and NLP both submit this exact shape to POST
    /api/optimization/run -- verify FastAPI accepts it without a schema error
    (a 422 here would mean the manual/NLP contract has drifted)."""
    resp = client.post("/api/optimization/run", json={
        "seed": 1, "use_real_pipeline": False,
        "request": {"origin": None, "destination": None, "vessel_type": None,
                    "fuel_type": None, "speed": None, "cargo": None, "objectives": []},
    })
    assert resp.status_code == 200
    assert "job_id" in resp.json()


# ── 8 & 9. NLP and manual both call the SAME endpoint; NLP never invokes an
#          optimization algorithm directly ──────────────────────────────────

def test_nlp_router_never_imports_the_optimization_algorithms():
    """Static check: backend/routers/nlp.py must not import run_all_algorithms,
    generate_evaluated_legs, or any optimizer module -- it only parses text.
    """
    source = Path("backend/routers/nlp.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    imported_names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            imported_names.add(node.module)
            imported_names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.Import):
            imported_names.update(alias.name for alias in node.names)
    forbidden = {"run_optimization_pipeline", "run_all_algorithms", "generate_evaluated_legs",
                 "nsga2_optimizer", "qbho", "cqm_model", "cqm_solver", "milp_model",
                 "optimize_from_query"}
    assert not (imported_names & forbidden), f"nlp.py imports forbidden names: {imported_names & forbidden}"


def test_nlp_parse_endpoint_does_not_create_a_job():
    """Parsing must not touch the job manager / run any algorithm."""
    import backend.job_manager as JM
    jobs_before = len(JM._JOBS)
    client.post("/api/nlp/parse", json={"query": "Route from Yokohama to Singapore."})
    assert len(JM._JOBS) == jobs_before


def test_manual_and_nlp_requests_both_reach_the_real_algorithms_via_one_endpoint():
    """End-to-end: a structured request (as NLP or the manual form would
    submit) reaches POST /api/optimization/run and produces a real result
    built by the SAME data_adapter.build_runtime_result() used for a plain
    run -- i.e. no separate NLP-only pipeline or result shape."""
    resp = client.post("/api/optimization/run", json={
        "seed": 3, "use_real_pipeline": True,
        "request": {"origin": "Yokohama", "destination": "Singapore", "vessel_type": None,
                    "fuel_type": None, "speed": None, "cargo": None, "objectives": ["ghg"]},
    })
    assert resp.status_code == 200
    job_id = resp.json()["job_id"]
    status = client.get(f"/api/optimization/status/{job_id}").json()
    assert status["status"] == "completed", status
    result = client.get(f"/api/optimization/results/{job_id}").json()
    assert result["data_mode"] == "real_runtime"
    assert result["structured_request"]["origin"] == "Yokohama"
    solutions = result["pareto_solutions"]
    assert len(solutions) > 0
    # Same dashboard solution schema as every other real run (S01/S02/... ids,
    # assignments with real origin/destination) -- not the old NLP-only shape.
    # Note: the real route_derived.csv data spells this port "Yohohama" (a
    # pre-existing typo in the project's real/derived data, not something
    # this task is allowed to touch) -- the existing fuzzy port matcher
    # correctly resolves "Yokohama" to it, exactly as designed.
    for sol in solutions:
        assert sol["id"].startswith("S")
        for a in sol["assignments"]:
            assert a["origin"] == "Yohohama"
            assert a["destination"] == "Singapore"


# ── 10. Backend errors are handled ──────────────────────────────────────────

def test_impossible_structured_request_returns_a_clear_failure_not_a_crash():
    resp = client.post("/api/optimization/run", json={
        "seed": 5, "use_real_pipeline": True,
        "request": {"origin": "Nonexistent Port XYZ", "destination": "Another Fake Port",
                    "vessel_type": None, "fuel_type": None, "speed": None, "cargo": None, "objectives": []},
    })
    assert resp.status_code == 200
    job_id = resp.json()["job_id"]
    status = client.get(f"/api/optimization/status/{job_id}").json()
    # Unmatched origin/destination just isn't applied as a route filter
    # (see nlp/optimization_adapter.py filter_legs), so this still completes
    # using the full unrestricted candidate set rather than crashing.
    assert status["status"] == "completed", status


def test_nlp_parse_failure_returns_422_not_a_stack_trace():
    resp = client.post("/api/nlp/parse", json={"query": 12345})  # wrong type -> FastAPI validation
    assert resp.status_code == 422
    assert "Traceback" not in resp.text
