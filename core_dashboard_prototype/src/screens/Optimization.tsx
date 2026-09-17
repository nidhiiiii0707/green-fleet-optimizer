import React, { useState, useMemo, useEffect } from "react";
import ParetoChart, { AXIS_PAIRS, AxisKey } from "../components/ParetoChart";
import type { ParetoSolution, StructuredRequest, Objective } from "../api/types";
import { useLatestOptimization, useOptimizationRun, useNLPQuery } from "../api/hooks";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  onViewPlan: () => void;
}

type FixedParam = "vessels" | "cargo" | "routes" | null;

// Design tokens
const T = {
  surface:   "#FFFFFF",
  bg:        "#F4F3EF",
  border:    "#E4E2DE",
  borderMed: "#CCC9C4",
  text:      "#1A1918",
  textSec:   "#6A6763",
  textTer:   "#9A9793",
  teal:      "#0A6C70",
  tealLight: "#F0F9FA",
  amber:     "#B45309",
  amberL:    "#FFFBEB",
  green:     "#15803D",
  greenL:    "#F0FDF4",
  red:       "#B91C1C",
  redL:      "#FEF2F2",
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
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: T.textSec, fontFamily: "'Instrument Sans', sans-serif" }}>{label}</span>
        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: T.teal, fontWeight: 700, background: T.tealLight, padding: "1px 5px", border: `1px solid ${T.teal}30` }}>
          {fmt(value)}
        </span>
      </div>
      <div style={{ position: "relative", height: 2, background: T.border, marginBottom: 6 }}>
        <div style={{ position: "absolute", left: 0, width: `${pct}%`, height: "100%", background: T.teal }} />
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: T.textTer, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
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
  const loPct = ((lo - min) / (max - min)) * 100;
  const hiPct = ((hi - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: T.textSec, fontFamily: "'Instrument Sans', sans-serif" }}>{label}</span>
        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: T.textSec }}>
          {fmt(lo)} – {fmt(hi)}
        </span>
      </div>
      <div style={{ position: "relative", height: 2, background: T.border, marginBottom: 5 }}>
        <div style={{ position: "absolute", left: `${loPct}%`, width: `${hiPct - loPct}%`, height: "100%", background: T.teal, opacity: 0.7 }} />
      </div>
      <div style={{ fontSize: 8.5, color: T.textTer, marginBottom: 2, fontFamily: "'Instrument Sans', sans-serif" }}>Min</div>
      <input type="range" min={min} max={max} step={step} value={lo}
        onChange={e => { const v = +e.target.value; onChange([Math.min(v, hi - step), hi]); }}
        style={{ width: "100%", marginBottom: 4 }} />
      <div style={{ fontSize: 8.5, color: T.textTer, marginBottom: 2, fontFamily: "'Instrument Sans', sans-serif" }}>Max</div>
      <input type="range" min={min} max={max} step={step} value={hi}
        onChange={e => { const v = +e.target.value; onChange([lo, Math.max(v, lo + step)]); }}
        style={{ width: "100%" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: T.textTer, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
        <span>{fmt(min)}</span><span>{fmt(max)}</span>
      </div>
    </div>
  );
}

// ── Solution analytical summary ───────────────────────────────────────────────
function SolutionPanel({ sol, onViewPlan, inFilter }: { sol: ParetoSolution; onViewPlan: () => void; inFilter: boolean }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${inFilter ? T.teal : T.border}`,
      borderTop: `2px solid ${inFilter ? T.teal : T.borderMed}`,
      padding: "14px 16px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 9, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Instrument Sans', sans-serif", marginBottom: 3 }}>
            Selected Solution
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "'Instrument Sans', sans-serif" }}>
            {sol.label}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
          {sol.pareto && (
            <span style={{ fontSize: 8.5, fontWeight: 700, color: T.teal, background: T.tealLight, padding: "2px 6px", border: `1px solid ${T.teal}40`, fontFamily: "'Instrument Sans', sans-serif", letterSpacing: "0.04em" }}>
              PARETO-OPTIMAL
            </span>
          )}
          {!inFilter && (
            <span style={{ fontSize: 8, fontWeight: 700, color: T.amber, background: T.amberL, padding: "2px 6px", border: "1px solid #FDE68A", fontFamily: "'JetBrains Mono', monospace" }}>
              ⚠ OUTSIDE FILTER
            </span>
          )}
        </div>
      </div>

      {/* Objectives — primary analytical data */}
      <div style={{ borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "10px 0", marginBottom: 10 }}>
        {[
          { label: "Operating Cost",  val: `$${sol.cost}M`,                          mono: true  },
          { label: "Lifecycle GHG",   val: `${(sol.ghg / 1000).toFixed(1)}k kgCO₂`, mono: true  },
          { label: "Fuel Consump.",   val: `${sol.fuel.toLocaleString()} model units`, mono: true  },
          { label: "Cargo Fulfil.",   val: sol.cargoFulfillment == null ? "Unavailable" : `${sol.cargoFulfillment}%`, mono: true  },
        ].map(m => (
          <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: T.textSec, fontFamily: "'Instrument Sans', sans-serif" }}>{m.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>{m.val}</span>
          </div>
        ))}
      </div>

      {/* Configuration */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {[
          { label: "Vessels", val: `${sol.vessels}` },
          { label: "Routes",  val: `${sol.routes}`  },
          { label: "Constraints", val: `${sol.constraintsSatisfied}/${sol.totalConstraints}` },
        ].map(m => (
          <div key={m.label} style={{ flex: 1, background: T.bg, padding: "7px 8px", border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 8.5, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3, fontFamily: "'Instrument Sans', sans-serif" }}>{m.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* Source algorithm + constraint satisfaction (real data) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Instrument Sans', sans-serif" }}>
            Source Algorithm
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.teal, fontFamily: "'JetBrains Mono', monospace" }}>
            {sol.algorithm ?? "unavailable"}
          </span>
        </div>
        <div style={{ fontSize: 9, color: T.textTer, marginTop: 4, fontFamily: "'Instrument Sans', sans-serif" }}>
          {sol.totalConstraints > 0
            ? `${sol.constraintsSatisfied}/${sol.totalConstraints} evaluated feasibility constraints satisfied`
            : "No constraint evaluation data available for this solution"}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onViewPlan}
          style={{
            flex: 1, background: T.teal, color: "white",
            border: "none", padding: "8px 0",
            fontSize: 11, fontWeight: 600, cursor: "pointer",
            fontFamily: "'Instrument Sans', sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          View Fleet Plan →
        </button>
        <button style={{
          background: "white", color: T.textSec,
          border: `1px solid ${T.border}`, padding: "8px 12px",
          fontSize: 11, cursor: "pointer",
          fontFamily: "'Instrument Sans', sans-serif",
        }}>
          Compare
        </button>
      </div>
    </div>
  );
}

// ── Panel label ───────────────────────────────────────────────────────────────
function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 8.5, fontWeight: 700, color: T.textTer,
      textTransform: "uppercase", letterSpacing: "0.09em",
      marginBottom: 8, marginTop: 18,
      fontFamily: "'Instrument Sans', sans-serif",
    }}>
      {children}
    </div>
  );
}

function RadioOpt({ val, current, label, onChange }: {
  val: FixedParam; current: FixedParam; label: string;
  onChange: (v: FixedParam) => void;
}) {
  const active = current === val;
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: 5 }}>
      <div
        onClick={() => onChange(val)}
        style={{
          width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
          border: `1.5px solid ${active ? T.teal : T.borderMed}`,
          background: active ? T.teal : "white",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {active && <div style={{ width: 3, height: 3, borderRadius: "50%", background: "white" }} />}
      </div>
      <span
        onClick={() => onChange(val)}
        style={{ fontSize: 10, color: active ? T.teal : T.textSec, fontWeight: active ? 600 : 400, fontFamily: "'Instrument Sans', sans-serif" }}
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
  borderRadius: 4, fontFamily: "'Instrument Sans', sans-serif", color: T.text, boxSizing: "border-box",
};

function RequestForm({ value, onChange, originFlag, destinationFlag }: RequestFormProps) {
  function set<K extends keyof StructuredRequest>(key: K, v: StructuredRequest[K]) {
    onChange({ ...value, [key]: v });
  }
  function toggleObjective(o: Objective) {
    const has = value.objectives.includes(o);
    set("objectives", has ? value.objectives.filter(x => x !== o) : [...value.objectives, o]);
  }
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
        <div style={{ display: "flex", gap: 14 }}>
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
export default function Optimization({ selectedId, onSelect, onViewPlan }: Props) {
  const [fixedParam,  setFixedParam]  = useState<FixedParam>(null);
  const [vesselRangeOverride, setVesselRangeOverride] = useState<[number, number] | null>(null);
  const [vesselFixed, setVesselFixed] = useState<number | null>(null);
  const [cargoRangeOverride,  setCargoRangeOverride]  = useState<[number, number] | null>(null);
  const [cargoFixed,  setCargoFixed]  = useState<number | null>(null);
  const [routeRangeOverride,  setRouteRangeOverride]  = useState<[number, number] | null>(null);
  const [routeFixed,  setRouteFixed]  = useState<number | null>(null);
  const [axisIdx,     setAxisIdx]     = useState(0);
  const [compareIds,  setCompareIds]  = useState<string[] | null>(null);

  const [requestMode, setRequestMode] = useState<"manual" | "nlp">("manual");
  const [nlqText,      setNlqText]      = useState("");
  const [pendingRequest, setPendingRequest] = useState<StructuredRequest>(EMPTY_REQUEST);
  const [requestReviewReady, setRequestReviewReady] = useState(false);

  // Live data hooks
  const { data: liveResult, loading: liveLoading, error: liveError } = useLatestOptimization();
  const { running: optRunning, jobStatus, triggerRun } = useOptimizationRun();
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
    method: liveResult?.method ?? "unavailable",
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
    { key: "fuel",             label: "Fuel Consumption", fmt: v => v == null ? "Unavailable" : `${v.toLocaleString()} model units` },
    { key: "cost",             label: "Operating Cost",   fmt: v => v == null ? "Unavailable" : `$${v}M` },
    { key: "ghg",              label: "Lifecycle GHG",    fmt: v => v == null ? "Unavailable" : `${v.toLocaleString()} kgCO₂` },
    { key: "cargoFulfillment", label: "Cargo Fulfil.",    fmt: v => v == null ? "Unavailable" : `${v}%` },
    { key: "vessels",          label: "Vessels",          fmt: v => v == null ? "Unavailable" : `${v}` },
    { key: "routes",           label: "Routes",           fmt: v => v == null ? "Unavailable" : `${v}` },
  ];
  const compareSols = effectiveCompareIds.map(id => allSolutions.find(s => s.id === id)).filter(Boolean) as ParetoSolution[];
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

      {/* Request builder: Manual Input vs AI / Natural Language */}
      <div style={{ padding: "12px 24px 0" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${T.border}` }}>
            {([["manual", "Manual Input"], ["nlp", "AI / Natural Language"]] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => setRequestMode(m)}
                style={{
                  padding: "9px 18px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                  background: requestMode === m ? T.tealLight : "white",
                  color: requestMode === m ? T.teal : T.textSec,
                  borderBottom: requestMode === m ? `2px solid ${T.teal}` : "2px solid transparent",
                  fontFamily: "'Instrument Sans', sans-serif",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ padding: "14px 18px" }}>
            {requestMode === "manual" ? (
              <>
                <RequestForm value={pendingRequest} onChange={setPendingRequest} />
                {requestErr && (
                  <div style={{ fontSize: 11, color: T.red, marginBottom: 8 }}>⚠ {requestErr}</div>
                )}
                {!hasAnyConstraint && (
                  <div style={{ fontSize: 10, color: T.textTer, marginBottom: 8 }}>
                    No fields set — optimizing across all available routes/vessels/fuels.
                  </div>
                )}
                <button
                  onClick={handleOptimize}
                  disabled={optRunning || !!requestErr}
                  style={{
                    background: optRunning ? "#9CA3AF" : T.teal, color: "white", border: "none",
                    padding: "8px 16px", fontSize: 11, fontWeight: 700,
                    cursor: optRunning || requestErr ? "not-allowed" : "pointer",
                    fontFamily: "'Instrument Sans', sans-serif",
                  }}
                >
                  {optRunning ? `Optimizing... ${jobStatus?.progress ?? 0}%` : "Optimize"}
                </button>
              </>
            ) : !requestReviewReady ? (
              <>
                <div style={{ fontSize: 11, color: T.textSec, marginBottom: 8, fontFamily: "'Instrument Sans', sans-serif" }}>
                  Describe your fleet optimization requirement
                </div>
                <textarea
                  placeholder='e.g. "Find a low-emission route from Yokohama to Singapore carrying 5000 tonnes at 18 knots"'
                  value={nlqText}
                  onChange={e => setNlqText(e.target.value)}
                  rows={3}
                  style={{ width: "100%", padding: "9px 12px", fontSize: 12, border: `1px solid ${T.border}`, borderRadius: 4, fontFamily: "'Instrument Sans', sans-serif", color: T.text, boxSizing: "border-box", resize: "vertical", marginBottom: 10 }}
                />
                {nlpError && (
                  <div style={{ fontSize: 11, color: T.red, marginBottom: 8 }}>⚠ {nlpError}</div>
                )}
                <button
                  onClick={handleGenerateRequest}
                  disabled={nlpLoading}
                  style={{ background: nlpLoading ? "#9CA3AF" : T.teal, color: "white", border: "none", padding: "8px 16px", fontSize: 11, fontWeight: 700, cursor: nlpLoading ? "not-allowed" : "pointer", fontFamily: "'Instrument Sans', sans-serif" }}
                >
                  {nlpLoading ? "Parsing..." : "Generate Request"}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.text, marginBottom: 2, fontFamily: "'Instrument Sans', sans-serif" }}>Detected request</div>
                <div style={{ fontSize: 10, color: T.textTer, marginBottom: 10 }}>
                  {nlpResult?.gemini_used
                    ? "Normalized with Gemini, then parsed deterministically. Review and edit before optimizing."
                    : "Parsed deterministically (Gemini normalization unavailable). Review and edit before optimizing."}
                </div>
                <RequestForm
                  value={pendingRequest}
                  onChange={setPendingRequest}
                  originFlag={nlpResult ? { valid: nlpResult.parsed.origin_valid, suggestion: nlpResult.parsed.origin_suggestion } : null}
                  destinationFlag={nlpResult ? { valid: nlpResult.parsed.destination_valid, suggestion: nlpResult.parsed.destination_suggestion } : null}
                />
                {requestErr && (
                  <div style={{ fontSize: 11, color: T.red, marginBottom: 8 }}>⚠ {requestErr}</div>
                )}
                {!hasAnyConstraint && (
                  <div style={{ fontSize: 10, color: T.textTer, marginBottom: 8 }}>
                    No fields were detected in your request — optimizing across all available routes/vessels/fuels.
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { setRequestReviewReady(false); resetNLQ(); setNlqText(""); }}
                    style={{ background: "white", color: T.textSec, border: `1px solid ${T.border}`, padding: "8px 14px", fontSize: 11, cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif" }}
                  >
                    New Query
                  </button>
                  <button
                    onClick={handleEditInManualForm}
                    style={{ background: "white", color: T.textSec, border: `1px solid ${T.border}`, padding: "8px 14px", fontSize: 11, cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif" }}
                  >
                    Edit in Manual Form
                  </button>
                  <button
                    onClick={handleOptimize}
                    disabled={optRunning || !!requestErr}
                    style={{
                      background: optRunning ? "#9CA3AF" : T.teal, color: "white", border: "none",
                      padding: "8px 16px", fontSize: 11, fontWeight: 700,
                      cursor: optRunning || requestErr ? "not-allowed" : "pointer",
                      fontFamily: "'Instrument Sans', sans-serif",
                    }}
                  >
                    {optRunning ? `Optimizing... ${jobStatus?.progress ?? 0}%` : "Optimize"}
                  </button>
                </div>
              </>
            )}

            {optRunning && jobStatus && (
              <div style={{ background: T.tealLight, border: `1px solid ${T.teal}30`, padding: "6px 14px", display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <div style={{ flex: 1, height: 4, background: T.border, borderRadius: 2 }}>
                  <div style={{ width: `${jobStatus.progress}%`, height: "100%", background: T.teal, borderRadius: 2, transition: "width 0.3s" }} />
                </div>
                <span style={{ fontSize: 10, color: T.teal, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>{jobStatus.message}</span>
              </div>
            )}
            {!optRunning && jobStatus?.status === "failed" && (
              <div style={{ background: T.redL, border: `1px solid ${T.red}40`, padding: "8px 14px", fontSize: 11, color: T.red, marginTop: 10 }}>
                ⚠ Optimization failed: {jobStatus.error ?? jobStatus.message}
              </div>
            )}
            {!optRunning && jobStatus?.status === "completed" && liveResult?.request_warnings && liveResult.request_warnings.length > 0 && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", padding: "8px 14px", fontSize: 11, color: "#78350F", marginTop: 10 }}>
                {liveResult.request_warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Run summary strip */}
      <div style={{ padding: "14px 24px 0" }}>
        <div style={{ display: "flex", gap: 0, marginBottom: 0, border: `1px solid ${T.border}`, background: T.surface }}>
          {[
            { label: "Optimization Method", val: runMeta.method,      sub: "NSGA-II / QBHO / CQM / MILP",      accent: T.teal  },
            { label: "Data Mode",           val: liveResult?.data_mode ?? "unavailable", sub: liveResult?.source ?? "no result loaded", accent: T.teal },
            { label: "Feasible Solutions",  val: String(runMeta.feasible), sub: "total evaluated",             accent: T.text  },
            { label: "Pareto-Optimal",      val: String(runMeta.pareto),   sub: "non-dominated plans",         accent: T.teal  },
            { label: "Runtime",             val: runMeta.runtime,     sub: "wall-clock time",                  accent: T.text  },
            { label: "Constraint Satisf.",  val: runMeta.satisfaction, sub: "all plans feasible",              accent: T.green },
          ].map((c, i) => (
            <div key={c.label} style={{
              flex: 1, padding: "10px 14px",
              borderLeft: i === 0 ? `2px solid ${T.teal}` : `1px solid ${T.border}`,
            }}>
              <div style={{ fontSize: 8.5, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4, fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>{c.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.accent, fontFamily: "'Instrument Sans', sans-serif" }}>{c.val}</div>
              <div style={{ fontSize: 8.5, color: T.textTer, marginTop: 2 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "232px 1fr", alignItems: "start" }}>

        {/* ── Left controls panel ── */}
        <div style={{
          background: T.surface,
          borderRight: `1px solid ${T.border}`,
          padding: "14px 14px 28px",
          minHeight: "calc(100vh - 140px)",
        }}>

          {/* Fixed parameter */}
          <PanelLabel>Fixed Parameter</PanelLabel>
          <div style={{ fontSize: 10, color: T.textTer, marginBottom: 8, lineHeight: 1.4, fontFamily: "'Instrument Sans', sans-serif" }}>
            Pin one constraint; the rest use sliding ranges.
          </div>
          <RadioOpt val={null}      current={fixedParam} label="No fixed parameter"    onChange={setFixedParam} />
          <RadioOpt val="vessels"   current={fixedParam} label="Fix vessel count"       onChange={setFixedParam} />
          <RadioOpt val="cargo"     current={fixedParam} label="Fix cargo fulfillment"  onChange={setFixedParam} />
          <RadioOpt val="routes"    current={fixedParam} label="Fix route count"        onChange={setFixedParam} />

          {/* Constraint window */}
          <PanelLabel>Constraint Window</PanelLabel>
          {fixedParam === "vessels" ? (
            <EngrSlider label="Vessels (fixed)" min={vesselBounds[0]} max={vesselBounds[1]} step={1}
              value={vesselFixedVal} onChange={setVesselFixed} format={v => `${v} vessels`} />
          ) : (
            <EngrRangeSlider label="Vessels" min={vesselBounds[0]} max={vesselBounds[1]} step={1}
              value={vesselRange} onChange={setVesselRangeOverride} format={v => `${v}`} />
          )}
          {!cargoAvailable ? (
            <div style={{ fontSize: 9.5, color: T.textTer, marginBottom: 10, fontFamily: "'Instrument Sans', sans-serif" }}>
              Cargo fulfillment is not computed by the optimizer for this run.
            </div>
          ) : fixedParam === "cargo" ? (
            <EngrSlider label="Cargo Fulfillment (fixed)" min={cargoBounds[0]} max={cargoBounds[1]} step={0.5}
              value={cargoFixedVal} onChange={setCargoFixed} format={v => `${v}%`} />
          ) : (
            <EngrRangeSlider label="Cargo Fulfillment" min={cargoBounds[0]} max={cargoBounds[1]} step={0.5}
              value={cargoRange} onChange={setCargoRangeOverride} format={v => `${v}%`} />
          )}
          {fixedParam === "routes" ? (
            <EngrSlider label="Routes (fixed)" min={routeBounds[0]} max={routeBounds[1]} step={1}
              value={routeFixedVal} onChange={setRouteFixed} format={v => `${v} routes`} />
          ) : (
            <EngrRangeSlider label="Routes" min={routeBounds[0]} max={routeBounds[1]} step={1}
              value={routeRange} onChange={setRouteRangeOverride} format={v => `${v}`} />
          )}

          {/* Filter stats */}
          <PanelLabel>Filter Statistics</PanelLabel>
          <div style={{ border: `1px solid ${T.border}`, padding: "8px 10px" }}>
            {[
              { label: "Visible solutions", val: `${filteredSolutions.length} / ${allSolutions.length}`, c: T.text },
              { label: "Pareto-optimal",    val: `${filteredPareto.length} / ${allSolutions.filter(s => s.pareto).length}`, c: T.teal },
              { label: "Dominated",         val: `${filteredDominated.length} / ${allSolutions.filter(s => !s.pareto).length}`, c: T.textTer },
              { label: "Live front pts",    val: `${liveFront.length}`,                                        c: T.amber },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                <span style={{ fontSize: 9.5, color: T.textSec, fontFamily: "'Instrument Sans', sans-serif" }}>{r.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: r.c, fontFamily: "'JetBrains Mono', monospace" }}>{r.val}</span>
              </div>
            ))}
          </div>

          {filteredSolutions.length === 0 && (
            <div style={{ marginTop: 8, padding: "7px 9px", background: T.redL, border: `1px solid ${T.red}40`, fontSize: 10, color: T.red, fontFamily: "'Instrument Sans', sans-serif" }}>
              ⚠ No solutions match. Expand the ranges.
            </div>
          )}
          {fixedParam && (
            <button
              onClick={() => setFixedParam(null)}
              style={{ marginTop: 10, width: "100%", padding: "6px 0", fontSize: 10, color: T.textSec, background: T.bg, border: `1px solid ${T.border}`, cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif" }}
            >
              Clear fixed parameter
            </button>
          )}
        </div>

        {/* ── Right: chart + solution + compare ── */}
        <div style={{ padding: "16px 20px 28px" }}>

          {/* Chart + solution panel */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, marginBottom: 14 }}>

            {/* Pareto chart panel */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "14px 16px" }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.text, fontFamily: "'Instrument Sans', sans-serif" }}>
                  Pareto Front — Solution Space
                </div>
                <div style={{ fontSize: 10, color: T.textSec, marginTop: 2, fontFamily: "'Instrument Sans', sans-serif" }}>
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
                />
              </div>
            </div>

            {/* Selected solution analytical panel */}
            {selected ? (
              <SolutionPanel sol={selected} onViewPlan={onViewPlan} inFilter={isSelectedInFilter} />
            ) : (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "14px 16px", fontSize: 11, color: T.textTer }}>
                No optimization result loaded yet.
              </div>
            )}
          </div>

          {/* Compare solutions table */}
          <div style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.text, fontFamily: "'Instrument Sans', sans-serif" }}>
                  Solution Comparison
                </div>
                <div style={{ fontSize: 10, color: T.textSec }}>Side-by-side trade-off analysis across Pareto-optimal plans</div>
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
