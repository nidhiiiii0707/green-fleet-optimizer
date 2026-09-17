"""Fleet data router — vessels, ports, routes."""
from fastapi import APIRouter
from backend.data_adapter import load_ports, load_routes, load_vessel_classes

router = APIRouter(prefix="/api/fleet", tags=["fleet"])


@router.get("/vessels")
def get_vessels():
    return {"vessels": load_vessel_classes(), "data_mode": "real_derived"}


@router.get("/ports")
def get_ports():
    return {"ports": load_ports(), "data_mode": "real_derived"}


@router.get("/routes")
def get_routes():
    return {"routes": load_routes(), "data_mode": "real_derived"}


@router.get("/summary")
def get_fleet_summary():
    vessels, ports, routes = load_vessel_classes(), load_ports(), load_routes()
    return {
        "total_vessels": len(vessels),
        "available": None,
        "in_transit": None,
        "maintenance": None,
        "total_ports": len(ports),
        "total_routes": len(routes),
        "data_level": "fleet_segment_ship_type",
    }
