"""Fleet data router — vessels, ports, routes."""
from fastapi import APIRouter
from backend.pipeline_bridge import VESSELS_STATIC, PORTS_STATIC, ROUTES_STATIC

router = APIRouter(prefix="/api/fleet", tags=["fleet"])


@router.get("/vessels")
def get_vessels():
    return {"vessels": VESSELS_STATIC}


@router.get("/ports")
def get_ports():
    return {"ports": PORTS_STATIC}


@router.get("/routes")
def get_routes():
    return {"routes": ROUTES_STATIC}


@router.get("/summary")
def get_fleet_summary():
    available = sum(1 for v in VESSELS_STATIC if v["availability"] == "available")
    in_transit = sum(1 for v in VESSELS_STATIC if v["availability"] == "in-transit")
    maintenance = sum(1 for v in VESSELS_STATIC if v["availability"] == "maintenance")
    return {
        "total_vessels": len(VESSELS_STATIC),
        "available": available,
        "in_transit": in_transit,
        "maintenance": maintenance,
        "total_ports": len(PORTS_STATIC),
        "total_routes": len(ROUTES_STATIC),
    }
