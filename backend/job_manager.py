"""Job manager for async optimization runs."""
from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Optional


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Job:
    id: str
    status: JobStatus = JobStatus.PENDING
    progress: int = 0          # 0-100
    step_msg: str = ""
    result: Optional[Any] = None
    error: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    completed_at: Optional[str] = None
    # WebSocket subscribers: list of asyncio.Queue
    _subscribers: list = field(default_factory=list, repr=False)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        try:
            self._subscribers.remove(q)
        except ValueError:
            pass

    def emit(self, event: dict):
        for q in list(self._subscribers):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                pass


# Global in-memory job store
_JOBS: dict[str, Job] = {}
_LATEST_RESULT: Optional[Any] = None  # cached latest completed optimization


def create_job() -> Job:
    job_id = str(uuid.uuid4())
    job = Job(id=job_id)
    _JOBS[job_id] = job
    return job


def get_job(job_id: str) -> Optional[Job]:
    return _JOBS.get(job_id)


def set_latest_result(result: Any):
    global _LATEST_RESULT
    _LATEST_RESULT = result


def get_latest_result() -> Optional[Any]:
    return _LATEST_RESULT


def update_job(job: Job, status: JobStatus, progress: int, msg: str, result=None, error=None):
    job.status = status
    job.progress = progress
    job.step_msg = msg
    if result is not None:
        job.result = result
    if error is not None:
        job.error = error
    if status in (JobStatus.COMPLETED, JobStatus.FAILED):
        job.completed_at = datetime.utcnow().isoformat()
    job.emit({"status": status, "progress": progress, "message": msg})
