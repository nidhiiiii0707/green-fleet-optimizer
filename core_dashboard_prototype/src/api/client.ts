// Typed API client for Green Fleet Optimizer backend
import { API_BASE, WS_BASE } from "./config";
import type {
  OptimizationResult, JobStatus, ScenarioControls, ScenarioResult,
  NLPResult, Alert, Report, Vessel, Port, Route,
} from "./types";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Fleet ─────────────────────────────────────────────────────────────────────
export const fleetApi = {
  getVessels: () => apiFetch<{ vessels: Vessel[] }>("/api/fleet/vessels"),
  getPorts:   () => apiFetch<{ ports: Port[] }>("/api/fleet/ports"),
  getRoutes:  () => apiFetch<{ routes: Route[] }>("/api/fleet/routes"),
  getSummary: () => apiFetch<Record<string, number>>("/api/fleet/summary"),
};

// ── Optimization ─────────────────────────────────────────────────────────────
export const optimizationApi = {
  getLatest: () =>
    apiFetch<OptimizationResult>("/api/optimization/latest"),

  triggerRun: (seed = 42, useRealPipeline = false) =>
    apiFetch<{ job_id: string; status: string }>("/api/optimization/run", {
      method: "POST",
      body: JSON.stringify({ seed, use_real_pipeline: useRealPipeline }),
    }),

  getStatus: (jobId: string) =>
    apiFetch<JobStatus>(`/api/optimization/status/${jobId}`),

  getResults: (jobId: string) =>
    apiFetch<OptimizationResult>(`/api/optimization/results/${jobId}`),

  getSolution: (solutionId: string) =>
    apiFetch<Record<string, unknown>>(`/api/optimization/solution/${solutionId}`),
};

// ── NLP ───────────────────────────────────────────────────────────────────────
export const nlpApi = {
  query: (text: string) =>
    apiFetch<NLPResult>("/api/nlp/query", {
      method: "POST",
      body: JSON.stringify({ query: text }),
    }),
};

// ── Scenario ──────────────────────────────────────────────────────────────────
export const scenarioApi = {
  run: (controls: ScenarioControls) =>
    apiFetch<ScenarioResult>("/api/scenario/run", {
      method: "POST",
      body: JSON.stringify(controls),
    }),
};

// ── Alerts ───────────────────────────────────────────────────────────────────
export const alertsApi = {
  getAlerts: () => apiFetch<{ alerts: Alert[] }>("/api/alerts"),
  getSummary: () => apiFetch<{ high: number; medium: number; info: number; total_active: number }>("/api/alerts/summary"),
  acknowledge: (id: string) =>
    apiFetch<{ success: boolean; alert: Alert }>(`/api/alerts/${id}/acknowledge`, { method: "PATCH" }),
};

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  list: () => apiFetch<{ reports: Report[] }>("/api/reports"),

  exportReport: async (reportId: string, format: "csv" | "json") => {
    const res = await fetch(`${API_BASE}/api/reports/${reportId}/export?format=${format}`);
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cd = res.headers.get("content-disposition") ?? "";
    const match = cd.match(/filename=(.+)/);
    a.download = match ? match[1] : `report_${reportId}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportParetoSolutions: async () => {
    const res = await fetch(`${API_BASE}/api/reports/export/pareto-solutions`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "greenfleet_pareto_solutions.csv";
    a.click();
    URL.revokeObjectURL(url);
  },

  exportFleetAssignments: async () => {
    const res = await fetch(`${API_BASE}/api/reports/export/fleet-assignments`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "greenfleet_fleet_assignments.csv";
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ── WebSocket helper ──────────────────────────────────────────────────────────
export function connectOptimizationWS(
  jobId: string,
  onEvent: (e: { status: string; progress: number; message: string }) => void,
  onClose?: () => void,
): WebSocket {
  const ws = new WebSocket(`${WS_BASE}/api/optimization/ws/${jobId}`);
  ws.onmessage = (ev) => {
    try {
      onEvent(JSON.parse(ev.data));
    } catch {}
  };
  ws.onclose = () => onClose?.();
  return ws;
}
