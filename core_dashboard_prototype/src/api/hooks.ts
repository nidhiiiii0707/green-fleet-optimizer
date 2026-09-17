// React hooks for all API endpoints
import { useState, useEffect, useCallback, useRef } from "react";
import {
  optimizationApi, fleetApi, alertsApi, reportsApi, scenarioApi,
  connectOptimizationWS,
} from "./client";
import type {
  OptimizationResult, JobStatus, Alert, Report,
  Vessel, Port, Route, ScenarioControls, ScenarioResult, NLPResult,
} from "./types";

// ── Generic fetch hook ────────────────────────────────────────────────────────
function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refetch: load };
}

// ── Optimization hooks ────────────────────────────────────────────────────────
export function useLatestOptimization() {
  return useFetch<OptimizationResult>(() => optimizationApi.getLatest());
}

export function useOptimizationRun() {
  const [jobId,    setJobId]    = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [result,   setResult]   = useState<OptimizationResult | null>(null);
  const [running,  setRunning]  = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const triggerRun = useCallback(async (useReal = false) => {
    setRunning(true);
    setResult(null);
    try {
      const { job_id } = await optimizationApi.triggerRun(42, useReal);
      setJobId(job_id);

      // Poll status until complete
      const poll = setInterval(async () => {
        try {
          const status = await optimizationApi.getStatus(job_id);
          setJobStatus(status);
          if (status.status === "completed") {
            clearInterval(poll);
            const res = await optimizationApi.getResults(job_id);
            setResult(res);
            setRunning(false);
          } else if (status.status === "failed") {
            clearInterval(poll);
            setRunning(false);
          }
        } catch {}
      }, 1000);

      return job_id;
    } catch (e) {
      setRunning(false);
      throw e;
    }
  }, []);

  return { jobId, jobStatus, result, running, triggerRun };
}

// ── Fleet hooks ───────────────────────────────────────────────────────────────
export function useFleetData() {
  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [ports,   setPorts]   = useState<Port[]>([]);
  const [routes,  setRoutes]  = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fleetApi.getVessels(),
      fleetApi.getPorts(),
      fleetApi.getRoutes(),
    ]).then(([v, p, r]) => {
      setVessels(v.vessels);
      setPorts(p.ports);
      setRoutes(r.routes);
    }).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    }).finally(() => setLoading(false));
  }, []);

  return { vessels, ports, routes, loading, error };
}

// ── Alerts hooks ──────────────────────────────────────────────────────────────
export function useAlerts() {
  const [alerts,  setAlerts]  = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const { alerts: data } = await alertsApi.getAlerts();
      setAlerts(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const acknowledge = useCallback(async (id: string) => {
    try {
      await alertsApi.acknowledge(id);
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: "acknowledged" as const } : a));
    } catch {}
  }, []);

  return { alerts, loading, error, acknowledge, refetch: loadAlerts };
}

export function useAlertSummary() {
  return useFetch(() => alertsApi.getSummary());
}

// ── Reports hooks ─────────────────────────────────────────────────────────────
export function useReports() {
  const { data, loading, error } = useFetch(() => reportsApi.list());
  return { reports: data?.reports ?? [], loading, error };
}

// ── Scenario hook ─────────────────────────────────────────────────────────────
export function useScenario() {
  const [result,  setResult]  = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const run = useCallback(async (controls: ScenarioControls) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await scenarioApi.run(controls);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, run };
}

// ── NLP hook ─────────────────────────────────────────────────────────────────
export function useNLPQuery() {
  const [result,  setResult]  = useState<NLPResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const query = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await (await import("./client")).nlpApi.query(text);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, query };
}
