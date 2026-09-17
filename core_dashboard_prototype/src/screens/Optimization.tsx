import React, { useState, useMemo } from "react";
import ParetoChart, { ExtraFront, AXIS_PAIRS, AxisKey } from "../components/ParetoChart";
import { PARETO_SOLUTIONS, ParetoSolution } from "../data/mock";
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

// ── Synthetic scenario fronts ─────────────────────────────────────────────────
const SCENARIO_FRONTS: Record<string, ExtraFront> = {
  sustainability: {
    id: "sustainability",
    label: "Sustainability Priority",
    color: "#059669",
    data: PARETO_SOLUTIONS.filter(s => s.pareto).map(s => ({
      cost: s.cost * 1.085,
      ghg:  s.ghg  * 0.880,
      fuel: s.fuel * 0.898,
    })),
  },
  cost_prio: {
    id: "cost_prio",
    label: "Cost Priority",
    color: "#B45309",
    data: PARETO_SOLUTIONS.filter(s => s.pareto).map(s => ({
      cost: s.cost * 0.914,
      ghg:  s.ghg  * 1.165,
      fuel: s.fuel * 1.062,
    })),
  },
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

function solutionConfidence(sol: ParetoSolution): number {
  const constraintConf = sol.constraintsSatisfied / sol.totalConstraints;
  const allPareto = PARETO_SOLUTIONS.filter(s => s.pareto).sort((a, b) => a.cost - b.cost);
  const frontIdx  = allPareto.findIndex(s => s.id === sol.id);
  const n = allPareto.length;
  const posPenalty = frontIdx >= 0 ? Math.abs((frontIdx / (n - 1)) - 0.5) * 0.14 : 0.14;
  return Math.max(0.80, constraintConf * (1 - posPenalty));
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
  const conf = solutionConfidence(sol);
  const confPct = Math.round(conf * 100);
  const confColor = confPct >= 92 ? T.teal : confPct >= 85 ? T.amber : T.red;

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
          { label: "Lifecycle GHG",   val: `${(sol.ghg / 1000).toFixed(1)}k tCO₂e`, mono: true  },
          { label: "Fuel Consump.",   val: `${sol.fuel.toLocaleString()} t`,          mono: true  },
          { label: "Cargo Fulfil.",   val: `${sol.cargoFulfillment}%`,               mono: true  },
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

      {/* Model confidence */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
          <span style={{ fontSize: 9, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Instrument Sans', sans-serif" }}>
            Model Confidence · MO-QIGA
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: confColor, fontFamily: "'JetBrains Mono', monospace" }}>
            {confPct}%
          </span>
        </div>
        <div style={{ height: 3, background: T.border }}>
          <div style={{ width: `${confPct}%`, height: "100%", background: confColor, transition: "width 0.3s" }} />
        </div>
        <div style={{ fontSize: 9, color: T.textTer, marginTop: 4, fontFamily: "'Instrument Sans', sans-serif" }}>
          {confPct >= 92 ? "High confidence — central front region" : confPct >= 85 ? "Moderate confidence — approaching front extremity" : "Lower confidence — edge of solution space"}
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

// ── Main component ────────────────────────────────────────────────────────────
const COMPARE_PRESETS = [["S01", "S07", "S18"], ["S04", "S07", "S12"]];

export default function Optimization({ selectedId, onSelect, onViewPlan }: Props) {
  const [fixedParam,  setFixedParam]  = useState<FixedParam>(null);
  const [vesselRange, setVesselRange] = useState<[number, number]>([20, 24]);
  const [vesselFixed, setVesselFixed] = useState(22);
  const [cargoRange,  setCargoRange]  = useState<[number, number]>([94, 99]);
  const [cargoFixed,  setCargoFixed]  = useState(97);
  const [routeRange,  setRouteRange]  = useState<[number, number]>([14, 18]);
  const [routeFixed,  setRouteFixed]  = useState(16);
  const [axisIdx,     setAxisIdx]     = useState(0);
  const [showConf,    setShowConf]    = useState(true);
  const [confLevel,   setConfLevel]   = useState(0.95);
  const [activeScenarios, setActiveScenarios] = useState<Set<string>>(new Set());
  const [compareIds,  setCompareIds]  = useState<string[]>(["S01", "S07", "S18"]);
  const [nlqText,     setNlqText]     = useState("");

  // Live data hooks
  const { data: liveResult, loading: liveLoading } = useLatestOptimization();
  const { running: optRunning, jobStatus, triggerRun } = useOptimizationRun();
  const { result: nlpResult, loading: nlpLoading, query: runNLQ } = useNLPQuery();

  // Use live Pareto solutions if available, otherwise fall back to mock
  const allSolutions: ParetoSolution[] = (liveResult?.pareto_solutions as ParetoSolution[] | undefined) ?? PARETO_SOLUTIONS;
  const runMeta = {
    method: liveResult?.method ?? "MO-QIGA",
    feasible: liveResult?.feasible_solutions ?? 42,
    pareto: liveResult?.pareto_count ?? 18,
    runtime: liveResult ? `${Math.floor((liveResult.runtime_seconds ?? 252) / 60)}m ${(liveResult.runtime_seconds ?? 252) % 60}s` : "4m 12s",
    satisfaction: liveResult?.constraint_satisfaction ?? "100%",
  };

  const selected = allSolutions.find(s => s.id === selectedId) ?? allSolutions[6] ?? PARETO_SOLUTIONS[6];

  const filteredSolutions = useMemo(() => {
    return allSolutions.filter(s => {
      const ok1 = fixedParam === "vessels" ? s.vessels === vesselFixed : s.vessels >= vesselRange[0] && s.vessels <= vesselRange[1];
      const ok2 = fixedParam === "cargo"   ? Math.abs(s.cargoFulfillment - cargoFixed) <= 0.6 : s.cargoFulfillment >= cargoRange[0] && s.cargoFulfillment <= cargoRange[1];
      const ok3 = fixedParam === "routes"  ? s.routes === routeFixed : s.routes >= routeRange[0] && s.routes <= routeRange[1];
      return ok1 && ok2 && ok3;
    });
  }, [allSolutions, fixedParam, vesselRange, vesselFixed, cargoRange, cargoFixed, routeRange, routeFixed]);

  const filteredIds = useMemo(() => new Set(filteredSolutions.map(s => s.id)), [filteredSolutions]);

  const liveFront = useMemo(() => {
    const { x, y } = AXIS_PAIRS[axisIdx];
    return computeLiveFront(filteredSolutions, x, y);
  }, [filteredSolutions, axisIdx]);

  const filteredPareto    = filteredSolutions.filter(s => s.pareto);
  const filteredDominated = filteredSolutions.filter(s => !s.pareto);

  const activeExtraFronts = useMemo(
    () => Object.values(SCENARIO_FRONTS).filter(f => activeScenarios.has(f.id)),
    [activeScenarios]
  );

  const isSelectedInFilter = filteredIds.has(selected.id);

  type MetricKey = "fuel" | "cost" | "ghg" | "cargoFulfillment" | "vessels" | "routes";
  const compareMetrics: { key: MetricKey; label: string; fmt: (v: number) => string }[] = [
    { key: "fuel",             label: "Fuel Consumption", fmt: v => `${v.toLocaleString()} t`      },
    { key: "cost",             label: "Operating Cost",   fmt: v => `$${v}M`                        },
    { key: "ghg",              label: "Lifecycle GHG",    fmt: v => `${v.toLocaleString()} tCO₂e`  },
    { key: "cargoFulfillment", label: "Cargo Fulfil.",    fmt: v => `${v}%`                         },
    { key: "vessels",          label: "Vessels",          fmt: v => `${v}`                          },
    { key: "routes",           label: "Routes",           fmt: v => `${v}`                          },
  ];
  const compareSols = compareIds.map(id => allSolutions.find(s => s.id === id)).filter(Boolean) as ParetoSolution[];
  function bestFor(key: MetricKey) {
    const arr = compareSols.map(s => ({ id: s.id, v: s[key] as number }));
    return arr.reduce((a, b) => b.v < a.v ? b : a, arr[0])?.id;
  }

  return (
    <div style={{ overflowY: "auto", height: "100%" }}>

      {/* NLP query bar */}
      <div style={{ padding: "12px 24px 0" }}>
        <div style={{ display: "flex", gap: 8, background: T.surface, border: `1px solid ${T.border}`, padding: "10px 14px", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Instrument Sans', sans-serif", whiteSpace: "nowrap" }}>NLP Query</span>
          <input
            type="text"
            placeholder='e.g. "Find low emission route from Mumbai to Singapore at 18 knots"'
            value={nlqText}
            onChange={e => setNlqText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && nlqText.trim() && runNLQ(nlqText)}
            style={{ flex: 1, border: "none", outline: "none", fontSize: 11, fontFamily: "'Instrument Sans', sans-serif", color: T.text, background: "transparent" }}
          />
          <button
            onClick={() => nlqText.trim() && runNLQ(nlqText)}
            disabled={nlpLoading}
            style={{ background: nlpLoading ? "#9CA3AF" : T.teal, color: "white", border: "none", padding: "5px 12px", fontSize: 10, fontWeight: 600, cursor: nlpLoading ? "not-allowed" : "pointer", fontFamily: "'Instrument Sans', sans-serif" }}
          >
            {nlpLoading ? "Querying..." : "Search"}
          </button>
          {nlpResult && (
            <span style={{ fontSize: 10, color: nlpResult.warnings.length > 0 ? T.amber : T.green, fontFamily: "'JetBrains Mono', monospace" }}>
              {nlpResult.warnings.length > 0 ? `⚠ ${nlpResult.warnings[0]}` : `✓ ${nlpResult.solutions.length} results · Recommended: ${nlpResult.recommended_solution_id ?? "S07"}`}
            </span>
          )}
          <button
            onClick={() => triggerRun(false)}
            disabled={optRunning}
            style={{ background: optRunning ? "#9CA3AF" : "#15803D", color: "white", border: "none", padding: "5px 12px", fontSize: 10, fontWeight: 600, cursor: optRunning ? "not-allowed" : "pointer", fontFamily: "'Instrument Sans', sans-serif", marginLeft: 8 }}
          >
            {optRunning ? `Running... ${jobStatus?.progress ?? 0}%` : "↻ Re-run Optimization"}
          </button>
        </div>
        {optRunning && jobStatus && (
          <div style={{ background: T.tealLight, border: `1px solid ${T.teal}30`, padding: "6px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 4, background: T.border, borderRadius: 2 }}>
              <div style={{ width: `${jobStatus.progress}%`, height: "100%", background: T.teal, borderRadius: 2, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 10, color: T.teal, fontFamily: "'JetBrains Mono', monospace", whiteSpace: "nowrap" }}>{jobStatus.message}</span>
          </div>
        )}
      </div>

      {/* Run summary strip */}
      <div style={{ padding: "14px 24px 0" }}>
        <div style={{ display: "flex", gap: 0, marginBottom: 0, border: `1px solid ${T.border}`, background: T.surface }}>
          {[
            { label: "Optimization Method", val: runMeta.method,      sub: "Multi-Objective Quantum-Inspired", accent: T.teal  },
            { label: "Initialization",      val: "CQM",               sub: "Constrained Quadratic Model",      accent: T.teal  },
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

          {/* Scenario fronts */}
          <PanelLabel>Scenario Fronts</PanelLabel>
          <div style={{ fontSize: 10, color: T.textTer, marginBottom: 10, lineHeight: 1.5, fontFamily: "'Instrument Sans', sans-serif" }}>
            Overlay alternative optimization weight configurations.
          </div>
          {Object.values(SCENARIO_FRONTS).map(f => {
            const isOn = activeScenarios.has(f.id);
            return (
              <label key={f.id} style={{
                display: "flex", alignItems: "flex-start", gap: 7, cursor: "pointer",
                marginBottom: 7, padding: "7px 8px",
                background: isOn ? `${f.color}0A` : T.bg,
                border: `1px solid ${isOn ? f.color + "50" : T.border}`,
              }}>
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={e => {
                    const next = new Set(activeScenarios);
                    e.target.checked ? next.add(f.id) : next.delete(f.id);
                    setActiveScenarios(next);
                  }}
                  style={{ accentColor: f.color, marginTop: 2, cursor: "pointer", flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: isOn ? f.color : T.text, fontFamily: "'Instrument Sans', sans-serif" }}>{f.label}</div>
                  <div style={{ fontSize: 8.5, color: T.textTer, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                    {f.id === "sustainability" ? "+8.5% cost · −12% GHG" : "−8.5% cost · +16.5% GHG"}
                  </div>
                </div>
              </label>
            );
          })}

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
            <EngrSlider label="Vessels (fixed)" min={20} max={24} step={1}
              value={vesselFixed} onChange={setVesselFixed} format={v => `${v} vessels`} />
          ) : (
            <EngrRangeSlider label="Vessels" min={20} max={24} step={1}
              value={vesselRange} onChange={setVesselRange} format={v => `${v}`} />
          )}
          {fixedParam === "cargo" ? (
            <EngrSlider label="Cargo Fulfillment (fixed)" min={94} max={99} step={0.5}
              value={cargoFixed} onChange={setCargoFixed} format={v => `${v}%`} />
          ) : (
            <EngrRangeSlider label="Cargo Fulfillment" min={94} max={99} step={0.5}
              value={cargoRange} onChange={setCargoRange} format={v => `${v}%`} />
          )}
          {fixedParam === "routes" ? (
            <EngrSlider label="Routes (fixed)" min={14} max={18} step={1}
              value={routeFixed} onChange={setRouteFixed} format={v => `${v} routes`} />
          ) : (
            <EngrRangeSlider label="Routes" min={14} max={18} step={1}
              value={routeRange} onChange={setRouteRange} format={v => `${v}`} />
          )}

          {/* Confidence bands */}
          <PanelLabel>Confidence Interval</PanelLabel>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: 8 }}>
            <input type="checkbox" checked={showConf} onChange={e => setShowConf(e.target.checked)}
              style={{ accentColor: T.teal, cursor: "pointer" }} />
            <span style={{ fontSize: 10, color: T.textSec, fontFamily: "'Instrument Sans', sans-serif" }}>Show confidence bands</span>
          </label>
          {showConf && (
            <div style={{ display: "flex", gap: 0, marginBottom: 8, border: `1px solid ${T.border}` }}>
              {([0.90, 0.95, 0.99] as const).map((lv, i) => (
                <button
                  key={lv}
                  onClick={() => setConfLevel(lv)}
                  style={{
                    flex: 1, padding: "5px 0", fontSize: 10,
                    border: "none",
                    borderLeft: i > 0 ? `1px solid ${T.border}` : "none",
                    background: confLevel === lv ? T.teal : T.bg,
                    color: confLevel === lv ? "white" : T.textSec,
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: confLevel === lv ? 700 : 400,
                  }}
                >
                  {lv * 100}%
                </button>
              ))}
            </div>
          )}
          <div style={{ fontSize: 9, color: T.textTer, lineHeight: 1.5, fontFamily: "'Instrument Sans', sans-serif" }}>
            {showConf
              ? `${confLevel * 100}% CI · MO-QIGA objective uncertainty from quantum sampling noise and operational variability.`
              : "Enable to visualize uncertainty bands around each Pareto front."}
          </div>

          {/* Filter stats */}
          <PanelLabel>Filter Statistics</PanelLabel>
          <div style={{ border: `1px solid ${T.border}`, padding: "8px 10px" }}>
            {[
              { label: "Visible solutions", val: `${filteredSolutions.length} / ${PARETO_SOLUTIONS.length}`, c: T.text },
              { label: "Pareto-optimal",    val: `${filteredPareto.length} / 18`,                             c: T.teal },
              { label: "Dominated",         val: `${filteredDominated.length} / 24`,                          c: T.textTer },
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
                  {activeExtraFronts.length > 0
                    ? `Baseline + ${activeExtraFronts.length} scenario front${activeExtraFronts.length > 1 ? "s" : ""} · click a point to select`
                    : "42 feasible solutions · click Pareto-optimal point to select"}
                </div>
              </div>
              <div style={{ height: 360 }}>
                <ParetoChart
                  selectedId={selectedId}
                  onSelect={onSelect}
                  filteredIds={filteredIds}
                  liveFront={liveFront}
                  extraFronts={activeExtraFronts}
                  showConfidence={showConf}
                  confidenceLevel={confLevel}
                  axisIdx={axisIdx}
                  onAxisChange={setAxisIdx}
                />
              </div>
              {showConf && (
                <div style={{ marginTop: 10, padding: "7px 10px", background: T.bg, border: `1px solid ${T.border}`, fontSize: 9.5, color: T.textTer, lineHeight: 1.4, fontFamily: "'Instrument Sans', sans-serif" }}>
                  Shaded bands show the {confLevel * 100}% confidence interval around each front — the region where the true optimum likely lies given MO-QIGA quantum sampling uncertainty.
                </div>
              )}
            </div>

            {/* Selected solution analytical panel */}
            <SolutionPanel sol={selected} onViewPlan={onViewPlan} inFilter={isSelectedInFilter} />
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
              <div style={{ display: "flex", gap: 0, border: `1px solid ${T.border}` }}>
                {COMPARE_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => setCompareIds(preset)}
                    style={{
                      background: JSON.stringify(compareIds) === JSON.stringify(preset) ? T.teal : T.bg,
                      color:      JSON.stringify(compareIds) === JSON.stringify(preset) ? "white" : T.textSec,
                      border: "none",
                      borderLeft: i > 0 ? `1px solid ${T.border}` : "none",
                      padding: "5px 10px", fontSize: 10, cursor: "pointer",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {preset.join(" · ")}
                  </button>
                ))}
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
                      {s.pareto && <div style={{ fontSize: 8, color: T.textTer, fontWeight: 400, marginTop: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                        {Math.round(solutionConfidence(s) * 100)}% conf.
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
                            {m.fmt(s[m.key] as number)}
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
                {compareSols.length >= 2 && (
                  <>
                    <strong style={{ color: T.text }}>{compareSols[0].label}</strong> achieves lower lifecycle GHG ({compareSols[0].ghg.toLocaleString()} tCO₂e) at higher operating cost (${compareSols[0].cost}M).{" "}
                    <strong style={{ color: T.text }}>{compareSols[compareSols.length - 1].label}</strong> minimizes cost (${compareSols[compareSols.length - 1].cost}M) with higher GHG ({compareSols[compareSols.length - 1].ghg.toLocaleString()} tCO₂e).{" "}
                    Selection depends on the operator{"'"}s ESG and financial priorities.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
