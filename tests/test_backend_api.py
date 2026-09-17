"""Backend API regression tests — real data end-to-end, no mock fallback.

Covers: health, ports/routes/fleet endpoints (real derived data), and the
S07-hardcode regression (solution selection must be consistent for at least
two distinct solution ids).
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_ports_are_real_derived_data():
    resp = client.get("/api/fleet/ports")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data_mode"] == "real_derived"
    ports = body["ports"]
    assert len(ports) > 0
    for port in ports[:5]:
        assert isinstance(port["latitude"], float)
        assert isinstance(port["longitude"], float)
        assert port["name"]
    # No hard-coded prototype port list (RTM/SGP/... 12-port static set).
    ids = {p["id"] for p in ports}
    assert len(ids) > 12


def test_routes_are_real_derived_data():
    resp = client.get("/api/fleet/routes")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data_mode"] == "real_derived"
    routes = body["routes"]
    assert len(routes) > 0
    for route in routes[:5]:
        assert route["originId"]
        assert route["destinationId"]
        assert isinstance(route["originLatitude"], float)


def test_vessels_are_real_derived_data():
    resp = client.get("/api/fleet/vessels")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data_mode"] == "real_derived"
    vessels = body["vessels"]
    assert len(vessels) > 0
    for v in vessels:
        assert v["dataLevel"] == "fleet_segment_ship_type"


def test_fleet_summary():
    resp = client.get("/api/fleet/summary")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_ports"] > 0
    assert body["total_routes"] > 0


def test_latest_optimization_has_real_pareto_archive():
    resp = client.get("/api/optimization/latest")
    assert resp.status_code == 200
    body = resp.json()
    assert body["data_mode"] in ("real_precomputed", "real_runtime")
    solutions = body["pareto_solutions"]
    assert len(solutions) >= 2, "expected the real Pareto archive (4 solutions), not a fabricated 18-solution demo set"
    ids = [s["id"] for s in solutions]
    assert len(ids) == len(set(ids))
    # No fabricated 18/24-solution demo archive.
    assert len(solutions) < 10


@pytest.mark.parametrize("index", [0, 1])
def test_solution_selection_is_consistent_across_two_solutions(index):
    """Regression test for the S17-selected/S07-assignments bug: selecting
    solution N must return solution N's own assignments, not another one's."""
    latest = client.get("/api/optimization/latest").json()
    solutions = latest["pareto_solutions"]
    assert len(solutions) > index, "not enough real solutions to run this regression test"
    target = solutions[index]

    resp = client.get(f"/api/optimization/solution/{target['id']}")
    assert resp.status_code == 200
    body = resp.json()

    assert body["id"] == target["id"]
    assert body["fuel"] == target["fuel"]
    assert body["cost"] == target["cost"]
    assert body["ghg"] == target["ghg"]
    returned_assignment_ids = [a["id"] for a in body["assignments"]]
    expected_assignment_ids = [a["id"] for a in target["assignments"]]
    assert returned_assignment_ids == expected_assignment_ids
    # Every returned assignment id must actually belong to this solution (prefixed with its id).
    for assignment_id in returned_assignment_ids:
        assert assignment_id.startswith(f"{target['id']}-"), (
            f"assignment {assignment_id} does not belong to solution {target['id']} "
            "(this is the S17-selected/S07-assignments failure mode)"
        )


def test_unknown_solution_returns_404():
    resp = client.get("/api/optimization/solution/S99")
    assert resp.status_code == 404


def test_alerts_derive_from_real_result_not_static_demo():
    resp = client.get("/api/alerts")
    assert resp.status_code == 200
    alerts = resp.json()["alerts"]
    # The old static fixture always had exactly 12 alerts with ids AL01..AL12.
    ids = {a["id"] for a in alerts}
    assert not any(i.startswith("AL0") and len(i) == 4 for i in ids)


def test_reports_export_uses_selected_solution_not_hardcoded_s07():
    latest = client.get("/api/optimization/latest").json()
    solutions = latest["pareto_solutions"]
    assert len(solutions) >= 2
    a, b = solutions[0], solutions[1]

    resp_a = client.get(f"/api/reports/R02/export?format=csv&solution_id={a['id']}")
    resp_b = client.get(f"/api/reports/R02/export?format=csv&solution_id={b['id']}")
    assert resp_a.status_code == 200
    assert resp_b.status_code == 200
    # Different solutions' sustainability exports must differ when their
    # assignments differ (guards against a hard-coded S07 export).
    if a["assignments"] != b["assignments"]:
        assert resp_a.text != resp_b.text
