"""Alerts router."""
from fastapi import APIRouter, HTTPException
from backend.pipeline_bridge import ALERTS_STATIC
import copy

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# In-memory alerts store (initialized from static data)
_alerts = copy.deepcopy(ALERTS_STATIC)


@router.get("")
def get_alerts():
    return {"alerts": _alerts}


@router.patch("/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str):
    for alert in _alerts:
        if alert["id"] == alert_id:
            alert["status"] = "acknowledged"
            return {"success": True, "alert": alert}
    raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")


@router.patch("/{alert_id}/reopen")
def reopen_alert(alert_id: str):
    for alert in _alerts:
        if alert["id"] == alert_id:
            alert["status"] = "active"
            return {"success": True, "alert": alert}
    raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")


@router.get("/summary")
def get_alert_summary():
    high   = sum(1 for a in _alerts if a["severity"] == "high"   and a["status"] == "active")
    medium = sum(1 for a in _alerts if a["severity"] == "medium" and a["status"] == "active")
    info   = sum(1 for a in _alerts if a["severity"] == "info"   and a["status"] == "active")
    return {"high": high, "medium": medium, "info": info, "total_active": high + medium + info}
