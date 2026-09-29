"""FastAPI main application — Green Fleet Optimizer Backend."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import backend.job_manager as JM
from backend.pipeline_bridge import get_default_result
from backend.comparison_service import register_precomputed_comparison_context
from backend.routers import fleet, optimization, nlp, scenario, alerts, reports, fuel_prediction

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed the latest result with pre-computed data
    log.info("Loading pre-computed optimization results...")
    result = get_default_result()
    JM.set_latest_result(result)
    try:
        register_precomputed_comparison_context(result)
    except Exception as exc:
        log.exception("Precomputed comparison context is unavailable")
        JM.set_comparison_error(result["run_id"], str(exc))
    log.info("Green Fleet Optimizer API ready.")
    yield
    log.info("Shutting down.")


app = FastAPI(
    title="Green Fleet Optimizer API",
    description=(
        "REST + WebSocket API for the Green Fleet Optimizer dashboard. "
        "Wraps the MO-QIGA multi-objective decision pipeline with independent benchmark algorithms."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS — allow the Vite dev server ─────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(fleet.router)
app.include_router(optimization.router)
app.include_router(nlp.router)
app.include_router(scenario.router)
app.include_router(alerts.router)
app.include_router(reports.router)
app.include_router(fuel_prediction.router)


# ── Root / health ─────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "service": "Green Fleet Optimizer API",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
