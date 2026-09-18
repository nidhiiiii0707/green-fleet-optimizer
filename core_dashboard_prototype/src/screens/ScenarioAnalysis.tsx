import React, { useState } from "react";
import { useScenario } from "../api/hooks";
import type { ScenarioControls } from "../api/types";

interface Props {
  onGoToFleetPlan: () => void;
}

const PRESETS = [
  { id: "p1", label: "Increased Cargo Demand",      changes: { demand: 120, fuel: 100, ghg: 100, deadline: 100, vessels: 100, fuelAvail: 100, portCap: 100 } },
  { id: "p2", label: "Reduced Vessel Availability", changes: { demand: 100, fuel: 100, ghg: 100, deadline: 100, vessels: 80,  fuelAvail: 100, portCap: 100 } },
  { id: "p3", label: "Stricter GHG Limit",          changes: { demand: 100, fuel: 100, ghg: 85,  deadline: 100, vessels: 100, fuelAvail: 100, portCap: 100 } },
  { id: "p4", label: "Higher Fuel Price",            changes: { demand: 100, fuel: 140, ghg: 100, deadline: 100, vessels: 100, fuelAvail: 100, portCap: 100 } },
  { id: "p5", label: "Port Capacity Restriction",   changes: { demand: 100, fuel: 100, ghg: 100, deadline: 100, vessels: 100, fuelAvail: 100, portCap: 75  } },
];

function Slider({ label, value, min, max, unit, onChange }: {
  label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#1D4ED8", height: 4 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

export default function ScenarioAnalysis({ onGoToFleetPlan }: Props) {
  const [controls, setControls] = useState<ScenarioControls>({ demand: 100, fuel: 100, ghg: 100, deadline: 100, vessels: 100, fuelAvail: 100, portCap: 100 });
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const { result, loading, error, run } = useScenario();
  const ran = result !== null;

  function applyPreset(preset: typeof PRESETS[0]) {
    setControls(preset.changes);
    setActivePreset(preset.id);
  }

  function reset() {
    setControls({ demand: 100, fuel: 100, ghg: 100, deadline: 100, vessels: 100, fuelAvail: 100, portCap: 100 });
    setActivePreset(null);
  }

  function runScenario() {
    run(controls);
  }

  const fmtDelta = (v: number | null) => v == null ? "Unavailable" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
  const deltaColor = (v: number | null, higherIsBad = true) =>
    v == null || v === 0 ? "#64748B" : (higherIsBad ? (v > 0 ? "#DC2626" : "#059669") : (v > 0 ? "#059669" : "#DC2626"));

  return (
    <div style={{ padding: "24px 28px", overflowY: "auto", height: "100%" }}>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={onGoToFleetPlan}
          style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: 7, padding: "6px 12px", fontSize: 12, color: "#64748B", cursor: "pointer" }}
        >
          ← Fleet Plan
        </button>
        <span style={{ fontSize: 12, color: "#94A3B8" }}>
          Scenario results computed by the optimization model via live API.
        </span>
        {error && (
          <span style={{ fontSize: 12, color: "#DC2626", background: "#FEF2F2", padding: "3px 8px", borderRadius: 4 }}>
            ⚠ API error: {error}
          </span>
        )}
      </div>

      {/* Presets */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8 }}>Example Presets</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              style={{
                padding: "7px 14px", fontSize: 12, borderRadius: 7, border: "1px solid",
                borderColor: activePreset === p.id ? "#1D4ED8" : "#E2E8F0",
                background: activePreset === p.id ? "#EFF6FF" : "white",
                color: activePreset === p.id ? "#1D4ED8" : "#475569",
                cursor: "pointer", fontWeight: activePreset === p.id ? 600 : 400,
              }}
            >
              {p.label}
            </button>
          ))}
          <button onClick={reset} style={{ padding: "7px 14px", fontSize: 12, borderRadius: 7, border: "1px solid #E2E8F0", background: "white", color: "#94A3B8", cursor: "pointer" }}>
            Reset
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16 }}>

        {/* Controls */}
        <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, padding: "18px 20px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>Scenario Controls</div>

          <Slider label="Cargo Demand"         value={controls.demand}    min={60}  max={150} unit="%" onChange={v => { setControls(c => ({ ...c, demand: v })); setActivePreset(null); }} />
          <Slider label="Fuel Price Index"     value={controls.fuel}      min={60}  max={200} unit="%" onChange={v => { setControls(c => ({ ...c, fuel: v })); setActivePreset(null); }} />
          <Slider label="GHG Regulatory Limit" value={controls.ghg}       min={60}  max={120} unit="%" onChange={v => { setControls(c => ({ ...c, ghg: v })); setActivePreset(null); }} />
          <Slider label="Delivery Deadline"    value={controls.deadline}  min={70}  max={130} unit="%" onChange={v => { setControls(c => ({ ...c, deadline: v })); setActivePreset(null); }} />
          <Slider label="Available Vessels"    value={controls.vessels}   min={50}  max={100} unit="%" onChange={v => { setControls(c => ({ ...c, vessels: v })); setActivePreset(null); }} />
          <Slider label="Fuel Availability"    value={controls.fuelAvail} min={50}  max={100} unit="%" onChange={v => { setControls(c => ({ ...c, fuelAvail: v })); setActivePreset(null); }} />
          <Slider label="Port Capacity"        value={controls.portCap}   min={50}  max={100} unit="%" onChange={v => { setControls(c => ({ ...c, portCap: v })); setActivePreset(null); }} />

          <button
            onClick={runScenario}
            disabled={loading}
            style={{
              width: "100%", background: loading ? "#93C5FD" : "#1D4ED8", color: "white", border: "none",
              borderRadius: 8, padding: "11px 0", fontSize: 14, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", marginTop: 8,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {loading ? (
              <>
                <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Computing...
              </>
            ) : "Run Scenario"}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>

        {/* Results */}
        <div>
          {!ran && !loading ? (
            <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, padding: "40px 24px", textAlign: "center", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚗️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>Adjust controls and run a scenario</div>
              <div style={{ fontSize: 13, color: "#64748B", maxWidth: 320 }}>
                Modify operating conditions above or select a preset, then click "Run Scenario" to compute the impact via the optimization model.
              </div>
            </div>
          ) : loading ? (
            <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, padding: "40px 24px", textAlign: "center", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 40, height: 40, border: "3px solid #E2E8F0", borderTopColor: "#1D4ED8", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 16 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>Computing scenario...</div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>Calling optimization model API</div>
            </div>
          ) : result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Scenario result KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                {[
                  { label: "Fuel Change",       val: fmtDelta(result.fuelChange), bad: result.fuelChange, base: `${result.baselineFuel.toLocaleString()} t` },
                  { label: "Cost Change",       val: fmtDelta(result.costChange), bad: result.costChange, base: `$${result.baselineCost}M` },
                  { label: "GHG Change",        val: fmtDelta(result.ghgChange),  bad: result.ghgChange,  base: `${result.baselineGhg.toLocaleString()} kgCO₂` },
                  { label: "Cargo Fulfillment", val: result.cargoFulfillment == null ? "Unavailable" : `${result.cargoFulfillment.toFixed(1)}%`, bad: null, base: "not computed by optimizer" },
                ].map(k => {
                  const col = deltaColor(k.bad);
                  return (
                    <div key={k.label} style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 9, padding: "16px 18px" }}>
                      <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{k.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: col, fontFamily: "'JetBrains Mono', monospace" }}>{k.val}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>vs {k.base}</div>
                    </div>
                  );
                })}
              </div>

              {/* Baseline vs Scenario table */}
              <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, padding: "18px 20px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans', sans-serif", marginBottom: 14 }}>
                  Baseline vs Scenario ({result.scenarioSolutionId})
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["Metric", "Baseline", "Scenario Result", "Change"].map(h => (
                        <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { metric: "Fuel Consumption", base: `${result.baselineFuel.toLocaleString()} t`, scenario: `${result.scenarioFuel.toLocaleString()} t`, delta: result.fuelChange },
                      { metric: "Operating Cost",   base: `$${result.baselineCost}M`,   scenario: `$${result.scenarioCost}M`,                      delta: result.costChange },
                      { metric: "Lifecycle GHG",    base: `${result.baselineGhg.toLocaleString()} kgCO₂`, scenario: `${result.scenarioGhg.toLocaleString()} kgCO₂`, delta: result.ghgChange },
                      { metric: "Cargo Fulfillment", base: "Unavailable", scenario: result.cargoFulfillment == null ? "Unavailable" : `${result.cargoFulfillment.toFixed(1)}%`, delta: null },
                    ].map((row, i) => (
                      <tr key={row.metric} style={{ background: i % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "10px 12px", color: "#475569" }}>{row.metric}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", color: "#64748B" }}>{row.base}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#0F172A" }}>{row.scenario}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: deltaColor(row.delta) }}>
                          {fmtDelta(row.delta)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Constraint changes */}
              <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 10 }}>Constraint & Feasibility Impact</div>
                {result.constraintChanges.map((msg, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, padding: "8px 10px", background: "#FFFBEB", borderRadius: 6, border: "1px solid #FDE68A", marginBottom: 6 }}>
                    <span style={{ fontSize: 14 }}>⚠</span>
                    <span style={{ fontSize: 12, color: "#78350F" }}>{msg}</span>
                  </div>
                ))}
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 8 }}>
                  Scenario outputs are from an actual optimizer rerun with these controls mapped to candidate-generation and feasibility parameters.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
