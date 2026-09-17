"""Scenario analysis router."""
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
import backend.job_manager as JM
from backend.pipeline_bridge import compute_scenario_result

router = APIRouter(prefix="/api/scenario", tags=["scenario"])


class ScenarioControls(BaseModel):
    demand: float = 100
    fuel: float = 100
    ghg: float = 100
    deadline: float = 100
    vessels: float = 100
    fuelAvail: float = 100
    portCap: float = 100


@router.post("/run")
def run_scenario(controls: ScenarioControls):
    """Run scenario analysis — returns result synchronously (fast computation)."""
    result = compute_scenario_result(controls.model_dump())
    return result


@router.post("/run-async")
def run_scenario_async(controls: ScenarioControls, background_tasks: BackgroundTasks):
    """Trigger async optimization with modified constraints."""
    job = JM.create_job()
    background_tasks.add_task(_scenario_task, job.id, controls.model_dump())
    return {"job_id": job.id, "status": job.status}


def _scenario_task(job_id: str, controls: dict):
    job = JM.get_job(job_id)
    if job is None:
        return
    JM.update_job(job, JM.JobStatus.RUNNING, 10, "Computing scenario...")
    try:
        result = compute_scenario_result(controls)
        JM.update_job(job, JM.JobStatus.COMPLETED, 100, "Scenario complete.", result=result)
    except Exception as exc:
        JM.update_job(job, JM.JobStatus.FAILED, 0, str(exc), error=str(exc))
