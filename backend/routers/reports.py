"""Reports router."""
import csv
import io
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/reports", tags=["reports"])

REPORTS_DATA = [
    {
        "id": "R01",
        "title": "Optimization Report",
        "description": "Full summary of MO-QIGA optimization run #024, including Pareto-optimal plans, method performance, constraint satisfaction, and solution comparison.",
        "date": "04 Feb 2025",
        "run": "RUN #024",
        "type": "optimization",
        "ready": True,
    },
    {
        "id": "R02",
        "title": "Sustainability Report",
        "description": "Lifecycle GHG analysis, fuel mix breakdown (Well-to-Tank, Tank-to-Wake, Well-to-Wake), emissions per cargo unit, and comparison to industry benchmarks.",
        "date": "04 Feb 2025",
        "run": "RUN #024",
        "type": "sustainability",
        "ready": True,
    },
    {
        "id": "R03",
        "title": "Trade-off Analysis",
        "description": "Comparison of all 18 Pareto-optimal fleet plans across fuel, cost and GHG objectives. Includes sensitivity analysis and decision-support guidance.",
        "date": "04 Feb 2025",
        "run": "RUN #024",
        "type": "tradeoff",
        "ready": True,
    },
    {
        "id": "R04",
        "title": "Compliance Report",
        "description": "Regulatory compliance status for all active vessel assignments, including EU ETS, IMO GHG targets, port state control requirements, and shore-power usage.",
        "date": "04 Feb 2025",
        "run": "RUN #024",
        "type": "compliance",
        "ready": True,
    },
]


@router.get("")
def list_reports():
    return {"reports": REPORTS_DATA}


@router.get("/{report_id}/export")
def export_report(report_id: str, format: str = "csv"):
    report = next((r for r in REPORTS_DATA if r["id"] == report_id), None)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found.")

    from backend.pipeline_bridge import PARETO_SOLUTIONS_STATIC, ASSIGNMENTS_S07
    import backend.job_manager as JM

    result = JM.get_latest_result()
    solutions = result.get("pareto_solutions", PARETO_SOLUTIONS_STATIC) if result else PARETO_SOLUTIONS_STATIC

    if format == "csv":
        output = io.StringIO()
        if report_id == "R01":
            writer = csv.writer(output)
            writer.writerow(["solution_id", "label", "fuel_t", "cost_musd", "ghg_tco2e",
                             "cargo_fulfillment_pct", "vessels", "routes",
                             "constraints_satisfied", "total_constraints", "pareto_optimal"])
            for s in solutions:
                writer.writerow([
                    s["id"], s["label"], s["fuel"], s["cost"], s["ghg"],
                    s["cargoFulfillment"], s["vessels"], s["routes"],
                    s["constraintsSatisfied"], s["totalConstraints"],
                    "Yes" if s["pareto"] else "No",
                ])
        elif report_id == "R02":
            writer = csv.writer(output)
            writer.writerow(["vessel_id", "cargo", "fuel_type", "fuel_consumption_t",
                             "ghg_tco2e", "shorepower", "route_id"])
            for a in ASSIGNMENTS_S07:
                writer.writerow([
                    a["vesselId"], a["cargo"], a["fuelType"], a["fuelConsumption"],
                    a["ghg"], a["shorepower"], a["routeId"],
                ])
        else:
            writer = csv.writer(output)
            writer.writerow(["id", "title", "date", "run", "type"])
            writer.writerow([report["id"], report["title"], report["date"], report["run"], report["type"]])

        output.seek(0)
        filename = f"greenfleet_{report_id}_{report['type']}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    elif format == "json":
        data = {"report": report, "solutions": solutions[:5]}
        filename = f"greenfleet_{report_id}_{report['type']}.json"
        return StreamingResponse(
            iter([json.dumps(data, indent=2)]),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    raise HTTPException(status_code=400, detail="Unsupported format. Use 'csv' or 'json'.")


@router.get("/export/pareto-solutions")
def export_pareto_solutions():
    """Bulk export: all Pareto solutions as CSV."""
    import backend.job_manager as JM
    result = JM.get_latest_result()
    solutions = result.get("pareto_solutions", PARETO_SOLUTIONS_STATIC) if result else PARETO_SOLUTIONS_STATIC

    from backend.pipeline_bridge import PARETO_SOLUTIONS_STATIC
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["solution_id", "label", "fuel_t", "cost_musd", "ghg_tco2e",
                     "cargo_fulfillment_pct", "vessels", "routes",
                     "constraints_satisfied", "total_constraints", "pareto_optimal"])
    for s in solutions:
        writer.writerow([
            s["id"], s["label"], s["fuel"], s["cost"], s["ghg"],
            s["cargoFulfillment"], s["vessels"], s["routes"],
            s["constraintsSatisfied"], s["totalConstraints"],
            "Yes" if s["pareto"] else "No",
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=greenfleet_pareto_solutions.csv"},
    )


@router.get("/export/fleet-assignments")
def export_fleet_assignments():
    """Bulk export: fleet assignments as CSV."""
    from backend.pipeline_bridge import ASSIGNMENTS_S07
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["assignment_id", "vessel_id", "cargo", "origin", "destination",
                     "route_id", "speed_kn", "fuel_type", "shorepower",
                     "eta", "fuel_consumption_t", "cost_kusd", "ghg_tco2e", "status"])
    for a in ASSIGNMENTS_S07:
        writer.writerow([
            a["id"], a["vesselId"], a["cargo"], a["originId"], a["destinationId"],
            a["routeId"], a["speed"], a["fuelType"], a["shorepower"],
            a["eta"], a["fuelConsumption"], a["cost"], a["ghg"], a["status"],
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=greenfleet_fleet_assignments.csv"},
    )
