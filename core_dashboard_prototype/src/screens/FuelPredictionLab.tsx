import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFleetData, useFuelPrediction } from "../api/hooks";
import type { FuelPredictionRequest, Route } from "../api/types";
import { buildHistoryChart, formatSignedPercent, seaStateForWave } from "../lib/fuelPrediction";


const CARD: React.CSSProperties = {
  background: "var(--gf-card)",
  border: "1px solid var(--gf-line)",
  borderRadius: 10,
  boxShadow: "0 8px 28px rgba(1, 18, 24, 0.08)",
};

const LABEL: React.CSSProperties = {
  color: "var(--gf-muted)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  height: 34,
  padding: "0 10px",
  color: "var(--gf-ink)",
  background: "var(--gf-row-alt)",
  border: "1px solid var(--gf-line)",
  borderRadius: 6,
  font: "500 11px 'Instrument Sans', sans-serif",
  outline: "none",
};

function displayPort(value: string): string {
  return value.trim().replace("Yohohama", "Yokohama");
}

function routeEnds(route: Route): { origin: string; destination: string } {
  if (route.origin && route.destination) return { origin: route.origin, destination: route.destination };
  const [origin = "", destination = ""] = route.name.split(" to ");
  return { origin, destination };
}

function SectionTitle({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
      <div>
        <div style={LABEL}>{eyebrow}</div>
        <h2 style={{ margin: "3px 0 0", color: "var(--gf-ink)", fontSize: 15, letterSpacing: "-0.02em" }}>{title}</h2>
      </div>
      {aside}
    </div>
  );
}

function SelectField({ label, value, onChange, children }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={LABEL}>{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} style={INPUT}>
        {children}
      </select>
    </label>
  );
}

function SliderField({ label, value, unit, min, max, step, onChange, hint }: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={LABEL}>{label}</span>
        <span style={{ color: "var(--gf-ink)", font: "600 11px 'JetBrains Mono', monospace" }}>{value.toFixed(step < 1 ? 1 : 0)} {unit}</span>
      </span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} aria-label={label} />
      {hint && <span style={{ color: "var(--gf-faint)", fontSize: 9.5, lineHeight: 1.35 }}>{hint}</span>}
    </label>
  );
}

function HistoryChart({ history }: { history: Array<{ sample: number; actual: number; predicted: number }> }) {
  const width = 620;
  const height = 220;
  const geometry = buildHistoryChart(history, width, height);
  const actualPoints = geometry.actual.map(point => point.join(",")).join(" ");
  const predictedPoints = geometry.predicted.map(point => point.join(",")).join(" ");
  const [minimum, maximum] = geometry.domain;
  const ticks = [0, 1, 2, 3].map(index => ({
    y: 24 + index * (height - 48) / 3,
    value: maximum - index * (maximum - minimum) / 3,
  }));

  return (
    <div style={{ width: "100%", minHeight: 220 }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Actual versus predicted fuel consumption validation samples" style={{ width: "100%", height: 220, display: "block" }}>
        <defs>
          <linearGradient id="predictionFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map(tick => (
          <g key={tick.y}>
            <line x1="24" x2={width - 24} y1={tick.y} y2={tick.y} stroke="var(--gf-grid)" strokeWidth="1" />
            <text x="20" y={tick.y + 3} textAnchor="end" fill="var(--gf-faint)" fontSize="8" fontFamily="JetBrains Mono">{tick.value.toFixed(0)}</text>
          </g>
        ))}
        {geometry.predicted.length > 1 && (
          <polygon points={`24,${height - 24} ${predictedPoints} ${width - 24},${height - 24}`} fill="url(#predictionFill)" />
        )}
        <polyline points={predictedPoints} fill="none" stroke="#2DD4BF" strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={actualPoints} fill="none" stroke="#F4C95D" strokeWidth="1.6" strokeDasharray="4 4" strokeLinejoin="round" />
        {geometry.predicted.map((point, index) => <circle key={`pred-${index}`} cx={point[0]} cy={point[1]} r="3.5" fill="#2DD4BF" stroke="var(--gf-card)" strokeWidth="2" />)}
        {geometry.actual.map((point, index) => <circle key={`actual-${index}`} cx={point[0]} cy={point[1]} r="3" fill="#F4C95D" stroke="var(--gf-card)" strokeWidth="1.5" />)}
        {history.map((point, index) => <text key={point.sample} x={geometry.actual[index]?.[0]} y={height - 7} textAnchor="middle" fill="var(--gf-faint)" fontSize="8" fontFamily="JetBrains Mono">{point.sample}</text>)}
      </svg>
    </div>
  );
}

function VoyageMetric({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return (
    <div style={{ ...CARD, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: "0 auto 0 0", width: 3, background: color }} />
      <div style={LABEL}>{label}</div>
      <div style={{ marginTop: 7, color: "var(--gf-ink)", font: "700 21px 'JetBrains Mono', monospace", letterSpacing: "-0.05em" }}>{value}</div>
      <div style={{ marginTop: 4, color: "var(--gf-muted)", fontSize: 10 }}>{detail}</div>
    </div>
  );
}

export default function FuelPredictionLab() {
  const { vessels, routes, loading: fleetLoading, error: fleetError } = useFleetData();
  const { result, loading, error, predict } = useFuelPrediction();
  const [vesselType, setVesselType] = useState("Bulk Carrier");
  const [routeId, setRouteId] = useState("");
  const [speed, setSpeed] = useState(17.5);
  const [draft, setDraft] = useState(9.2);
  const [cargoLoad, setCargoLoad] = useState(82);
  const [wind, setWind] = useState(18);
  const [wave, setWave] = useState(2.4);
  const [current, setCurrent] = useState(0.8);
  const [fuel, setFuel] = useState<"DM" | "RM380">("RM380");
  const [hullPenalty, setHullPenalty] = useState(8);
  const initialized = useRef(false);

  useEffect(() => {
    if (routeId || routes.length === 0) return;
    const preferred = routes.find(route => {
      const ends = routeEnds(route);
      return ends.origin.trim() === "Yohohama" && ends.destination.trim() === "Singapore";
    });
    setRouteId((preferred ?? routes[0]).id);
  }, [routeId, routes]);

  const selectedRoute = routes.find(route => route.id === routeId) ?? null;
  const seaState = seaStateForWave(wave);

  const runPrediction = useCallback(async () => {
    if (!selectedRoute) return;
    const ends = routeEnds(selectedRoute);
    const request: FuelPredictionRequest = {
      vessel_type: vesselType,
      origin: ends.origin.trim(),
      destination: ends.destination.trim(),
      speed_knots: speed,
      draft_m: draft,
      cargo_load_pct: cargoLoad,
      wind_speed_knots: wind,
      wave_height_m: wave,
      current_speed_knots: current,
      sea_state: seaState,
      fuel_type: fuel,
      hull_condition_pct: hullPenalty,
    };
    await predict(request);
  }, [cargoLoad, current, draft, fuel, hullPenalty, predict, seaState, selectedRoute, speed, vesselType, wave, wind]);

  useEffect(() => {
    if (!selectedRoute || initialized.current) return;
    initialized.current = true;
    void runPrediction();
  }, [runPrediction, selectedRoute]);

  const routeLabel = selectedRoute
    ? `${displayPort(routeEnds(selectedRoute).origin)} → ${displayPort(routeEnds(selectedRoute).destination)}`
    : "Select route";

  return (
    <div style={{ padding: 14, minHeight: "100%", color: "var(--gf-ink)" }}>
      <section style={{ ...CARD, marginBottom: 12, padding: "15px 18px", background: "linear-gradient(120deg, var(--gf-card) 0%, var(--gf-teal-soft) 100%)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, display: "grid", placeItems: "center", color: "#d9fffa", background: "linear-gradient(145deg, #087f7b, #075b68)", boxShadow: "0 7px 18px rgba(8,127,123,.22)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 18c3-1 5-1 8 0s5 1 8 0"/><path d="M7 14l2-7h6l2 7M10 7V4h4v3"/><path d="M3 21h18"/></svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 18, letterSpacing: "-0.03em" }}>Fuel Prediction Lab</h1>
              <span style={{ padding: "2px 6px", borderRadius: 4, color: "#087f7b", background: "var(--gf-teal-soft)", border: "1px solid #bce5df", font: "700 8px 'JetBrains Mono', monospace" }}>XGBOOST</span>
            </div>
            <div style={{ marginTop: 3, color: "var(--gf-muted)", fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Model-backed consumption forecasting across vessel, route and operating conditions.</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={{ ...LABEL, padding: "5px 8px", color: "#087f7b", background: "var(--gf-teal-soft)", border: "1px solid #bce5df", borderRadius: 5 }}>Model R² {result?.model.test_r2.toFixed(3) ?? "0.970"}</span>
          <span style={{ ...LABEL, padding: "5px 8px", color: "var(--gf-muted)", background: "var(--gf-row-alt)", border: "1px solid var(--gf-line)", borderRadius: 5 }}>{routeLabel}</span>
        </div>
      </section>

      <div className="fuel-lab-grid">
        <aside style={{ ...CARD, padding: 16, alignSelf: "start" }}>
          <SectionTitle eyebrow="Scenario inputs" title="Operating conditions" aside={<span style={{ color: "var(--gf-faint)", font: "500 9px 'JetBrains Mono'" }}>8 variables</span>} />
          <div style={{ display: "grid", gap: 14 }}>
            <SelectField label="Vessel class" value={vesselType} onChange={setVesselType}>
              {vessels.map(vessel => <option key={vessel.id} value={vessel.type}>{vessel.type}</option>)}
            </SelectField>
            <SelectField label="Route" value={routeId} onChange={setRouteId}>
              {routes.map(route => {
                const ends = routeEnds(route);
                return <option key={route.id} value={route.id}>{displayPort(ends.origin)} → {displayPort(ends.destination)} · {route.distanceNm.toLocaleString()} nm</option>;
              })}
            </SelectField>

            <div style={{ height: 1, background: "var(--gf-line)", margin: "1px 0" }} />
            <SliderField label="Speed" value={speed} unit="kn" min={8} max={25} step={0.1} onChange={setSpeed} hint={speed > 12.1 ? "Above training range; V³ extrapolation will be disclosed." : undefined} />
            <SliderField label="Draft" value={draft} unit="m" min={5} max={16} step={0.1} onChange={setDraft} hint="Planning adjustment · not an XGBoost input" />
            <SliderField label="Cargo load" value={cargoLoad} unit="%" min={20} max={100} step={1} onChange={setCargoLoad} hint="Planning adjustment · 70% reference load" />
            <SliderField label="Wind" value={wind} unit="kn" min={0} max={45} step={1} onChange={setWind} />
            <SliderField label="Wave height" value={wave} unit="m" min={0} max={8} step={0.1} onChange={setWave} hint={`Derived sea state: ${seaState}`} />
            <SliderField label="Ocean current" value={current} unit="kn" min={-3} max={3} step={0.1} onChange={setCurrent} hint="Positive values indicate an aiding current." />
            <SliderField label="Hull condition penalty" value={hullPenalty} unit="%" min={0} max={20} step={1} onChange={setHullPenalty} hint="Planning adjustment · clean hull = 0%" />
            <SelectField label="Fuel grade" value={fuel} onChange={value => setFuel(value as "DM" | "RM380")}>
              <option value="RM380">RM380 · residual marine fuel</option>
              <option value="DM">DM · distillate marine fuel</option>
            </SelectField>

            <button onClick={() => void runPrediction()} disabled={loading || fleetLoading || !selectedRoute} style={{ height: 40, border: 0, borderRadius: 6, cursor: loading ? "wait" : "pointer", color: "#effffc", background: loading ? "#6d8e90" : "linear-gradient(135deg, #0b9188, #087f7b)", boxShadow: "0 7px 18px rgba(8,127,123,.2)", font: "700 11px 'Instrument Sans', sans-serif", letterSpacing: ".02em" }}>
              {loading ? "RUNNING MODEL…" : "RUN FUEL PREDICTION"}
            </button>
          </div>
          {(error || fleetError) && <div role="alert" style={{ marginTop: 10, padding: 9, color: "#FCA5A5", background: "var(--gf-red-soft)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 6, fontSize: 10, lineHeight: 1.5 }}>{error ?? fleetError}</div>}
        </aside>

        <div style={{ display: "grid", alignContent: "start", gap: 12, minWidth: 0 }}>
          <div className="fuel-result-grid">
            <section style={{ ...CARD, padding: 18, minHeight: 245, position: "relative", overflow: "hidden", background: "var(--gf-prediction-bg)", borderColor: "var(--gf-prediction-border)", color: "var(--gf-ink)" }}>
              <div style={{ position: "absolute", width: 190, height: 190, borderRadius: "50%", right: -45, top: -75, background: "radial-gradient(circle, rgba(8,127,123,.13), rgba(8,127,123,0) 68%)" }} />
              <div style={{ color: "var(--gf-prediction-eyebrow)", fontSize: 9.5, fontWeight: 700, letterSpacing: ".14em" }}>PREDICTED CONSUMPTION</div>
              {result ? (
                <>
                  <div style={{ marginTop: 23, display: "flex", alignItems: "baseline", gap: 9 }}>
                    <span style={{ font: "700 43px 'JetBrains Mono', monospace", letterSpacing: "-.08em" }}>{result.prediction.consumption_tonnes_per_day.toFixed(1)}</span>
                    <span style={{ color: "var(--gf-prediction-unit)", font: "600 13px 'JetBrains Mono', monospace" }}>t/day</span>
                  </div>
                  <div style={{ marginTop: 5, color: "var(--gf-prediction-subtle)", font: "500 11px 'JetBrains Mono', monospace" }}>± {result.prediction.uncertainty_tonnes_per_day.toFixed(1)} t/day · 95% interval</div>
                  <div style={{ marginTop: 26 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--gf-prediction-subtle)", fontSize: 10 }}><span>Model confidence</span><strong style={{ color: "#2dd4bf", fontFamily: "JetBrains Mono" }}>{result.prediction.confidence_pct}%</strong></div>
                    <div style={{ marginTop: 7, height: 5, background: "var(--gf-prediction-track)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${result.prediction.confidence_pct}%`, height: "100%", background: "linear-gradient(90deg, #0b9188, #2dd4bf)" }} /></div>
                  </div>
                  <div style={{ marginTop: 15, paddingTop: 12, borderTop: "1px solid var(--gf-prediction-divider)", display: "flex", justifyContent: "space-between", gap: 12, color: "var(--gf-prediction-subtle)", fontSize: 9.5 }}>
                    <span>Range {result.prediction.lower_tonnes_per_day.toFixed(1)}–{result.prediction.upper_tonnes_per_day.toFixed(1)} t/day</span>
                    <span>{result.model.speed_extrapolation_applied ? "V³ speed extrapolation" : "Within model range"}</span>
                  </div>
                </>
              ) : <div style={{ minHeight: 175, display: "grid", placeItems: "center", color: "var(--gf-prediction-subtle)", fontSize: 11 }}>{loading ? "Evaluating operating conditions…" : "Run a scenario to generate a prediction"}</div>}
            </section>

            <section style={{ ...CARD, padding: 18, minHeight: 245 }}>
              <SectionTitle eyebrow="Driver analysis" title="Prediction breakdown" aside={<span title="Model effects are counterfactual XGBoost deltas; planning adjustments are explicit post-model factors." style={{ width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center", border: "1px solid var(--gf-line)", color: "var(--gf-muted)", fontSize: 10, cursor: "help" }}>?</span>} />
              <div style={{ display: "grid", gap: 11 }}>
                {(result?.breakdown ?? []).map(item => {
                  const magnitude = Math.min(100, Math.abs(item.percent) * 3.6);
                  const positive = item.percent >= 0;
                  return (
                    <div key={item.key}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                        <span style={{ flex: 1, color: "var(--gf-ink)", fontSize: 10.5, fontWeight: 600 }}>{item.label}</span>
                        <span style={{ padding: "1px 5px", borderRadius: 3, color: item.source === "xgboost" ? "#2DD4BF" : "#F4C95D", background: item.source === "xgboost" ? "rgba(45,212,191,.08)" : "rgba(244,201,93,.08)", font: "700 7.5px 'JetBrains Mono', monospace" }}>{item.source === "xgboost" ? "MODEL" : "PLANNING"}</span>
                        <span style={{ width: 48, textAlign: "right", color: positive ? "#E89E45" : "#2DD4BF", font: "600 10.5px 'JetBrains Mono', monospace" }}>{formatSignedPercent(item.percent)}</span>
                      </div>
                      <div style={{ height: 4, background: "var(--gf-grid)", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${magnitude}%`, height: "100%", borderRadius: 4, background: positive ? "#E89E45" : "#2DD4BF" }} /></div>
                    </div>
                  );
                })}
                {!result && <div style={{ minHeight: 168, display: "grid", placeItems: "center", color: "var(--gf-faint)", fontSize: 10 }}>Driver effects appear after prediction.</div>}
              </div>
            </section>
          </div>

          <div className="fuel-metrics-grid">
            <VoyageMetric label="Predicted voyage fuel" value={result ? `${result.voyage.fuel_tonnes.toLocaleString()} t` : "—"} detail={result ? `${result.voyage.duration_days.toFixed(1)} days at ${speed.toFixed(1)} kn` : "Awaiting model run"} color="#2DD4BF" />
            <VoyageMetric label="Predicted CO₂e" value={result ? `${result.voyage.co2e_tonnes.toLocaleString()} t` : "—"} detail={`${fuel} emission factor`} color="#60A5FA" />
            <VoyageMetric label="Predicted fuel cost" value={result ? `$${result.voyage.cost_usd.toLocaleString()}` : "—"} detail={`${fuel} scenario bunker price`} color="#F4C95D" />
          </div>

          <section style={{ ...CARD, padding: "16px 18px 12px" }}>
            <SectionTitle eyebrow="Validation view" title="Actual vs predicted fuel consumption" aside={
              <div style={{ display: "flex", gap: 13, alignItems: "center", color: "var(--gf-muted)", fontSize: 9 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><i style={{ width: 13, height: 2, display: "inline-block", background: "#F4C95D" }} />Actual</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><i style={{ width: 13, height: 2, display: "inline-block", background: "#2DD4BF" }} />Predicted</span>
              </div>
            } />
            {result ? <HistoryChart history={result.history} /> : <div style={{ height: 220, display: "grid", placeItems: "center", color: "var(--gf-faint)", fontSize: 10 }}>Validation data appears after prediction.</div>}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 2px 0", borderTop: "1px solid var(--gf-line)", color: "var(--gf-faint)", fontSize: 9, lineHeight: 1.45 }}>
              <span>Six reference telemetry samples · daily equivalent</span>
              <span style={{ textAlign: "right", maxWidth: 520 }}>{result?.model.history_note ?? "Source telemetry has no voyage IDs."}</span>
            </div>
          </section>

          {result && (
            <section style={{ ...CARD, padding: "11px 14px", display: "flex", alignItems: "flex-start", gap: 9, color: "var(--gf-muted)", fontSize: 9.5, lineHeight: 1.5 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.8" style={{ flex: "0 0 auto", marginTop: 1 }}><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>
              <span><strong style={{ color: "var(--gf-ink)" }}>Methodology note.</strong> {result.model.unit_assumption} Draft, cargo load and hull condition are visibly tagged planning adjustments because they were excluded from model training.</span>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
