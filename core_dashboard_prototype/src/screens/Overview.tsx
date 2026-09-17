import React, { useState } from "react";
import WorldMap from "../components/WorldMap";
import VesselDrawer from "../components/VesselDrawer";
import { ROUTES, PARETO_SOLUTIONS, BASELINE, OPTIMIZED, FUEL_MIX, VESSELS } from "../data/mock";
import { useLatestOptimization } from "../api/hooks";

interface Props {
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

export default function Overview({ onGoToOptimization }: Props) {
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Live data from API, fall back to mock while loading
  const { data: liveResult, loading } = useLatestOptimization();

  const paretoSolutions = liveResult?.pareto_solutions ?? PARETO_SOLUTIONS;
  const fuelMix         = liveResult?.fuel_mix         ?? FUEL_MIX;
  const baseline        = liveResult?.baseline         ?? BASELINE;
  const optimized       = liveResult?.optimized        ?? OPTIMIZED;
  const runId           = liveResult?.run_id           ?? "run_024";
  const method          = liveResult?.method           ?? "MO-QIGA";
  const feasibleCount   = liveResult?.feasible_solutions ?? 42;
  const paretoCount     = liveResult?.pareto_count     ?? 18;

  const sol07 = paretoSolutions.find(s => s.id === "S07");
  const assignments = sol07?.assignments ?? [];
  const activeRouteIds = Array.from(new Set(assignments.map(a => a.routeId)));

  const KPI_DATA = [
    { label: "Total Fuel",      value: loading ? null : `${(optimized.fuel ?? 18420).toLocaleString()} t`,   delta: "↓ 8.4%",  good: true,  sub: "vs baseline" },
    { label: "Operating Cost",  value: loading ? null : `$${optimized.cost ?? 4.82}M`,                         delta: "↓ 6.6%",  good: true,  sub: "vs baseline" },
    { label: "Lifecycle GHG",   value: loading ? null : `${(optimized.ghg ?? 54820).toLocaleString()} tCO₂e`, delta: "↓ 11.2%", good: true,  sub: "vs baseline" },
    { label: "Cargo Fulfil.",   value: loading ? null : `${optimized.cargoFulfillment ?? 97.8}%`,              delta: "↑ 3.6pp", good: true,  sub: "vs baseline" },
    { label: "Active Vessels",  value: loading ? null : `${sol07?.vessels ?? 24} / 31`,                        delta: "",         good: null,  sub: "in deployment" },
    { label: "Constraint Sat.", value: loading ? null : `${sol07?.constraintsSatisfied ?? 12} / ${sol07?.totalConstraints ?? 12}`, delta: "100%", good: true, sub: "Solution #07" },
  ];

  const PORTS_MAP: Record<string, { x: number; y: number }> = {
    RTM: { x: 461, y: 93 }, SGP: { x: 709, y: 217 }, SHA: { x: 755, y: 144 },
    LAX: { x: 154, y: 137 }, HOU: { x: 210, y: 148 }, DXB: { x: 586, y: 158 },
    YKH: { x: 800, y: 133 }, SYD: { x: 825, y: 303 }, CPT: { x: 496, y: 303 },
    STS: { x: 332, y: 278 }, BOM: { x: 630, y: 173 }, PUS: { x: 772, y: 120 },
  };

  const vesselPositions = assignments.slice(0, 18).map(a => {
    const route = ROUTES.find(r => r.id === a.routeId);
    const vessel = VESSELS.find(v => v.id === a.vesselId);
    if (!route) return null;
    const p0 = PORTS_MAP[route.originId] ?? { x: 461, y: 93 };
    const p1 = PORTS_MAP[route.destinationId] ?? { x: 461, y: 93 };
    const t = 0.45, cx = route.controlX, cy = route.controlY;
    const x = (1-t)*(1-t)*p0.x + 2*(1-t)*t*cx + t*t*p1.x;
    const y = (1-t)*(1-t)*p0.y + 2*(1-t)*t*cy + t*t*p1.y;
    return { id: a.vesselId, x, y, name: vessel?.name ?? a.vesselId, status: a.status };
  }).filter(Boolean) as { id: string; x: number; y: number; name: string; status: string }[];

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
            ["Constraint Satisfaction", "100%"],
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
              Fleet & Route Visualization — Solution #07
            </div>
            <div style={{ fontSize: 11, color: T.textSec, marginTop: 1 }}>
              Indicative vessel positions · {sol07?.routes ?? 18} active routes · click a vessel to view details
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 10, color: T.textTer, fontFamily: "'JetBrains Mono', monospace" }}>
            <span>● Active route</span>
            <span style={{ color: T.teal }}>● Shore power</span>
            <span style={{ color: T.amber }}>▲ Warning</span>
          </div>
        </div>
        <div style={{ height: 340 }}>
          <WorldMap
            highlightRouteIds={activeRouteIds}
            vesselPositions={vesselPositions}
            onVesselClick={id => { setSelectedVesselId(id); setDrawerOpen(true); }}
            selectedVesselId={selectedVesselId}
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
              Baseline vs Optimized — Solution #07
            </div>
            <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Objective improvement relative to baseline fleet plan</div>
          </div>
          {[
            { label: "Fuel Consumption", base: `${(baseline.fuel ?? 20100).toLocaleString()} t`,       opt: `${(optimized.fuel ?? 18420).toLocaleString()} t`,       pct: "−8.4%"  },
            { label: "Operating Cost",   base: `$${baseline.cost ?? 5.16}M`,                             opt: `$${optimized.cost ?? 4.82}M`,                             pct: "−6.6%"  },
            { label: "Lifecycle GHG",    base: `${(baseline.ghg ?? 61700).toLocaleString()} tCO₂e`,     opt: `${(optimized.ghg ?? 54820).toLocaleString()} tCO₂e`,     pct: "−11.2%" },
            { label: "Cargo Fulfil.",    base: `${baseline.cargoFulfillment ?? 94.2}%`,                  opt: `${optimized.cargoFulfillment ?? 97.8}%`,                  pct: "+3.6pp" },
          ].map(row => (
            <div key={row.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: T.textSec }}>{row.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.green, fontFamily: "'JetBrains Mono', monospace" }}>{row.pct}</span>
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
              Fuel Mix — Solution #07
            </div>
            <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>Fuel breakdown by type across the fleet</div>
          </div>

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
                <div style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>{f.consumption.toLocaleString()} t</div>
                <div style={{ fontSize: 10, color: T.textTer }}>{f.ghg.toLocaleString()} tCO₂e</div>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 10, color: T.textTer, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
              Lifecycle Emissions Breakdown
            </div>
            {[
              { label: "Well-to-Tank",  val: "12,060 tCO₂e", pct: "22%" },
              { label: "Tank-to-Wake",  val: "37,278 tCO₂e", pct: "68%" },
              { label: "Well-to-Wake",  val: `${(optimized.ghg ?? 54820).toLocaleString()} tCO₂e`, pct: "100%" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: T.textSec }}>{row.label}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: T.text, fontFamily: "'JetBrains Mono', monospace" }}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <VesselDrawer
        vesselId={selectedVesselId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        assignments={assignments}
      />
    </div>
  );
}
