"""Optimization router — run, status, results, WebSocket."""
from __future__ import annotations

import asyncio
import json
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

import backend.job_manager as JM
from backend.pipeline_bridge import get_default_result, get_solution_by_id, run_optimization_async

router = APIRouter(prefix="/api/optimization", tags=["optimization"])


class StructuredRequest(BaseModel):
    """The same structured request shape produced by the manual form and by
    NLP parsing (see nlp/optimization_adapter.py build_optimization_request).
    Every field is optional; unspecified fields stay unrestricted — never
    invented."""

    origin: Optional[str] = None
    destination: Optional[str] = None
    vessel_type: Optional[str] = None
    fuel_type: Optional[str] = None
    speed: Optional[float] = None
    cargo: Optional[float] = None
    objectives: list[Literal["fuel", "cost", "ghg"]] = []


class RunRequest(BaseModel):
    seed: int = 42
    use_real_pipeline: bool = False
    request: Optional[StructuredRequest] = None


# ── Initialize default result on first import ────────────────────────────────
_initialized = False


def _ensure_default():
    global _initialized
    if not _initialized:
        JM.set_latest_result(get_default_result())
        _initialized = True


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/latest")
def get_latest():
    _ensure_default()
    result = JM.get_latest_result()
    if result is None:
        raise HTTPException(status_code=404, detail="No optimization results available yet.")
    return result


@router.post("/run")
def trigger_run(req: RunRequest, background_tasks: BackgroundTasks):
    job = JM.create_job()
    structured_request = req.request.model_dump() if req.request else None
    background_tasks.add_task(
        _run_optimization_task, job.id, req.seed, req.use_real_pipeline, structured_request
    )
    return {"job_id": job.id, "status": job.status}


@router.get("/status/{job_id}")
def get_status(job_id: str):
    job = JM.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return {
        "job_id": job.id,
        "status": job.status,
        "progress": job.progress,
        "message": job.step_msg,
        "created_at": job.created_at,
        "completed_at": job.completed_at,
        "error": job.error,
    }


@router.get("/results/{job_id}")
def get_results(job_id: str):
    job = JM.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status != JM.JobStatus.COMPLETED:
        raise HTTPException(status_code=202, detail=f"Job not completed yet. Status: {job.status}")
    return job.result


@router.get("/solution/{solution_id}")
def get_solution(solution_id: str):
    _ensure_default()
    result = JM.get_latest_result()
    if result:
        for solution in result.get("pareto_solutions", []):
            if solution["id"] == solution_id:
                return solution
    raise HTTPException(status_code=404, detail="Solution not found in the latest real optimization result.")


# ── WebSocket streaming ───────────────────────────────────────────────────────

@router.websocket("/ws/{job_id}")
async def ws_optimization(websocket: WebSocket, job_id: str):
    await websocket.accept()
    job = JM.get_job(job_id)
    if job is None:
        await websocket.send_json({"error": "Job not found"})
        await websocket.close()
        return

    # If already done, send final state and close
    if job.status in (JM.JobStatus.COMPLETED, JM.JobStatus.FAILED):
        await websocket.send_json({
            "status": job.status,
            "progress": job.progress,
            "message": job.step_msg,
        })
        await websocket.close()
        return

    queue = job.subscribe()
    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_json(event)
                if event.get("status") in (JM.JobStatus.COMPLETED, JM.JobStatus.FAILED):
                    break
            except asyncio.TimeoutError:
                await websocket.send_json({"ping": True})
    except WebSocketDisconnect:
        pass
    finally:
        job.unsubscribe(queue)
        await websocket.close()


# ── Background task ───────────────────────────────────────────────────────────

def _run_optimization_task(job_id: str, seed: int, use_real: bool, structured_request: dict | None = None):
    job = JM.get_job(job_id)
    if job is None:
        return

    JM.update_job(job, JM.JobStatus.RUNNING, 5, "Initializing optimization pipeline...")

    def progress_cb(pct: int, msg: str):
        JM.update_job(job, JM.JobStatus.RUNNING, pct, msg)

    try:
        progress_cb(10, "Loading data and generating candidates...")
        if structured_request is not None:
            # A structured request (from the manual form or from NLP parsing)
            # always runs the real pipeline filtered to that request.
            result = run_optimization_async(job, seed=seed, progress_cb=progress_cb, request=structured_request)
        else:
            result = (
                run_optimization_async(job, seed=seed, progress_cb=progress_cb)
                if use_real else get_default_result()
            )
        progress_cb(95, "Finalizing Pareto archive...")
        JM.set_latest_result(result)
        JM.update_job(job, JM.JobStatus.COMPLETED, 100, "Optimization complete.", result=result)
    except Exception as exc:
        JM.update_job(job, JM.JobStatus.FAILED, job.progress, f"Error: {exc}", error=str(exc))
