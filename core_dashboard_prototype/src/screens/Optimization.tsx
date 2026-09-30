import React, { useState, useMemo, useEffect } from "react";
import ParetoChart, { AXIS_PAIRS, AxisKey } from "../components/ParetoChart";
import type { ComparisonChartSeries } from "../components/ParetoChart";
import type { OptimizationResult, ParetoSolution, StructuredRequest, Objective } from "../api/types";
import { useOptimizationRun, useNLPQuery } from "../api/hooks";
import { cargoDemandDisplay, cargoFulfillmentPct } from "../lib/cargo";

interface Props {
  selectedId: string;
  result: OptimizationResult | null;
  loading: boolean;
  error: string | null;
  showingRequestResult: boolean;
  onSelect: (id: string) => void;
  onViewPlan: () => void;
  onRequestResult: (result: OptimizationResult) => void;
  onReturnToBaseline: () => void;
  onCompare: (runId: string) => void;
}

type FixedParam = "vessels" | "cargo" | "routes" | null;

// Design tokens
const T = {
  surface:   "var(--gf-card)",
  bg:        "var(--gf-canvas)",
  border:    "var(--gf-line)",
  borderMed: "var(--gf-line-medium)",
  text:      "var(--gf-ink)",
  textSec:   "var(--gf-muted)",
  textTer:   "var(--gf-faint)",
  teal:      "#0D9488",
  tealLight: "var(--gf-teal-soft)",
  amber:     "#D97706",
  amberL:    "var(--gf-amber-soft)",
  green:     "#10B981",
  greenL:    "var(--gf-green-soft)",
  red:       "#EF4444",
  redL:      "var(--gf-red-soft)",
};

function computeLiveFront(solutions: ParetoSolution[], xKey: AxisKey, yKey: AxisKey): ParetoSolution[] {
  const nd = solutions.filter(candidate =>
    !solutions.some(other =>
      other.id !== candidate.id &&
      (other[xKey] as number) <= (candidate[xKey] as number) &&
      (other[yKey] as number) <= (candidate[yKey] as number) &&
      ((other[xKey] as number) < (candidate[xKey] as number) ||
       (other[yKey] as number) < (candidate[yKey] as number))
    )
  );
  return nd.sort((a, b) => (a[xKey] as number) - (b[xKey] as number));
}

// ── Engineering slider components ─────────────────────────────────────────────
function EngrSlider({ label, min, max, step, value, onChange, format }: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const fmt = format ?? (v => String(v));
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "var(--gf-ink)", fontWeight: 600, fontFamily: "'Instrument Sans', sans-serif" }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#0D9488", fontWeight: 750, background: "var(--gf-teal-soft)", padding: "2px 7px", borderRadius: 4, border: "1px solid var(--gf-line)" }}>
          {fmt(value)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", accentColor: "#0D9488", height: 5 }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--gf-muted)", fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
        <span>{fmt(min)}</span><span>{fmt(max)}</span>
      </div>
    </div>
  );
}

function EngrRangeSlider({ label, min, max, step, value, onChange, format }: {
  label: string; min: number; max: number; step: number;
  value: [number, number]; onChange: (v: [number, number]) => void;
  format?: (v: number) => string;
}) {
  const fmt = format ?? (v => String(v));
  const [lo, hi] = value;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "var(--gf-ink)", fontWeight: 600, fontFamily: "'Instrument Sans', sans-serif" }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "var(--gf-ink)", background: "var(--gf-row-alt)", border: "1px solid var(--gf-line)", padding: "2px 7px", borderRadius: 4, fontWeight: 700 }}>
          {fmt(lo)} – {fmt(hi)}
        </span>
      </div>
      <div style={{ fontSize: 10, color: "var(--gf-muted)", marginBottom: 2, fontFamily: "'Instrument Sans', sans-serif" }}>Min</div>
      <input type="range" min={min} max={max} step={step} value={lo}
        onChange={e => { const v = +e.target.value; onChange([Math.min(v, hi - step), hi]); }}
        style={{ width: "100%", marginBottom: 6, accentColor: "#0D9488", height: 5 }} />
      <div style={{ fontSize: 10, color: "var(--gf-muted)", marginBottom: 2, fontFamily: "'Instrument Sans', sans-serif" }}>Max</div>
      <input type="range" min={min} max={max} step={step} value={hi}
        onChange={e => { const v = +e.target.value; onChange([lo, Math.max(v, lo + step)]); }}
        style={{ width: "100%", accentColor: "#0D9488", height: 5 }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--gf-muted)", fontFamily: "'JetBrains Mono', monospace", marginTop: 3 }}>
        <span>{fmt(min)}</span><span>{fmt(max)}</span>
      </div>
    </div>
  );
}

function NoVariation({ label, value, format = v => String(v) }: { label: string; value: number; format?: (v: number) => string }) {
  return (
    <div style={{ marginBottom: 14, padding: "8px 10px", border: "1px dashed var(--gf-line-medium)", borderRadius: 6, background: "var(--gf-row-alt)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 12, color: "var(--gf-ink)", fontWeight: 600, fontFamily: "'Instrument Sans', sans-serif" }}>{label}</span>
        <span style={{ fontSize: 11, color: "var(--gf-muted)", fontFamily: "'JetBrains Mono', monospace" }}>{format(value)}</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color: "var(--gf-faint)", fontFamily: "'Instrument Sans', sans-serif" }}>No variation available in this result</div>
    </div>
  );
}

// ── Solution analytical summary ───────────────────────────────────────────────
export function SolutionPanel({ sol, onViewPlan, onCompare, compareRunning, inFilter, requestedCargo }: { sol: ParetoSolution; onViewPlan: () => void; onCompare: () => void; compareRunning: boolean; inFilter: boolean; requestedCargo: number | null }) {
  const cargoDemand = cargoDemandDisplay(requestedCargo);
  const fulfillmentPct = cargoFulfillmentPct(sol.assignments ?? [], requestedCargo);
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${inFilter ? "rgba(45, 212, 191, 0.4)" : "var(--gf-line)"}`,
      borderRadius: 12,
      padding: "18px 20px",
      boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10.5, color: "var(--gf-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700, marginBottom: 4 }}>
            Selected Solution
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--gf-ink)", fontFamily: "'Instrument Sans', sans-serif" }}>
            {sol.label}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
          {sol.pareto && (
            <span style={{ fontSize: 10, fontWeight: 750, color: "#2DD4BF", background: "var(--gf-teal-soft)", padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(45, 212, 191, 0.3)", fontFamily: "'Instrument Sans', sans-serif", letterSpacing: "0.04em" }}>
              PARETO-OPTIMAL
            </span>
          )}
          {!inFilter && (
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#F59E0B", background: "var(--gf-amber-soft)", padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(245, 158, 11, 0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
              ⚠ OUTSIDE FILTER
            </span>
          )}
        </div>
      </div>

      {/* Objectives — primary analytical data */}
      <div style={{ borderTop: "1px solid var(--gf-line)", borderBottom: "1px solid var(--gf-line)", padding: "12px 0", marginBottom: 12 }}>
        {[
          { label: "Operating Cost",  val: `$${sol.cost}M`,                          color: "#10B981" },
          { label: "Lifecycle GHG",   val: `${(sol.ghg / 1000).toFixed(1)}k kgCO₂`, color: "var(--gf-ink)" },
          { label: "Fuel Consump.",   val: `${sol.fuel.toLocaleString()} t`, color: "#0EA5E9" },
          { label: "Cargo Demand",    val: fulfillmentPct != null ? `${cargoDemand.value} (${fulfillmentPct}% assigned)` : cargoDemand.value, color: "var(--gf-ink)" },
        ].map(m => (
          <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "var(--gf-muted)", fontFamily: "'Instrument Sans', sans-serif" }}>{m.label}</span>
            <span style={{ fontSize: 13.5, fontWeight: 750, color: m.color, fontFamily: "'JetBrains Mono', monospace" }}>{m.val}</span>
          </div>
        ))}
      </div>

      {/* Configuration */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Vessels", val: `${sol.vessels}` },
          { label: "Routes",  val: `${sol.routes}`  },
          { label: "Constraints", val: `${sol.constraintsSatisfied}/${sol.totalConstraints}` },
        ].map(m => (
          <div key={m.label} style={{ flex: 1, background: "var(--gf-row-alt)", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--gf-line)" }}>
            <div style={{ fontSize: 9.5, color: "var(--gf-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>{m.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "var(--gf-ink)", fontFamily: "'JetBrains Mono', monospace" }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Source algorithm + constraint satisfaction */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: "var(--gf-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>
            Source Algorithm
          </span>
          <span style={{ fontSize: 12, fontWeight: 750, color: "#0D9488", fontFamily: "'JetBrains Mono', monospace" }}>
            {sol.algorithm ?? "MO-QIGA"}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "var(--gf-faint)", marginTop: 4, fontFamily: "'Instrument Sans', sans-serif" }}>
          {sol.totalConstraints > 0
            ? `${sol.constraintsSatisfied}/${sol.totalConstraints} evaluated feasibility constraints satisfied`
            : "All evaluated feasibility constraints verified"}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onViewPlan}
          style={{
            flex: 1,
            background: "linear-gradient(135deg, #0284C7 0%, #0D9488 100%)",
            color: "white",
            border: "none",
            borderRadius: 7,
            padding: "10px 0",
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Instrument Sans', sans-serif",
            letterSpacing: "0.02em",
            boxShadow: "0 2px 10px rgba(2, 132, 199, 0.3)",
          }}
        >
          View Fleet Plan →
        </button>
        <button onClick={onCompare} disabled={compareRunning} style={{
          background: "var(--gf-card)",
          color: "var(--gf-ink)",
          border: "1px solid var(--gf-line-medium)",
          borderRadius: 7,
          padding: "10px 14px",
          fontSize: 12,
          fontWeight: 600,
          cursor: compareRunning ? "wait" : "pointer",
          opacity: compareRunning ? 0.65 : 1,
          fontFamily: "'Instrument Sans', sans-serif",
        }}>
          {compareRunning ? "Running algorithm comparison..." : "Compare"}
        </button>
      </div>
    </div>
  );
}

// ── Panel label ───────────────────────────────────────────────────────────────
function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11.5, fontWeight: 750, color: "var(--gf-ink)",
      textTransform: "uppercase", letterSpacing: "0.08em",
      marginBottom: 10, marginTop: 18,
      fontFamily: "'Instrument Sans', sans-serif",
    }}>
      {children}
    </div>
  );
}

function RadioOpt({ val, current, label, onChange, disabled }: {
  val: FixedParam; current: FixedParam; label: string;
  onChange: (v: FixedParam) => void;
  disabled?: boolean;
}) {
  const active = current === val;
  const handleClick = () => { if (!disabled) onChange(val); };
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: disabled ? "not-allowed" : "pointer", marginBottom: 7, opacity: disabled ? 0.45 : 1 }}>
      <div
        onClick={handleClick}
        style={{
          width: 15, height: 15, borderRadius: "50%", flexShrink: 0,
          border: `1.5px solid ${active ? "#0D9488" : "var(--gf-line-medium)"}`,
          background: active ? "#0D9488" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: active ? "0 0 6px rgba(13, 148, 136, 0.4)" : "none",
        }}
      >
        {active && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "white" }} />}
      </div>
      <span
        onClick={handleClick}
        style={{ fontSize: 12, color: active ? "var(--gf-ink)" : "var(--gf-muted)", fontWeight: active ? 650 : 450, fontFamily: "'Instrument Sans', sans-serif" }}
      >
        {label}
      </span>
    </label>
  );
}

// ── Structured request form (shared by Manual Input and the NLP review step) ──
const EMPTY_REQUEST: StructuredRequest = {
  origin: null, destination: null, vessel_type: null, fuel_type: null,
  speed: null, cargo: null, objectives: [],
};

const OBJECTIVE_LABELS: Record<Objective, string> = { ghg: "Minimize GHG", fuel: "Minimize Fuel", cost: "Minimize Cost" };

interface RequestFormProps {
  value: StructuredRequest;
  onChange: (value: StructuredRequest) => void;
  originFlag?: { valid?: boolean; suggestion?: string | null } | null;
  destinationFlag?: { valid?: boolean; suggestion?: string | null } | null;
  compact?: boolean;
}

function RequestField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontFamily: "'Instrument Sans', sans-serif" }}>{label}</div>
      {children}
    </div>
  );
}

const fieldInputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", fontSize: 12, border: `1px solid ${T.border}`,
  borderRadius: 4, fontFamily: "'Instrument Sans', sans-serif", color: T.text, background: T.surface, boxSizing: "border-box",
};

function RequestForm({ value, onChange, originFlag, destinationFlag, compact }: RequestFormProps) {
  function set<K extends keyof StructuredRequest>(key: K, v: StructuredRequest[K]) {
    onChange({ ...value, [key]: v });
  }
  function toggleObjective(o: Objective) {
    const has = value.objectives.includes(o);
    set("objectives", has ? value.objectives.filter(x => x !== o) : [...value.objectives, o]);
  }
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 12 }}>
        <RequestField label="Origin">
          <input style={fieldInputStyle} placeholder="Any" value={value.origin ?? ""}
            onChange={e => set("origin", e.target.value || null)} />
          {originFlag?.valid === false && (
            <div style={{ fontSize: 10, color: T.amber, marginTop: 3 }}>
              ⚠ Not a recognized port{originFlag.suggestion ? ` — did you mean "${originFlag.suggestion}"?` : ""}
            </div>
          )}
        </RequestField>
        <RequestField label="Destination">
          <input style={fieldInputStyle} placeholder="Any" value={value.destination ?? ""}
            onChange={e => set("destination", e.target.value || null)} />
          {destinationFlag?.valid === false && (
            <div style={{ fontSize: 10, color: T.amber, marginTop: 3 }}>
              ⚠ Not a recognized port{destinationFlag.suggestion ? ` — did you mean "${destinationFlag.suggestion}"?` : ""}
            </div>
          )}
        </RequestField>
        <RequestField label="Cargo (tonnes)">
          <input style={fieldInputStyle} type="number" min={0} placeholder="Unrestricted" value={value.cargo ?? ""}
            onChange={e => set("cargo", e.target.value === "" ? null : Number(e.target.value))} />
        </RequestField>
        <RequestField label="Speed (knots)">
          <input style={fieldInputStyle} type="number" min={0} placeholder="Unrestricted" value={value.speed ?? ""}
            onChange={e => set("speed", e.target.value === "" ? null : Number(e.target.value))} />
        </RequestField>
        <RequestField label="Vessel Type">
          <input style={fieldInputStyle} placeholder="Any" value={value.vessel_type ?? ""}
            onChange={e => set("vessel_type", e.target.value || null)} />
        </RequestField>
        <RequestField label="Fuel Type">
          <input style={fieldInputStyle} placeholder="Any" value={value.fuel_type ?? ""}
            onChange={e => set("fuel_type", e.target.value || null)} />
        </RequestField>
      </div>
      <RequestField label="Objectives">
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {(Object.keys(OBJECTIVE_LABELS) as Objective[]).map(o => (
            <label key={o} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.text, cursor: "pointer" }}>
              <input type="checkbox" checked={value.objectives.includes(o)} onChange={() => toggleObjective(o)} />
              {OBJECTIVE_LABELS[o]}
            </label>
          ))}
        </div>
        {value.objectives.length === 0 && (
          <div style={{ fontSize: 10, color: T.textTer, marginTop: 4 }}>No objective specified — the Pareto front across all objectives will be returned.</div>
        )}
      </RequestField>
    </div>
  );
}

function RequestSummary({ value }: { value: StructuredRequest }) {
  const rows = [
    ["Route", value.origin || value.destination ? `${value.origin ?? "Any"} → ${value.destination ?? "Any"}` : "Any"],
    ["Cargo", value.cargo == null ? "Unrestricted" : `${value.cargo.toLocaleString()} tonnes`],
    ["Speed", value.speed == null ? "Unrestricted" : `${value.speed} knots`],
    ["Vessel", value.vessel_type ?? "Any"],
    ["Fuel", value.fuel_type ?? "Any"],
    ["Objectives", value.objectives.length ? value.objectives.map(o => OBJECTIVE_LABELS[o]).join(", ") : "All Pareto objectives"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", columnGap: 10, rowGap: 7 }}>
      {rows.map(([label, display]) => (
        <React.Fragment key={label}>
          <span style={{ fontSize: 9.5, color: "var(--gf-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>{label}</span>
          <span style={{ fontSize: 11, color: "var(--gf-ink)", fontWeight: 550, fontFamily: "'JetBrains Mono', monospace" }}>{display}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function requestValidationError(value: StructuredRequest): string | null {
  if (value.cargo != null && (!Number.isFinite(value.cargo) || value.cargo <= 0)) {
    return "Cargo must be a positive number.";
  }
  if (value.speed != null && (!Number.isFinite(value.speed) || value.speed <= 0)) {
    return "Speed must be a positive number.";
  }
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Optimization({ selectedId, result: liveResult, loading: liveLoading, error: liveError, showingRequestResult, onSelect, onViewPlan, onRequestResult, onReturnToBaseline, onCompare }: Props) {
  const [fixedParam,  setFixedParam]  = useState<FixedParam>(null);
  const [vesselRangeOverride, setVesselRangeOverride] = useState<[number, number] | null>(null);
  const [vesselFixed, setVesselFixed] = useState<number | null>(null);
  const [cargoRangeOverride,  setCargoRangeOverride]  = useState<[number, number] | null>(null);
  const [cargoFixed,  setCargoFixed]  = useState<number | null>(null);
  const [routeRangeOverride,  setRouteRangeOverride]  = useState<[number, number] | null>(null);
  const [routeFixed,  setRouteFixed]  = useState<number | null>(null);
  const [axisIdx,     setAxisIdx]     = useState(0);
  const [compareIds,  setCompareIds]  = useState<string[] | null>(null);

  const [requestMode, setRequestMode] = useState<"manual" | "nlp">("nlp");
  const [nlqText,      setNlqText]      = useState("");
  const [pendingRequest, setPendingRequest] = useState<StructuredRequest>(EMPTY_REQUEST);
  const [requestReviewReady, setRequestReviewReady] = useState(false);

  const { result: completedRequestResult, running: optRunning, jobStatus, triggerRun } = useOptimizationRun();
  const { result: nlpResult, loading: nlpLoading, error: nlpError, query: runNLQ, reset: resetNLQ } = useNLPQuery();

  const requestErr = requestValidationError(pendingRequest);
  const hasAnyConstraint = Object.entries(pendingRequest).some(([key, v]) =>
    key === "objectives" ? (v as Objective[]).length > 0 : v != null);

  function handleGenerateRequest() {
    setRequestReviewReady(false);
    runNLQ(nlqText);
  }

  function handleOptimize() {
    if (requestErr) return;
    triggerRun(true, pendingRequest);
  }

  function handleEditInManualForm() {
    setRequestMode("manual");
  }

  // When a new NLP parse result arrives, load it into the shared editable
  // request and show the review step (never auto-optimizes).
  useEffect(() => {
    if (nlpResult) {
      setPendingRequest(nlpResult.request);
      setRequestReviewReady(true);
    }
  }, [nlpResult]);

  useEffect(() => {
    if (completedRequestResult) onRequestResult(completedRequestResult);
  }, [completedRequestResult, onRequestResult]);

  // Live Pareto solutions from the real optimization result. Empty when no result yet.
  const allSolutions: ParetoSolution[] = liveResult?.pareto_solutions ?? [];

  const vesselBounds = useMemo(() => {
    const vals = allSolutions.map(s => s.vessels);
    return vals.length ? [Math.min(...vals), Math.max(...vals)] as [number, number] : [0, 0] as [number, number];
  }, [allSolutions]);
  const routeBounds = useMemo(() => {
    const vals = allSolutions.map(s => s.routes);
    return vals.length ? [Math.min(...vals), Math.max(...vals)] as [number, number] : [0, 0] as [number, number];
  }, [allSolutions]);
  const cargoAvailable = allSolutions.some(s => s.cargoFulfillment != null);

  // Cargo fulfillment isn't computed by the optimizer for this run — never
  // leave a fake "fixed cargo" filter selected once that becomes known.
  useEffect(() => {
    if (fixedParam === "cargo" && !cargoAvailable) setFixedParam(null);
  }, [fixedParam, cargoAvailable]);

  const cargoBounds = useMemo(() => {
    const vals = allSolutions.map(s => s.cargoFulfillment).filter((v): v is number => v != null);
    return vals.length ? [Math.min(...vals), Math.max(...vals)] as [number, number] : [0, 100] as [number, number];
  }, [allSolutions]);

  const vesselRange = vesselRangeOverride ?? vesselBounds;
  const cargoRange   = cargoRangeOverride ?? cargoBounds;
  const routeRange   = routeRangeOverride ?? routeBounds;
  const vesselFixedVal = vesselFixed ?? vesselBounds[0];
  const cargoFixedVal  = cargoFixed ?? cargoBounds[0];
  const routeFixedVal  = routeFixed ?? routeBounds[0];
  const effectiveCompareIds = compareIds ?? allSolutions.slice(0, 3).map(s => s.id);

  const runMeta = {
    method: Array.from(new Set(allSolutions.map(solution => solution.algorithm).filter((algorithm): algorithm is string => Boolean(algorithm)))).join(" / ") || "unavailable",
    feasible: liveResult?.feasible_solutions ?? 0,
    pareto: liveResult?.pareto_count ?? 0,
    runtime: liveResult?.runtime_seconds != null
      ? `${Math.floor(liveResult.runtime_seconds / 60)}m ${Math.round(liveResult.runtime_seconds % 60)}s`
      : "unavailable",
    satisfaction: liveResult?.constraint_satisfaction ?? "unavailable",
  };

  const selected = allSolutions.find(s => s.id === selectedId) ?? allSolutions[0];

  const filteredSolutions = useMemo(() => {
    return allSolutions.filter(s => {
      const ok1 = fixedParam === "vessels" ? s.vessels === vesselFixedVal : s.vessels >= vesselRange[0] && s.vessels <= vesselRange[1];
      const ok2 = !cargoAvailable || s.cargoFulfillment == null ? true
        : fixedParam === "cargo" ? Math.abs(s.cargoFulfillment - cargoFixedVal) <= 0.6
        : s.cargoFulfillment >= cargoRange[0] && s.cargoFulfillment <= cargoRange[1];
      const ok3 = fixedParam === "routes"  ? s.routes === routeFixedVal : s.routes >= routeRange[0] && s.routes <= routeRange[1];
      return ok1 && ok2 && ok3;
    });
  }, [allSolutions, fixedParam, vesselRange, vesselFixedVal, cargoRange, cargoFixedVal, routeRange, routeFixedVal, cargoAvailable]);

  const filteredIds = useMemo(() => new Set(filteredSolutions.map(s => s.id)), [filteredSolutions]);

  const liveFront = useMemo(() => {
    const { x, y } = AXIS_PAIRS[axisIdx];
    return computeLiveFront(filteredSolutions, x, y);
  }, [filteredSolutions, axisIdx]);

  const filteredPareto    = filteredSolutions.filter(s => s.pareto);
  const filteredDominated = filteredSolutions.filter(s => !s.pareto);

  const isSelectedInFilter = selected ? filteredIds.has(selected.id) : false;

  type MetricKey = "fuel" | "cost" | "ghg" | "cargoFulfillment" | "vessels" | "routes";
  const compareMetrics: { key: MetricKey; label: string; fmt: (v: number | null) => string }[] = [
    { key: "fuel",             label: "Fuel Consumption", fmt: v => v == null ? "Unavailable" : `${v.toLocaleString()} t` },
    { key: "cost",             label: "Operating Cost",   fmt: v => v == null ? "Unavailable" : `$${v}M` },
    { key: "ghg",              label: "Lifecycle GHG",    fmt: v => v == null ? "Unavailable" : `${v.toLocaleString()} kgCO₂` },
    { key: "cargoFulfillment", label: "Cargo Fulfil.",    fmt: v => v == null ? "Unavailable" : `${v}%` },
    { key: "vessels",          label: "Vessels",          fmt: v => v == null ? "Unavailable" : `${v}` },
    { key: "routes",           label: "Routes",           fmt: v => v == null ? "Unavailable" : `${v}` },
  ];
  const compareSols = effectiveCompareIds.map(id => allSolutions.find(s => s.id === id)).filter(Boolean) as ParetoSolution[];

  const comparisonSeries: ComparisonChartSeries[] = [];
  function bestFor(key: MetricKey) {
    const arr = compareSols.map(s => ({ id: s.id, v: s[key] as number | null })).filter(a => a.v != null) as { id: string; v: number }[];
    if (!arr.length) return undefined;
    return arr.reduce((a, b) => b.v < a.v ? b : a, arr[0])?.id;
  }

  return (
    <div style={{ overflowY: "auto", height: "100%" }}>

      {liveLoading && (
        <div style={{ padding: "8px 24px", fontSize: 11, color: T.textTer }}>Loading real optimization result…</div>
      )}
      {liveError && (
        <div style={{ padding: "8px 24px", fontSize: 11, color: T.red }}>Backend data unavailable: {liveError}</div>
      )}
      {showingRequestResult && liveResult && (
        <div style={{ margin: "10px 24px 0", padding: "8px 12px", background: T.tealLight, border: `1px solid ${T.teal}35`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 11, color: T.teal }}>
            Showing request-specific result {liveResult.run_id}. The normal four-solution baseline is preserved.
          </span>
          <button onClick={onReturnToBaseline} style={{ background: T.surface, color: T.teal, border: `1px solid ${T.teal}`, padding: "6px 10px", fontSize: 10.5, fontWeight: 600, cursor: "pointer" }}>
            Return to Baseline
          </button>
        </div>
      )}

      {/* Request builder: Manual Input vs AI / Natural Language */}
      <div style={{ padding: 0 }}>
        <div style={{
          background: "var(--gf-card)",
          borderBottom: "1px solid var(--gf-line)",
          padding: "10px 20px 12px",
          color: "var(--gf-ink)",
        }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--gf-line)", gap: 4 }}>
            {([["manual", "Manual Input"], ["nlp", "AI / Natural Language"]] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setRequestMode(m)}
                style={{
                  padding: "7px 18px", fontSize: 11, fontWeight: 650, border: "1px solid", cursor: "pointer",
                  background: requestMode === m ? "var(--gf-canvas)" : "transparent",
                  color: requestMode === m ? "var(--gf-ink)" : "var(--gf-muted)",
                  borderColor: requestMode === m ? "var(--gf-line)" : "transparent",
                  borderBottom: requestMode === m ? "1px solid var(--gf-canvas)" : "1px solid transparent",
                  marginBottom: -1,
                  borderRadius: "6px 6px 0 0",
                  fontFamily: "'Instrument Sans', sans-serif",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ padding: "12px 0 6px", display: "grid", gridTemplateColumns: requestMode === "nlp" && !requestReviewReady ? "1fr" : "minmax(360px, 55%) 1fr", gap: 20 }}>
            {/* Left: input method */}
            <div>
              {requestMode === "manual" ? (
                <RequestForm value={pendingRequest} onChange={setPendingRequest} />
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                    <textarea
                      placeholder='e.g. "Find a low-emission route from Yokohama to Singapore carrying 5000 tonnes at 18 knots"'
                      value={nlqText}
                      onChange={e => setNlqText(e.target.value)}
                      rows={1}
                      aria-label="Natural language optimization request"
                      style={{
                        flex: 1, minHeight: 38, padding: "8px 12px", fontSize: 11,
                        border: "1px solid var(--gf-line)", borderRadius: 6,
                        fontFamily: "'Instrument Sans', sans-serif",
                        color: "var(--gf-ink)", background: "var(--gf-canvas)",
                        boxSizing: "border-box", resize: "none", outline: "none",
                      }}
                    />
                    <button
                      onClick={handleGenerateRequest}
                      disabled={nlpLoading}
                      style={{
                        background: nlpLoading ? "var(--gf-line-medium)" : "linear-gradient(135deg, #0284C7 0%, #0D9488 100%)",
                        color: "white", border: "none", borderRadius: 6,
                        padding: "0 18px", fontSize: 11, fontWeight: 700,
                        cursor: nlpLoading ? "not-allowed" : "pointer",
                        fontFamily: "'Instrument Sans', sans-serif", whiteSpace: "nowrap",
                        boxShadow: "0 2px 8px rgba(13, 148, 136, 0.25)",
                      }}
                    >
                      {nlpLoading ? "Parsing..." : requestReviewReady ? "Regenerate Request" : "Generate Request"}
                    </button>
                  </div>
                  {nlpError && (
                    <div style={{ fontSize: 11, color: T.red, marginTop: 8 }}>⚠ {nlpError}</div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {requestReviewReady && (
                      <button
                        onClick={() => { setRequestReviewReady(false); resetNLQ(); setNlqText(""); setPendingRequest(EMPTY_REQUEST); }}
                        style={{
                          background: "var(--gf-canvas)", color: "var(--gf-muted)",
                          border: "1px solid var(--gf-line)", padding: "5px 12px",
                          borderRadius: 6, fontSize: 10, cursor: "pointer",
                          fontFamily: "'Instrument Sans', sans-serif",
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {requestReviewReady && (
                    <div style={{ fontSize: 10, color: "var(--gf-muted)", marginTop: 6, fontFamily: "'Instrument Sans', sans-serif" }}>
                      {nlpResult?.gemini_used
                        ? "Normalized with Gemini, then parsed deterministically."
                        : "Parsed deterministically (Gemini normalization unavailable)."}{" "}
                      Review the detected request on the right, edit if needed, then Optimize.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right: current / detected request + action */}
            <div style={{ display: requestMode === "nlp" && !requestReviewReady ? "none" : "block", borderLeft: "1px solid var(--gf-line)", paddingLeft: 20 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--gf-ink)", marginBottom: 8, fontFamily: "'Instrument Sans', sans-serif" }}>
                {requestMode === "nlp" && requestReviewReady ? "Detected Request" : "Current Request"}
              </div>
              {requestMode === "nlp" && !requestReviewReady ? (
                <div style={{ fontSize: 10.5, color: "var(--gf-muted)", lineHeight: 1.5 }}>
                  Generate a request from your description to review its detected fields here before optimizing.
                </div>
              ) : <RequestSummary value={pendingRequest} />}

              {requestMode === "nlp" && requestReviewReady && nlpResult && (
                <div style={{ marginTop: 8, fontSize: 10, color: T.amber }}>
                  {nlpResult.parsed.origin_valid === false && <div>⚠ Origin is not recognized{nlpResult.parsed.origin_suggestion ? ` — did you mean "${nlpResult.parsed.origin_suggestion}"?` : "."}</div>}
                  {nlpResult.parsed.destination_valid === false && <div>⚠ Destination is not recognized{nlpResult.parsed.destination_suggestion ? ` — did you mean "${nlpResult.parsed.destination_suggestion}"?` : "."}</div>}
                </div>
              )}

              {requestErr && (
                <div style={{ fontSize: 11, color: T.red, marginBottom: 8, marginTop: 8 }}>⚠ {requestErr}</div>
              )}
              {!hasAnyConstraint && (requestMode === "manual" || requestReviewReady) && (
                <div style={{ fontSize: 10, color: "var(--gf-faint)", marginBottom: 8, marginTop: 8 }}>
                  No fields set — optimizing across all available routes/vessels/fuels.
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {requestMode === "nlp" && requestReviewReady && (
                  <button
                    onClick={handleEditInManualForm}
                    style={{
                      background: "var(--gf-canvas)", color: "var(--gf-ink)",
                      border: "1px solid var(--gf-line)", borderRadius: 6,
                      padding: "7px 13px", fontSize: 10, fontWeight: 600,
                      cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif",
                    }}
                  >
                    Edit in Manual Form
                  </button>
                )}
                <button
                  onClick={handleOptimize}
                  disabled={optRunning || !!requestErr || (requestMode === "nlp" && !requestReviewReady)}
                  style={{
                    background: optRunning ? "var(--gf-line-medium)" : "linear-gradient(135deg, #0284C7 0%, #0D9488 100%)",
                    color: "white", border: "none", borderRadius: 6,
                    padding: "7px 18px", fontSize: 10.5, fontWeight: 700,
                    cursor: optRunning || requestErr ? "not-allowed" : "pointer",
                    fontFamily: "'Instrument Sans', sans-serif",
                    boxShadow: "0 2px 8px rgba(13, 148, 136, 0.25)",
                  }}
                >
                  {optRunning ? `Optimizing... ${jobStatus?.progress ?? 0}%` : "Optimize"}
                </button>
              </div>

              {optRunning && jobStatus && (
                <div style={{ background: T.tealLight, border: `1px solid ${T.teal}30`, borderRadius: 6, padding: "6px 14px", display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <div style={{ flex: 1, height: 4, background: T.border, borderRadius: 2 }}>
                    <div style={{ width: `${jobStatus.progress}%`, height: "100%", background: T.teal, borderRadius: 2, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontSize: 10, color: T.teal, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>{jobStatus.message}</span>
                </div>
              )}
              {!optRunning && jobStatus?.status === "failed" && (
                <div style={{ background: T.redL, border: `1px solid ${T.red}40`, borderRadius: 6, padding: "8px 14px", fontSize: 11, color: T.red, marginTop: 10 }}>
                  ⚠ Optimization failed: {jobStatus.error ?? jobStatus.message}
                </div>
              )}
              {!optRunning && jobStatus?.status === "completed" && liveResult?.request_warnings && liveResult.request_warnings.length > 0 && (
                <div style={{ background: T.amberL, border: `1px solid ${T.amber}`, borderRadius: 6, padding: "8px 14px", fontSize: 11, color: T.amber, marginTop: 10 }}>
                  {liveResult.request_warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--gf-muted)", marginTop: 8, minHeight: 20 }}>
            <strong style={{ color: "var(--gf-ink)", fontWeight: 700 }}>Precomputed tags:</strong>
            <span style={{ background: "var(--gf-teal-soft)", border: "1px solid var(--gf-line)", padding: "3px 9px", borderRadius: 6, color: "var(--gf-ink)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5 }}>{liveResult?.source ?? "live optimizer result"}</span>
            <span style={{ background: "var(--gf-teal-soft)", border: "1px solid var(--gf-line)", padding: "3px 9px", borderRadius: 6, color: "#0D9488", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 700 }}>{runMeta.method}</span>
          </div>
          <div style={{ color: "var(--gf-ink)", fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", marginTop: 10 }}>OPTIMIZATION ANALYTICS</div>
        </div>
      </div>

      {/* Run summary strip */}
      <div style={{ padding: "16px 24px 0" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 12,
        }}>
          {[
            { label: "Algorithms in Result", val: runMeta.method,      sub: "derived from returned solutions",      accent: "#2DD4BF"  },
            { label: "Data Mode",           val: liveResult?.data_mode ?? "unavailable", sub: liveResult?.source ?? "no result loaded", accent: "#0EA5E9" },
            { label: "Feasible Solutions",  val: String(runMeta.feasible), sub: "total evaluated",             accent: "var(--gf-ink)"  },
            { label: "Pareto-Optimal",      val: String(runMeta.pareto),   sub: "non-dominated plans",         accent: "#2DD4BF"  },
            { label: "Runtime",             val: runMeta.runtime,     sub: "wall-clock time",                  accent: "var(--gf-ink)"  },
            { label: "Constraint Satisf.",  val: runMeta.satisfaction, sub: "all plans feasible",              accent: "#10B981" },
          ].map((c) => (
            <div key={c.label} style={{
              background: "var(--gf-card)",
              border: "1px solid var(--gf-line)",
              borderRadius: 10,
              padding: "14px 18px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}>
              <div style={{ fontSize: 10.5, color: "var(--gf-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, fontFamily: "'Instrument Sans', sans-serif", fontWeight: 700 }}>{c.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: c.accent, fontFamily: "'JetBrains Mono', monospace" }}>{c.val}</div>
              <div style={{ fontSize: 11, color: "var(--gf-faint)", marginTop: 4 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", alignItems: "start", gap: 16, padding: "16px 24px 28px" }}>

        {/* ── Left controls panel ── */}
        <div style={{
          background: "var(--gf-card)",
          border: "1px solid var(--gf-line)",
          borderRadius: 12,
          padding: "18px 18px 24px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
        }}>

          {/* Fixed parameter */}
          <PanelLabel>Fixed Parameter</PanelLabel>
          <div style={{ fontSize: 11, color: "var(--gf-muted)", marginBottom: 10, lineHeight: 1.4, fontFamily: "'Instrument Sans', sans-serif" }}>
            Pin one constraint; the rest use sliding ranges.
          </div>
          <RadioOpt val={null}      current={fixedParam} label="No fixed parameter"    onChange={setFixedParam} />
          <RadioOpt val="vessels"   current={fixedParam} label="Fix vessel count"       onChange={setFixedParam} />
          <RadioOpt val="cargo"     current={fixedParam} label="Fix cargo fulfillment"  onChange={setFixedParam} disabled={!cargoAvailable} />
          <RadioOpt val="routes"    current={fixedParam} label="Fix route count"        onChange={setFixedParam} />

          {/* Constraint window */}
          <PanelLabel>Constraint Window</PanelLabel>
          {vesselBounds[0] === vesselBounds[1] ? (
            <NoVariation label="Vessels" value={vesselBounds[0]} format={v => `${v}`} />
          ) : fixedParam === "vessels" ? (
            <EngrSlider label="Vessels (fixed)" min={vesselBounds[0]} max={vesselBounds[1]} step={1}
              value={vesselFixedVal} onChange={setVesselFixed} format={v => `${v} vessels`} />
          ) : (
            <EngrRangeSlider label="Vessels" min={vesselBounds[0]} max={vesselBounds[1]} step={1}
              value={vesselRange} onChange={setVesselRangeOverride} format={v => `${v}`} />
          )}
          {!cargoAvailable ? (
            <div style={{ fontSize: 10.5, color: "var(--gf-muted)", marginBottom: 10, fontFamily: "'Instrument Sans', sans-serif" }}>
              Cargo fulfillment is not computed by the optimizer for this run.
            </div>
          ) : fixedParam === "cargo" ? (
            <EngrSlider label="Cargo Fulfillment (fixed)" min={cargoBounds[0]} max={cargoBounds[1]} step={0.5}
              value={cargoFixedVal} onChange={setCargoFixed} format={v => `${v}%`} />
          ) : (
            <EngrRangeSlider label="Cargo Fulfillment" min={cargoBounds[0]} max={cargoBounds[1]} step={0.5}
              value={cargoRange} onChange={setCargoRangeOverride} format={v => `${v}%`} />
          )}
          {routeBounds[0] === routeBounds[1] ? (
            <NoVariation label="Routes" value={routeBounds[0]} format={v => `${v}`} />
          ) : fixedParam === "routes" ? (
            <EngrSlider label="Routes (fixed)" min={routeBounds[0]} max={routeBounds[1]} step={1}
              value={routeFixedVal} onChange={setRouteFixed} format={v => `${v} routes`} />
          ) : (
            <EngrRangeSlider label="Routes" min={routeBounds[0]} max={routeBounds[1]} step={1}
              value={routeRange} onChange={setRouteRangeOverride} format={v => `${v}`} />
          )}

          {/* Filter stats */}
          <PanelLabel>Filter Statistics</PanelLabel>
          <div style={{ border: "1px solid var(--gf-line)", borderRadius: 8, padding: "10px 12px", background: "var(--gf-row-alt)" }}>
            {[
              { label: "Visible solutions", val: `${filteredSolutions.length} / ${allSolutions.length}`, c: "var(--gf-ink)" },
              { label: "Pareto-optimal",    val: `${filteredPareto.length} / ${allSolutions.filter(s => s.pareto).length}`, c: "#2DD4BF" },
              { label: "Dominated",         val: `${filteredDominated.length} / ${allSolutions.filter(s => !s.pareto).length}`, c: "var(--gf-muted)" },
              { label: "Live front pts",    val: `${liveFront.length}`,                                        c: "#F59E0B" },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "var(--gf-muted)", fontFamily: "'Instrument Sans', sans-serif" }}>{r.label}</span>
                <span style={{ fontSize: 11.5, fontWeight: 750, color: r.c, fontFamily: "'JetBrains Mono', monospace" }}>{r.val}</span>
              </div>
            ))}
          </div>

          {filteredSolutions.length === 0 && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 6, fontSize: 11, color: "#EF4444", fontFamily: "'Instrument Sans', sans-serif" }}>
              ⚠ No solutions match. Expand the ranges.
            </div>
          )}
          {fixedParam && (
            <button
              onClick={() => setFixedParam(null)}
              style={{ marginTop: 12, width: "100%", padding: "7px 0", fontSize: 11, color: "var(--gf-ink)", background: "var(--gf-row-alt)", border: "1px solid var(--gf-line-medium)", borderRadius: 6, cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}
            >
              Clear fixed parameter
            </button>
          )}
        </div>

        {/* ── Right: chart + solution + compare ── */}
        <div>

          {/* Chart + solution panel */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, marginBottom: 16 }}>

            {/* Pareto chart panel */}
            <div style={{ background: "var(--gf-card)", border: "1px solid var(--gf-line)", borderRadius: 12, padding: "18px 20px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gf-ink)", fontFamily: "'Instrument Sans', sans-serif" }}>
                  Pareto Front — Solution Space
                </div>
                <div style={{ fontSize: 11.5, color: "var(--gf-muted)", marginTop: 3, fontFamily: "'Instrument Sans', sans-serif" }}>
                  {runMeta.feasible} feasible solutions evaluated · click a Pareto-optimal point to select
                </div>
              </div>
              <div style={{ height: 360 }}>
                <ParetoChart
                  solutions={allSolutions}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  filteredIds={filteredIds}
                  liveFront={liveFront}
                  axisIdx={axisIdx}
                  onAxisChange={setAxisIdx}
                  comparisonSeries={comparisonSeries}
                />
              </div>
            </div>

            {/* Selected solution analytical panel */}
            {selected ? (
              <SolutionPanel sol={selected} onViewPlan={onViewPlan} onCompare={() => onCompare(liveResult?.run_id ?? "")} compareRunning={false} inFilter={isSelectedInFilter} requestedCargo={liveResult?.structured_request?.cargo ?? null} />
            ) : (
              <div style={{ background: "var(--gf-card)", border: "1px solid var(--gf-line)", borderRadius: 12, padding: "18px 20px", fontSize: 12, color: "var(--gf-muted)" }}>
                No optimization result loaded yet.
              </div>
            )}
          </div>


          {/* Compare solutions table */}
          <div style={{ background: "var(--gf-card)", border: "1px solid var(--gf-line)", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--gf-line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--gf-ink)", fontFamily: "'Instrument Sans', sans-serif" }}>
                  Solution Comparison
                </div>
                <div style={{ fontSize: 11.5, color: "var(--gf-muted)", marginTop: 2 }}>Side-by-side trade-off analysis across Pareto-optimal plans</div>
              </div>
              <div style={{ display: "flex", gap: 0, border: `1px solid ${T.border}`, flexWrap: "wrap" }}>
                {allSolutions.map((s) => {
                  const isOn = effectiveCompareIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setCompareIds(isOn
                        ? effectiveCompareIds.filter(id => id !== s.id)
                        : [...effectiveCompareIds, s.id])}
                      style={{
                        background: isOn ? T.teal : T.bg,
                        color:      isOn ? "white" : T.textSec,
                        border: "none",
                        borderLeft: `1px solid ${T.border}`,
                        padding: "5px 10px", fontSize: 10, cursor: "pointer",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {s.id}
                    </button>
                  );
                })}
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: T.bg }}>
                  <th style={{ textAlign: "left", padding: "8px 14px", fontSize: 9, fontWeight: 600, color: T.textTer, borderBottom: `1px solid ${T.border}`, width: "26%", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Instrument Sans', sans-serif" }}>Metric</th>
                  {compareSols.map(s => (
                    <th key={s.id} style={{ textAlign: "center", padding: "8px 14px", fontSize: 11, fontWeight: 700, color: s.id === selectedId ? T.teal : T.text, borderBottom: `1px solid ${T.border}`, fontFamily: "'Instrument Sans', sans-serif" }}>
                      {s.label}
                      {s.id === selectedId && <div style={{ fontSize: 8, color: T.teal, fontWeight: 600, marginTop: 1 }}>● SELECTED</div>}
                      {s.algorithm && <div style={{ fontSize: 8, color: T.textTer, fontWeight: 400, marginTop: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                        {s.algorithm}
                      </div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareMetrics.map((m, rowIdx) => {
                  const best = bestFor(m.key);
                  return (
                    <tr key={m.key} style={{ background: rowIdx % 2 === 0 ? T.surface : T.bg }}>
                      <td style={{ padding: "8px 14px", fontSize: 10, color: T.textSec, borderBottom: `1px solid ${T.border}`, fontFamily: "'Instrument Sans', sans-serif" }}>{m.label}</td>
                      {compareSols.map(s => {
                        const isBest = s.id === best;
                        return (
                          <td key={s.id} style={{
                            padding: "8px 14px", textAlign: "center",
                            fontSize: 11, fontWeight: isBest ? 700 : 500,
                            fontFamily: "'JetBrains Mono', monospace",
                            borderBottom: `1px solid ${T.border}`,
                            color: isBest ? T.teal : T.text,
                            background: isBest ? T.tealLight : "inherit",
                          }}>
                            {isBest && <span style={{ marginRight: 3, fontSize: 9 }}>★</span>}
                            {m.fmt(s[m.key] as number | null)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Trade-off narrative */}
            <div style={{ padding: "10px 16px", background: T.bg, borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4, fontFamily: "'Instrument Sans', sans-serif" }}>
                Trade-off Summary
              </div>
              <div style={{ fontSize: 10, color: T.textSec, lineHeight: 1.6, fontFamily: "'Instrument Sans', sans-serif" }}>
                {compareSols.length >= 2 && (() => {
                  const lowestGhg  = compareSols.reduce((a, b) => b.ghg < a.ghg ? b : a);
                  const lowestCost = compareSols.reduce((a, b) => b.cost < a.cost ? b : a);
                  return (
                    <>
                      <strong style={{ color: T.text }}>{lowestGhg.label}</strong> has the lowest lifecycle GHG among these ({lowestGhg.ghg.toLocaleString()} kgCO₂) at ${lowestGhg.cost}M operating cost.{" "}
                      <strong style={{ color: T.text }}>{lowestCost.label}</strong> has the lowest operating cost (${lowestCost.cost}M) at {lowestCost.ghg.toLocaleString()} kgCO₂.{" "}
                      Selection depends on the operator{"'"}s ESG and financial priorities.
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
