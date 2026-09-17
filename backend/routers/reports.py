"""Reports router — always sourced from the latest real optimization result."""
import csv
import io
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

import backend.job_manager as JM
from backend.pipeline_bridge import get_default_result

router = APIRouter(prefix="/api/reports", tags=["reports"])

REPORTS_DATA = [
    {
        "id": "R01",
        "title": "Optimization Report",
        "description": "Full summary of the NSGA-II / QBHO / CQM / MILP / MO-QIGA optimization run, including Pareto-optimal plans, method performance, constraint satisfaction, and solution comparison.",
        "date": "",
        "run": "",
        "type": "optimization",
        "ready": True,
    },
    {
        "id": "R02",
        "title": "Sustainability Report",
        "description": "Lifecycle GHG per assignment and fuel mix breakdown for the selected solution.",
        "date": "",
        "run": "",
        "type": "sustainability",
        "ready": True,
    },
    {
        "id": "R03",
        "title": "Trade-off Analysis",
        "description": "Comparison of all Pareto-optimal fleet plans across fuel, cost and GHG objectives.",
        "date": "",
        "run": "",
        "type": "tradeoff",
        "ready": True,
    },
    {
        "id": "R04",
        "title": "Compliance Report",
        "description": "Constraint satisfaction status for every leg assignment in the selected solution.",
        "date": "",
        "run": "",
        "type": "compliance",
        "ready": True,
    },
]


def _latest_result() -> dict:
    result = JM.get_latest_result()
    return result if result else get_default_result()


def _solution(result: dict, solution_id: str | None) -> dict:
    solutions = result.get("pareto_solutions", [])
    if not solutions:
        raise HTTPException(status_code=404, detail="No solutions in the latest optimization result.")
    target_id = solution_id or result.get("selected_solution_id")
    for solution in solutions:
        if solution["id"] == target_id:
            return solution
    raise HTTPException(status_code=404, detail=f"Solution {target_id} not found in the latest result.")


@router.get("")
def list_reports():
    result = JM.get_latest_result()
    run_id = result.get("run_id", "") if result else ""
    reports = [{**r, "run": run_id} for r in REPORTS_DATA]
    return {"reports": reports}


@router.get("/{report_id}/export")
def export_report(report_id: str, format: str = "csv", solution_id: str | None = None):
    report = next((r for r in REPORTS_DATA if r["id"] == report_id), None)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found.")

    result = _latest_result()
    solutions = result.get("pareto_solutions", [])

    if format == "csv":
        output = io.StringIO()
        if report_id == "R01" or report_id == "R03":
            writer = csv.writer(output)
            writer.writerow(["solution_id", "label", "algorithm", "fuel", "cost_musd", "ghg_kgco2",
                             "cargo_fulfillment_pct", "vessels", "routes",
                             "constraints_satisfied", "total_constraints", "pareto_optimal"])
            for s in solutions:
                writer.writerow([
                    s["id"], s["label"], s.get("algorithm", ""), s["fuel"], s["cost"], s["ghg"],
                    s["cargoFulfillment"] if s["cargoFulfillment"] is not None else "",
                    s["vessels"], s["routes"],
                    s["constraintsSatisfied"], s["totalConstraints"],
                    "Yes" if s["pareto"] else "No",
                ])
        elif report_id == "R02":
            solution = _solution(result, solution_id)
            writer = csv.writer(output)
            writer.writerow(["solution_id", "vessel_id", "fuel_type", "fuel_consumption",
                             "ghg_kgco2", "shorepower", "route_id"])
            for a in solution["assignments"]:
                writer.writerow([
                    solution["id"], a["vesselId"], a["fuelType"], a["fuelConsumption"],
                    a["ghg"], a["shorepower"], a["routeId"],
                ])
        else:  # R04 compliance
            solution = _solution(result, solution_id)
            writer = csv.writer(output)
            writer.writerow(["solution_id", "assignment_id", "constraint_label", "status", "note"])
            for a in solution["assignments"]:
                for c in a["constraints"]:
                    writer.writerow([solution["id"], a["id"], c["label"], c["status"], c.get("note") or ""])

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
    """Bulk export: all Pareto solutions from the latest real result, as CSV."""
    result = _latest_result()
    solutions = result.get("pareto_solutions", [])

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["solution_id", "label", "algorithm", "fuel", "cost_musd", "ghg_kgco2",
                     "cargo_fulfillment_pct", "vessels", "routes",
                     "constraints_satisfied", "total_constraints", "pareto_optimal"])
    for s in solutions:
        writer.writerow([
            s["id"], s["label"], s.get("algorithm", ""), s["fuel"], s["cost"], s["ghg"],
            s["cargoFulfillment"] if s["cargoFulfillment"] is not None else "",
            s["vessels"], s["routes"],
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
def export_fleet_assignments(solution_id: str | None = None):
    """Bulk export: fleet assignments for a solution (default: the latest selected one) as CSV."""
    result = _latest_result()
    solution = _solution(result, solution_id)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["assignment_id", "vessel_id", "origin", "destination",
                     "route_id", "speed_kn", "fuel_type", "shorepower",
                     "eta", "fuel_consumption", "cost_kusd", "ghg_kgco2", "status"])
    for a in solution["assignments"]:
        writer.writerow([
            a["id"], a["vesselId"], a["originId"], a["destinationId"],
            a["routeId"], a["speed"], a["fuelType"], a["shorepower"],
            a["eta"], a["fuelConsumption"], a["cost"], a["ghg"], a["status"],
        ])
    output.seek(0)
    filename = f"greenfleet_fleet_assignments_{solution['id']}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
