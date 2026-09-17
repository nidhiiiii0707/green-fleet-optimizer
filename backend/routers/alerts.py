"""Alerts router — derived from the latest real optimization result.

Alerts are regenerated from the current optimization result on every fetch
(constraint failures, infeasible/warning assignments, missing solution data).
Acknowledged status is preserved across regenerations by alert id.
"""
from fastapi import APIRouter, HTTPException

import backend.job_manager as JM
from backend.pipeline_bridge import get_default_result

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

_ack_status: dict[str, str] = {}  # alert_id -> "active" | "acknowledged"


def _latest_result() -> dict | None:
    result = JM.get_latest_result()
    if result:
        return result
    try:
        return get_default_result()
    except Exception:
        return None


def _derive_alerts() -> list[dict]:
    result = _latest_result()
    if not result:
        return []

    alerts: list[dict] = []
    solutions = result.get("pareto_solutions", [])

    for solution in solutions:
        for assignment in solution.get("assignments", []):
            failed = [c for c in assignment.get("constraints", []) if c.get("status") == "failed"]
            for c in failed:
                alert_id = f"AL-{solution['id']}-{assignment['id']}-{c['label'].replace(' ', '_')}"
                alerts.append({
                    "id": alert_id,
                    "severity": "high",
                    "category": "Constraint Violation",
                    "title": f"{c['label']} failed on {assignment['id']}",
                    "description": c.get("note") or f"Constraint '{c['label']}' failed for assignment {assignment['id']} ({assignment.get('origin', assignment['originId'])} -> {assignment.get('destination', assignment['destinationId'])}) in {solution['label']}.",
                    "affected": f"{solution['id']} / {assignment['id']}",
                    "timestamp": "",
                    "status": _ack_status.get(alert_id, "active"),
                })
            if assignment.get("status") == "warning":
                alert_id = f"AL-{solution['id']}-{assignment['id']}-warning"
                alerts.append({
                    "id": alert_id,
                    "severity": "medium",
                    "category": "Feasibility Warning",
                    "title": f"Assignment {assignment['id']} flagged infeasible",
                    "description": f"Assignment {assignment['id']} in {solution['label']} was evaluated as infeasible by the feasibility checker.",
                    "affected": f"{solution['id']} / {assignment['id']}",
                    "timestamp": "",
                    "status": _ack_status.get(alert_id, "active"),
                })
        if not solution.get("assignments"):
            alert_id = f"AL-{solution['id']}-empty"
            alerts.append({
                "id": alert_id,
                "severity": "info",
                "category": "Data Availability",
                "title": f"{solution['label']} has no leg assignments",
                "description": solution.get("emptyStateReason") or "This optimizer solution returned no leg assignments.",
                "affected": solution["id"],
                "timestamp": "",
                "status": _ack_status.get(alert_id, "active"),
            })

    run_alert_id = f"AL-run-{result.get('run_id', 'unknown')}"
    alerts.append({
        "id": run_alert_id,
        "severity": "info",
        "category": "Optimization",
        "title": "Optimization run available",
        "description": f"{result.get('method', 'unknown method')} produced {result.get('pareto_count', 0)} Pareto-optimal solutions "
                        f"out of {result.get('feasible_solutions', 0)} evaluated (data_mode={result.get('data_mode', 'unknown')}).",
        "affected": "All",
        "timestamp": "",
        "status": _ack_status.get(run_alert_id, "active"),
    })

    return alerts


@router.get("")
def get_alerts():
    return {"alerts": _derive_alerts()}


@router.patch("/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str):
    alerts = _derive_alerts()
    if not any(a["id"] == alert_id for a in alerts):
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")
    _ack_status[alert_id] = "acknowledged"
    alert = next(a for a in alerts if a["id"] == alert_id)
    alert["status"] = "acknowledged"
    return {"success": True, "alert": alert}


@router.patch("/{alert_id}/reopen")
def reopen_alert(alert_id: str):
    alerts = _derive_alerts()
    if not any(a["id"] == alert_id for a in alerts):
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")
    _ack_status[alert_id] = "active"
    alert = next(a for a in alerts if a["id"] == alert_id)
    alert["status"] = "active"
    return {"success": True, "alert": alert}


@router.get("/summary")
def get_alert_summary():
    alerts = _derive_alerts()
    high   = sum(1 for a in alerts if a["severity"] == "high"   and a["status"] == "active")
    medium = sum(1 for a in alerts if a["severity"] == "medium" and a["status"] == "active")
    info   = sum(1 for a in alerts if a["severity"] == "info"   and a["status"] == "active")
    return {"high": high, "medium": medium, "info": info, "total_active": high + medium + info}
