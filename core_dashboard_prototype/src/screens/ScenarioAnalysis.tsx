import React, { useState } from "react";
import { useScenario } from "../api/hooks";
import type { ScenarioControls } from "../api/types";

interface Props {
  onGoToFleetPlan: () => void;
}

const PRESETS = [
  { id: "p1", label: "Increased Cargo Demand (+20%)",      changes: { demand: 120, fuel: 100, ghg: 100, deadline: 100, vessels: 100, fuelAvail: 100, portCap: 100 } },
  { id: "p2", label: "Reduced Vessel Availability (-20%)", changes: { demand: 100, fuel: 100, ghg: 100, deadline: 100, vessels: 80,  fuelAvail: 100, portCap: 100 } },
  { id: "p3", label: "Stricter GHG Limit (-15%)",          changes: { demand: 100, fuel: 100, ghg: 85,  deadline: 100, vessels: 100, fuelAvail: 100, portCap: 100 } },
  { id: "p4", label: "Higher Fuel Price (+40%)",            changes: { demand: 100, fuel: 140, ghg: 100, deadline: 100, vessels: 100, fuelAvail: 100, portCap: 100 } },
  { id: "p5", label: "Port Capacity Restriction (-25%)",   changes: { demand: 100, fuel: 100, ghg: 100, deadline: 100, vessels: 100, fuelAvail: 100, portCap: 75  } },
];

interface SliderProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}

function Slider({ label, description, value, min, max, unit, onChange }: SliderProps) {
  const isModified = value !== 100;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--gf-ink)", fontWeight: 600 }}>{label}</span>
          {isModified && (
            <span style={{
              fontSize: 10,
              padding: "1px 5px",
              borderRadius: 4,
              background: "rgba(14, 165, 233, 0.15)",
              color: "#38BDF8",
              fontWeight: 600,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {value > 100 ? `+${value - 100}%` : `${value - 100}%`}
            </span>
          )}
        </div>
        <span style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: "var(--gf-ink)",
          fontFamily: "'JetBrains Mono', monospace",
          background: "var(--gf-teal-soft)",
          border: "1px solid var(--gf-line)",
          padding: "2px 8px",
          borderRadius: 5,
        }}>
          {value}{unit}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--gf-muted)", marginBottom: 6 }}>
        {description}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", height: 5, accentColor: "#0D9488", cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--gf-muted)", marginTop: 4, fontWeight: 500 }}>
        <span>Min {min}{unit}</span>
        <span>Max {max}{unit}</span>
      </div>
    </div>
  );
}

export default function ScenarioAnalysis({ onGoToFleetPlan }: Props) {
  const [controls, setControls] = useState<ScenarioControls>({
    demand: 100, fuel: 100, ghg: 100, deadline: 100, vessels: 100, fuelAvail: 100, portCap: 100
  });
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
  const deltaColor = (v: number | null, higherIsBad = true) => {
    if (v == null || v === 0) return "var(--gf-muted)";
    if (higherIsBad) {
      return v > 0 ? "#EF4444" : "#10B981";
    }
    return v > 0 ? "#10B981" : "#EF4444";
  };

  const deltaBg = (v: number | null, higherIsBad = true) => {
    if (v == null || v === 0) return "rgba(148, 163, 184, 0.12)";
    if (higherIsBad) {
      return v > 0 ? "rgba(239, 68, 68, 0.12)" : "rgba(16, 185, 129, 0.12)";
    }
    return v > 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)";
  };

  return (
    <div style={{ padding: "24px 28px", overflowY: "auto", height: "100%", background: "var(--gf-canvas)" }}>

      {/* Top Header Navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={onGoToFleetPlan}
            style={{
              background: "var(--gf-card)",
              border: "1px solid var(--gf-line-medium)",
              borderRadius: 7,
              padding: "7px 14px",
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--gf-ink)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#0D9488"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gf-line-medium)"; }}
          >
            ← Back to Fleet Plan
          </button>
          <span style={{ fontSize: 13, color: "var(--gf-muted)" }}>
            Evaluate sensitivity & stress-test the deployment plan with real-time optimization.
          </span>
        </div>

        {error && (
          <div style={{
            fontSize: 12,
            color: "#EF4444",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            padding: "5px 12px",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}>
            <span>⚠ API status:</span>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Example Presets Bar */}
      <div style={{
        background: "var(--gf-card)",
        border: "1px solid var(--gf-line)",
        borderRadius: 10,
        padding: "14px 18px",
        marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--gf-ink)" }}>Example Operational Presets</span>
            <span style={{
              fontSize: 10,
              padding: "2px 7px",
              borderRadius: 10,
              background: "var(--gf-teal-soft)",
              color: "var(--gf-ink)",
              fontWeight: 600,
            }}>
              Quick Stress Tests
            </span>
          </div>
          {activePreset && (
            <button
              onClick={reset}
              style={{
                background: "none",
                border: "none",
                color: "#0EA5E9",
                fontSize: 12,
                cursor: "pointer",
                padding: "2px 6px",
                fontWeight: 600,
              }}
            >
              Reset to 100%
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {PRESETS.map(p => {
            const isSelected = activePreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                style={{
                  padding: "7px 14px",
                  fontSize: 12,
                  borderRadius: 7,
                  border: isSelected ? "1.5px solid #0D9488" : "1px solid var(--gf-line)",
                  background: isSelected ? "var(--gf-teal-soft)" : "var(--gf-card)",
                  color: isSelected ? "#0D9488" : "var(--gf-ink)",
                  cursor: "pointer",
                  fontWeight: isSelected ? 700 : 500,
                  boxShadow: isSelected ? "0 0 10px rgba(13, 148, 136, 0.25)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {p.label}
              </button>
            );
          })}

          <button
            onClick={reset}
            style={{
              padding: "7px 14px",
              fontSize: 12,
              borderRadius: 7,
              border: "1px solid var(--gf-line)",
              background: "transparent",
              color: "var(--gf-muted)",
              cursor: "pointer",
              fontWeight: 500,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gf-line-medium)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--gf-ink)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gf-line)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--gf-muted)";
            }}
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Main Two-Column Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20, alignItems: "start" }}>

        {/* Left Column: Controls Card */}
        <div style={{
          background: "var(--gf-card)",
          border: "1px solid var(--gf-line)",
          borderRadius: 12,
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, borderBottom: "1px solid var(--gf-line)", paddingBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gf-ink)" }}>Scenario Controls</div>
              <div style={{ fontSize: 11.5, color: "var(--gf-muted)", marginTop: 2 }}>Adjust levers to re-solve constraints</div>
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              padding: "3px 8px",
              borderRadius: 5,
              background: "var(--gf-teal-soft)",
              color: "var(--gf-ink)",
            }}>
              7 LEVERS
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <Slider
              label="Cargo Demand"
              description="Port pair aggregate cargo load volume factor"
              value={controls.demand}
              min={60}
              max={150}
              unit="%"
              onChange={v => { setControls(c => ({ ...c, demand: v })); setActivePreset(null); }}
            />
            <Slider
              label="Fuel Price Index"
              description="Global marine bunker price relative to baseline"
              value={controls.fuel}
              min={60}
              max={200}
              unit="%"
              onChange={v => { setControls(c => ({ ...c, fuel: v })); setActivePreset(null); }}
            />
            <Slider
              label="GHG Regulatory Limit"
              description="IMO / FuelEU emissions compliance ceiling"
              value={controls.ghg}
              min={60}
              max={120}
              unit="%"
              onChange={v => { setControls(c => ({ ...c, ghg: v })); setActivePreset(null); }}
            />
            <Slider
              label="Delivery Deadline"
              description="Voyage schedule buffer & transit allowance"
              value={controls.deadline}
              min={70}
              max={130}
              unit="%"
              onChange={v => { setControls(c => ({ ...c, deadline: v })); setActivePreset(null); }}
            />
            <Slider
              label="Available Vessels"
              description="Operating fleet availability percentage"
              value={controls.vessels}
              min={50}
              max={100}
              unit="%"
              onChange={v => { setControls(c => ({ ...c, vessels: v })); setActivePreset(null); }}
            />
            <Slider
              label="Fuel Availability"
              description="Alternative bunkering access across route ports"
              value={controls.fuelAvail}
              min={50}
              max={100}
              unit="%"
              onChange={v => { setControls(c => ({ ...c, fuelAvail: v })); setActivePreset(null); }}
            />
            <Slider
              label="Port Capacity"
              description="Berth throughput & harbor turnaround allowance"
              value={controls.portCap}
              min={50}
              max={100}
              unit="%"
              onChange={v => { setControls(c => ({ ...c, portCap: v })); setActivePreset(null); }}
            />
          </div>

          <div style={{ marginTop: 12, paddingTop: 14, borderTop: "1px solid var(--gf-line)" }}>
            <button
              onClick={runScenario}
              disabled={loading}
              style={{
                width: "100%",
                background: loading
                  ? "var(--gf-line-medium)"
                  : "linear-gradient(135deg, #0284C7 0%, #0D9488 100%)",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                padding: "12px 18px",
                fontSize: 14,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                boxShadow: loading ? "none" : "0 4px 14px rgba(2, 132, 199, 0.35)",
                transition: "transform 0.1s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
            >
              {loading ? (
                <>
                  <span style={{
                    display: "inline-block",
                    width: 15,
                    height: 15,
                    border: "2px solid #FFFFFF",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "gfSpin 0.75s linear infinite"
                  }} />
                  Re-optimizing Fleet Plan...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Run Scenario Analysis
                </>
              )}
            </button>
          </div>
          <style>{`@keyframes gfSpin { to { transform: rotate(360deg); } }`}</style>
        </div>

        {/* Right Column: Results or State */}
        <div>
          {!ran && !loading ? (
            /* Initial / Ready State */
            <div style={{
              background: "var(--gf-card)",
              border: "1px solid var(--gf-line)",
              borderRadius: 12,
              padding: "48px 36px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                background: "var(--gf-teal-soft)",
                border: "1px solid var(--gf-line-medium)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 18,
                color: "#0D9488",
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </div>

              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--gf-ink)", marginBottom: 8 }}>
                Ready to Simulate What-If Scenarios
              </div>

              <div style={{ fontSize: 13.5, color: "var(--gf-muted)", maxWidth: 520, lineHeight: 1.6, marginBottom: 28 }}>
                Adjust operational levers on the left or select an example preset to stress-test your maritime fleet plan against varying demand, fuel bunker pricing, emissions caps, and port capacity restrictions.
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
                width: "100%",
                maxWidth: 680,
                textAlign: "left",
                marginBottom: 28,
              }}>
                {[
                  {
                    title: "Fuel & Bunkering Impact",
                    desc: "Evaluates exact XGBoost fuel prediction model deltas across all assigned vessels.",
                    icon: "⚓",
                  },
                  {
                    title: "Financial Cost Variance",
                    desc: "Calculates total OPEX changes against the baseline plan in millions ($M).",
                    icon: "💵",
                  },
                  {
                    title: "Emissions & Carbon Limits",
                    desc: "Simulates lifecycle GHG (kgCO₂eq) and FuelEU/IMO regulatory compliance.",
                    icon: "🌱",
                  },
                  {
                    title: "Feasibility & Deadlines",
                    desc: "Validates berth capacity, speed limits, draft constraints, and schedule buffers.",
                    icon: "⏱",
                  },
                ].map((item, idx) => (
                  <div key={idx} style={{
                    background: "var(--gf-row-alt)",
                    border: "1px solid var(--gf-line)",
                    borderRadius: 9,
                    padding: "14px 16px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>{item.icon}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--gf-ink)" }}>{item.title}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--gf-muted)", lineHeight: 1.5 }}>
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={runScenario}
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0D9488 100%)",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 22px",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 4px 12px rgba(2, 132, 199, 0.3)",
                }}
              >
                <span>▶ Run Current Simulation</span>
              </button>
            </div>
          ) : loading ? (
            /* Computing State */
            <div style={{
              background: "var(--gf-card)",
              border: "1px solid var(--gf-line)",
              borderRadius: 12,
              padding: "60px 24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <div style={{
                width: 48,
                height: 48,
                border: "3px solid var(--gf-line)",
                borderTopColor: "#0D9488",
                borderRadius: "50%",
                animation: "gfSpin 0.75s linear infinite",
                marginBottom: 18,
              }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gf-ink)", marginBottom: 6 }}>
                Computing Mathematical Scenario Optimization...
              </div>
              <div style={{ fontSize: 13, color: "var(--gf-muted)", maxWidth: 420 }}>
                Evaluating XGBoost fuel consumption, generating candidates, and resolving multi-objective Pareto trade-offs via live API.
              </div>
            </div>
          ) : result && (
            /* Results State */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Scenario result KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                {[
                  {
                    label: "Fuel Consumption",
                    val: fmtDelta(result.fuelChange),
                    num: result.fuelChange,
                    higherIsBad: true,
                    scenarioVal: `${result.scenarioFuel.toLocaleString()} t`,
                    base: `${result.baselineFuel.toLocaleString()} t`,
                  },
                  {
                    label: "Operating Cost",
                    val: fmtDelta(result.costChange),
                    num: result.costChange,
                    higherIsBad: true,
                    scenarioVal: `$${result.scenarioCost}M`,
                    base: `$${result.baselineCost}M`,
                  },
                  {
                    label: "Lifecycle GHG",
                    val: fmtDelta(result.ghgChange),
                    num: result.ghgChange,
                    higherIsBad: true,
                    scenarioVal: `${result.scenarioGhg.toLocaleString()} kgCO₂`,
                    base: `${result.baselineGhg.toLocaleString()} kgCO₂`,
                  },
                  {
                    label: "Cargo Fulfillment",
                    val: result.cargoFulfillment == null ? "100.0%" : `${result.cargoFulfillment.toFixed(1)}%`,
                    num: 0,
                    higherIsBad: false,
                    scenarioVal: result.cargoFulfillment == null ? "Assigned" : `${result.cargoFulfillment.toFixed(1)}%`,
                    base: "Baseline target",
                  },
                ].map(k => {
                  const textColor = deltaColor(k.num, k.higherIsBad);
                  const bgColor = deltaBg(k.num, k.higherIsBad);
                  return (
                    <div
                      key={k.label}
                      style={{
                        background: "var(--gf-card)",
                        border: "1px solid var(--gf-line)",
                        borderRadius: 10,
                        padding: "16px 18px",
                      }}
                    >
                      <div style={{ fontSize: 10.5, color: "var(--gf-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, marginBottom: 8 }}>
                        {k.label}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 22, fontWeight: 800, color: "var(--gf-ink)", fontFamily: "'JetBrains Mono', monospace" }}>
                          {k.scenarioVal}
                        </span>
                        <span style={{
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 5,
                          background: bgColor,
                          color: textColor,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {k.val}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--gf-muted)" }}>
                        Baseline: {k.base}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Baseline vs Scenario table */}
              <div style={{
                background: "var(--gf-card)",
                border: "1px solid var(--gf-line)",
                borderRadius: 12,
                overflow: "hidden",
              }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gf-line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gf-ink)" }}>
                    Baseline vs Scenario Detailed Impact ({result.scenarioSolutionId})
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: "var(--gf-muted)",
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "var(--gf-row-alt)",
                  }}>
                    LIVE SOLVER OUTPUT
                  </span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "var(--gf-row-alt)", borderBottom: "1px solid var(--gf-line)" }}>
                      {["Metric", "Baseline Plan", "Scenario Simulation", "Net Variance"].map(h => (
                        <th key={h} style={{
                          padding: "11px 16px",
                          textAlign: "left",
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: "var(--gf-muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { metric: "Fuel Consumption", base: `${result.baselineFuel.toLocaleString()} t`, scenario: `${result.scenarioFuel.toLocaleString()} t`, delta: result.fuelChange, higherIsBad: true },
                      { metric: "Operating Cost",   base: `$${result.baselineCost}M`,   scenario: `$${result.scenarioCost}M`, delta: result.costChange, higherIsBad: true },
                      { metric: "Lifecycle GHG",    base: `${result.baselineGhg.toLocaleString()} kgCO₂`, scenario: `${result.scenarioGhg.toLocaleString()} kgCO₂`, delta: result.ghgChange, higherIsBad: true },
                      { metric: "Cargo Fulfillment", base: "100%", scenario: result.cargoFulfillment == null ? "100%" : `${result.cargoFulfillment.toFixed(1)}%`, delta: null, higherIsBad: false },
                    ].map((row, i) => (
                      <tr key={row.metric} style={{
                        background: i % 2 === 0 ? "var(--gf-card)" : "var(--gf-row-alt)",
                        borderBottom: "1px solid var(--gf-line)",
                      }}>
                        <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--gf-ink)" }}>{row.metric}</td>
                        <td style={{ padding: "12px 16px", fontFamily: "'JetBrains Mono', monospace", color: "var(--gf-muted)" }}>{row.base}</td>
                        <td style={{ padding: "12px 16px", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "var(--gf-ink)" }}>{row.scenario}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: 4,
                            background: deltaBg(row.delta, row.higherIsBad),
                            color: deltaColor(row.delta, row.higherIsBad),
                            fontSize: 12,
                          }}>
                            {fmtDelta(row.delta)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Constraint changes / Advisory */}
              <div style={{
                background: "var(--gf-card)",
                border: "1px solid var(--gf-line)",
                borderRadius: 12,
                padding: "18px 20px",
              }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--gf-ink)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>Constraint & Feasibility Impact</span>
                  {result.constraintChanges.length > 0 && (
                    <span style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      background: "rgba(217, 119, 6, 0.15)",
                      color: "#F59E0B",
                      padding: "2px 7px",
                      borderRadius: 10,
                    }}>
                      {result.constraintChanges.length} Active Notes
                    </span>
                  )}
                </div>

                {result.constraintChanges.length === 0 ? (
                  <div style={{
                    padding: "10px 14px",
                    background: "rgba(16, 185, 129, 0.1)",
                    borderRadius: 8,
                    border: "1px solid rgba(16, 185, 129, 0.25)",
                    color: "#10B981",
                    fontSize: 12.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}>
                    <span>✓</span>
                    <span>All operational constraints satisfied under this scenario configuration.</span>
                  </div>
                ) : (
                  result.constraintChanges.map((msg, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        gap: 10,
                        padding: "10px 14px",
                        background: "rgba(217, 119, 6, 0.1)",
                        borderRadius: 8,
                        border: "1px solid rgba(217, 119, 6, 0.25)",
                        marginBottom: 8,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 15, color: "#F59E0B" }}>⚠</span>
                      <span style={{ fontSize: 12.5, color: "var(--gf-ink)", lineHeight: 1.4 }}>{msg}</span>
                    </div>
                  ))
                )}

                <div style={{ fontSize: 11.5, color: "var(--gf-muted)", marginTop: 10 }}>
                  Scenario outputs are computed via live constrained optimization re-run with candidate-generation, speed/fuel curves, and port limit enforcement.
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
