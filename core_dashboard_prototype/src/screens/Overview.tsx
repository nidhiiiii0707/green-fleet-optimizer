import React, { useState } from "react";
import WorldMap from "../components/WorldMap";
import VesselDrawer from "../components/VesselDrawer";
import { useFleetData, useLatestOptimization } from "../api/hooks";

interface Props {
  solutionId: string;
  onGoToOptimization: () => void;
}

// Design tokens
const T = {
  surface:    "#FFFFFF",
  border:     "#E4E2DE",
  borderMed:  "#CCC9C4",
  text:       "#1A1918",
  textSec:    "#6A6763",
  textTer:    "#9A9793",
  teal:       "#0A6C70",
  tealLight:  "#F0F9FA",
  green:      "#15803D",
  greenLight: "#F0FDF4",
  amber:      "#B45309",
};

function LoadingSkeleton({ height = 20, width = "100%" }: { height?: number; width?: string }) {
  return (
    <div style={{
      height, width, background: "linear-gradient(90deg, #E4E2DE 25%, #EEE 50%, #E4E2DE 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
      borderRadius: 3,
    }} />
  );
}

export default function Overview({ solutionId, onGoToOptimization }: Props) {
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: liveResult, loading, error } = useLatestOptimization();
  const { vessels, ports, routes, error: fleetError } = useFleetData();

  const paretoSolutions = liveResult?.pareto_solutions ?? [];
  const fuelMix = liveResult?.fuel_mix ?? [];
  const baseline = liveResult?.baseline;
  const optimized = paretoSolutions.find((solution) => solution.id === solutionId);
  const runId = liveResult?.run_id ?? "";
  const method = liveResult?.method ?? "";
  const feasibleCount = liveResult?.feasible_solutions ?? 0;
  const paretoCount = liveResult?.pareto_count ?? 0;

  const assignments = optimized?.assignments ?? [];
  const activeRouteIds = Array.from(new Set(assignments.map(a => a.routeId)));

  const KPI_DATA = [
    { label: "Total Fuel",      value: loading || !optimized ? null : `${optimized.fuel.toLocaleString()} model units`, delta: "", good: null, sub: optimized?.label ?? "" },
    { label: "Operating Cost",  value: loading || !optimized ? null : `$${optimized.cost.toFixed(3)}M`, delta: "", good: null, sub: optimized?.label ?? "" },
    { label: "Lifecycle GHG",   value: loading || !optimized ? null : `${optimized.ghg.toLocaleString()} kgCO₂`, delta: "", good: null, sub: optimized?.label ?? "" },
    { label: "Cargo Fulfil.",   value: loading || !optimized ? null : optimized.cargoFulfillment == null ? "Unavailable" : `${optimized.cargoFulfillment}%`, delta: "", good: null, sub: "not an optimizer objective" },
    { label: "Assignments",     value: loading ? null : `${optimized?.vessels ?? 0}`,                          delta: "",         good: null,  sub: "leg-level vessel classes" },
    { label: "Constraint Sat.", value: loading ? null : `${optimized?.constraintsSatisfied ?? 0} / ${optimized?.totalConstraints ?? 0}`, delta: "", good: null, sub: optimized?.label ?? "" },
  ];

  if (error || fleetError) return <div style={{ padding: 24, color: "#B91C1C" }}>Backend data unavailable: {error ?? fleetError}</div>;

  return (
    <div style={{ padding: "20px 24px", overflowY: "auto", height: "100%" }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {/* Run status bar */}
      <div style={{
        background: T.surface, border: `1px solid ${T.border}`,
        padding: "10px 18px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: loading ? T.amber : T.green }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: "'Instrument Sans', sans-serif" }}>
            {loading ? "Loading..." : `Optimization ${runId.toUpperCase()}`}
          </span>
          <span style={{ fontSize: 10, color: loading ? T.amber : T.green, fontFamily: "'JetBrains Mono', monospace", marginLeft: 2 }}>
            {loading ? "FETCHING" : "COMPLETED"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          {[
            ["Method", method],
            ["Feasible Solutions", String(feasibleCount)],
            ["Pareto-Optimal Plans", String(paretoCount)],
            ["Constraint Satisfaction", liveResult?.constraint_satisfaction ?? "unavailable"],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 9, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{k}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>
                {loading ? "—" : v}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onGoToOptimization}
          style={{
            marginLeft: "auto", background: T.teal, color: "white",
            border: "none", padding: "6px 14px",
            fontSize: 11, fontWeight: 600, cursor: "pointer",
            fontFamily: "'Instrument Sans', sans-serif", letterSpacing: "0.02em",
          }}
        >
          View Pareto Results →
        </button>
      </div>

      {/* KPI strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(6, 1fr)",
        background: T.surface, border: `1px solid ${T.border}`, marginBottom: 20,
      }}>
        {KPI_DATA.map((k, i) => (
          <div key={k.label} style={{
            padding: "14px 18px",
            borderLeft: i === 0 ? `3px solid ${T.teal}` : `1px solid ${T.border}`,
          }}>
            <div style={{ fontSize: 9, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5, fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: "'Instrument Sans', sans-serif", lineHeight: 1.1, marginBottom: 4 }}>
              {k.value === null ? <LoadingSkeleton height={22} width="80%" /> : k.value}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {k.delta && (
                <span style={{ fontSize: 10, fontWeight: 600, color: k.good ? T.green : T.amber, fontFamily: "'JetBrains Mono', monospace" }}>
                  {k.delta}
                </span>
              )}
              <span style={{ fontSize: 10, color: T.textTer }}>{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* World Map */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, marginBottom: 20, overflow: "hidden" }}>
        <div style={{
          padding: "11px 18px", borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: "'Instrument Sans', sans-serif" }}>
              Fleet & Route Visualization — {optimized?.label ?? "No solution selected"}
            </div>
            <div style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>
              {optimized?.routes ?? 0} active routes from real port/route coordinates · click a port to view details
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 10, color: T.textTer, fontFamily: "'JetBrains Mono', monospace" }}>
            <span>● Active route</span>
          </div>
        </div>
        <div style={{ height: 340 }}>
          <WorldMap
            ports={ports}
            routes={routes}
            highlightRouteIds={activeRouteIds}
            selectedPortId={selectedPortId}
            onPortClick={id => setSelectedPortId(id === selectedPortId ? null : id)}
            showAllRoutes={true}
          />
        </div>
      </div>

      {/* Baseline vs Optimized + Fuel Mix */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Baseline vs Optimized */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "16px 20px" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: "'Instrument Sans', sans-serif" }}>
              Baseline vs Optimized — {optimized?.label ?? "No solution selected"}
            </div>
            <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Objective improvement relative to baseline fleet plan</div>
          </div>
          {!baseline ? (
            <div style={{ fontSize: 12, color: T.textTer, padding: "12px 0" }}>
              No baseline plan has been computed for this optimization run.
            </div>
          ) : !optimized ? (
            <div style={{ fontSize: 12, color: T.textTer, padding: "12px 0" }}>
              Select a solution to compare against the baseline.
            </div>
          ) : [
            { label: "Fuel Consumption", base: `${baseline.fuel.toLocaleString()} model units`, opt: `${optimized.fuel.toLocaleString()} model units` },
            { label: "Operating Cost",   base: `$${baseline.cost}M`,                             opt: `$${optimized.cost}M` },
            { label: "Lifecycle GHG",    base: `${baseline.ghg.toLocaleString()} kgCO₂`,         opt: `${optimized.ghg.toLocaleString()} kgCO₂` },
            { label: "Cargo Fulfil.",    base: baseline.cargoFulfillment == null ? "Unavailable" : `${baseline.cargoFulfillment}%`, opt: optimized.cargoFulfillment == null ? "Unavailable" : `${optimized.cargoFulfillment}%` },
          ].map(row => (
            <div key={row.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: T.textSec }}>{row.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
                <div style={{ flex: 1, background: "#F4F3EF", borderLeft: `2px solid ${T.borderMed}`, padding: "6px 10px" }}>
                  <div style={{ fontSize: 9, color: T.textTer, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Baseline</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.textSec, fontFamily: "'JetBrains Mono', monospace" }}>
                    {loading ? <LoadingSkeleton height={14} width="70%" /> : row.base}
                  </div>
                </div>
                <svg width="12" height="20" viewBox="0 0 12 20" fill="none" style={{ flexShrink: 0, alignSelf: "center" }}>
                  <path d="M2 10h8M7 6l4 4-4 4" stroke={T.teal} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div style={{ flex: 1, background: T.tealLight, borderLeft: `2px solid ${T.teal}`, padding: "6px 10px" }}>
                  <div style={{ fontSize: 9, color: T.teal, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>Optimized</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.teal, fontFamily: "'JetBrains Mono', monospace" }}>
                    {loading ? <LoadingSkeleton height={14} width="70%" /> : row.opt}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Fuel Mix */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, padding: "16px 20px" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: "'Instrument Sans', sans-serif" }}>
              Fuel Mix — {optimized?.label ?? "No solution selected"}
            </div>
            <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Fuel breakdown by type across this solution's assignments</div>
          </div>

          {fuelMix.length === 0 ? (
            <div style={{ fontSize: 12, color: T.textTer, padding: "12px 0" }}>No fuel mix data available for this solution.</div>
          ) : (
            <>
              {/* Stacked bar */}
              <div style={{ display: "flex", height: 8, marginBottom: 16, gap: 1 }}>
                {fuelMix.map(f => (
                  <div key={f.fuel} style={{ width: `${f.share}%`, background: f.color, opacity: 0.85 }} title={`${f.fuel}: ${f.share}%`} />
                ))}
              </div>

              {fuelMix.map(f => (
                <div key={f.fuel} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 3, height: 28, background: f.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, color: T.text, fontWeight: 500, fontFamily: "'Instrument Sans', sans-serif" }}>{f.fuel}</div>
                      <div style={{ fontSize: 10, color: T.textTer }}>{f.vessels} vessels · {f.share}%</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>{f.consumption.toLocaleString()} model units</div>
                    <div style={{ fontSize: 10, color: T.textTer }}>{f.ghg.toLocaleString()} kgCO₂</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <VesselDrawer
        vesselId={selectedVesselId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        assignments={assignments}
        vessels={vessels}
        ports={ports}
        routes={routes}
      />
    </div>
  );
}
