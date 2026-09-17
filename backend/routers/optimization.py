"""Optimization router — run, status, results, WebSocket."""
from __future__ import annotations

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

import backend.job_manager as JM
from backend.pipeline_bridge import get_default_result, get_solution_by_id, run_optimization_async

router = APIRouter(prefix="/api/optimization", tags=["optimization"])


class RunRequest(BaseModel):
    seed: int = 42
    use_real_pipeline: bool = False


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
    background_tasks.add_task(_run_optimization_task, job.id, req.seed, req.use_real_pipeline)
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
    sol = get_solution_by_id(solution_id)
    if sol is None:
        # Try from latest result
        result = JM.get_latest_result()
        if result:
            for s in result.get("pareto_solutions", []):
                if s["id"] == solution_id:
                    return s
        raise HTTPException(status_code=404, detail="Solution not found.")
    return sol


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

def _run_optimization_task(job_id: str, seed: int, use_real: bool):
    job = JM.get_job(job_id)
    if job is None:
        return

    JM.update_job(job, JM.JobStatus.RUNNING, 5, "Initializing optimization pipeline...")

    def progress_cb(pct: int, msg: str):
        JM.update_job(job, JM.JobStatus.RUNNING, pct, msg)

    try:
        progress_cb(10, "Loading data and generating candidates...")
        result = run_optimization_async(job, progress_cb=progress_cb if use_real else None)
        progress_cb(95, "Finalizing Pareto archive...")
        JM.set_latest_result(result)
        JM.update_job(job, JM.JobStatus.COMPLETED, 100, "Optimization complete.", result=result)
    except Exception as exc:
        JM.update_job(job, JM.JobStatus.FAILED, job.progress, f"Error: {exc}", error=str(exc))
