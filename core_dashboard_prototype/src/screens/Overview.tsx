import React, { useMemo, useState } from "react";
import GoogleFleetMap from "../components/GoogleFleetMap";
import { useFleetData } from "../api/hooks";
import type { OptimizationResult, ParetoSolution } from "../api/types";

interface Props {
  solutionId: string;
  result: OptimizationResult | null;
  loading: boolean;
  error: string | null;
  onGoToOptimization: () => void;
}

const C = {
  canvas: "var(--gf-canvas)",
  card: "var(--gf-card)",
  ink: "var(--gf-ink)",
  muted: "var(--gf-muted)",
  faint: "var(--gf-faint)",
  line: "var(--gf-line)",
  teal: "#075f62",
  tealDark: "#08444d",
  green: "#278852",
  lime: "#91aa42",
  gold: "#bea443",
};

function pctChange(base: number | undefined, value: number | undefined) {
  if (!base || value == null) return null;
  return ((base - value) / base) * 100;
}

function MiniTrend({ base, value, color }: { base?: number; value?: number; color: string }) {
  const improving = base != null && value != null && value <= base;
  const y1 = improving ? 10 : 21;
  const y2 = improving ? 21 : 10;
  return (
    <svg viewBox="0 0 150 30" preserveAspectRatio="none" style={{ width: "100%", height: 31, display: "block" }} aria-hidden="true">
      <path d={`M0 ${y1} C28 ${y1 - 5}, 40 ${y1 + 8}, 62 14 S105 ${y2 + 4}, 138 ${y2}`} fill="none" stroke={color} strokeWidth="1.4" />
      <path d={`M0 ${y1} C28 ${y1 - 5}, 40 ${y1 + 8}, 62 14 S105 ${y2 + 4}, 138 ${y2} L138 29 L0 29 Z`} fill={color} opacity="0.08" />
      <circle cx="138" cy={y2} r="2.6" fill={color} stroke="white" strokeWidth="1" />
    </svg>
  );
}

function KpiCard({ title, value, delta, detail, base, current, color = C.teal }: {
  title: string; value: string; delta?: string; detail: string; base?: number; current?: number; color?: string;
}) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderLeft: `2px solid ${color}`, padding: "10px 12px 9px", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 10, fontWeight: 650, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        <span style={{ width: 14, height: 14, border: `1px solid ${C.line}`, borderRadius: "50%", color: C.faint, fontSize: 8, display: "grid", placeItems: "center" }}>i</span>
      </div>
      <MiniTrend base={base} value={current} color={color} />
      <div style={{ fontSize: 21, lineHeight: 1.05, fontWeight: 750, letterSpacing: "-0.03em", color: C.ink }}>{value}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, minHeight: 14 }}>
        {delta && <span style={{ color: C.green, fontSize: 9, fontWeight: 700 }}>↗ {delta}</span>}
        <span style={{ color: C.muted, fontSize: 8.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{detail}</span>
      </div>
    </div>
  );
}

function ParetoMiniChart({ solutions, selectedId }: { solutions: ParetoSolution[]; selectedId: string }) {
  const width = 430;
  const height = 125;
  const pad = { l: 42, r: 12, t: 12, b: 25 };
  const fuels = solutions.map(s => s.fuel);
  const costs = solutions.map(s => s.cost);
  const rawMinX = Math.min(...fuels); const rawMaxX = Math.max(...fuels);
  const rawMinY = Math.min(...costs); const rawMaxY = Math.max(...costs);
  const spanX = Math.max(rawMaxX - rawMinX, Math.abs(rawMaxX) * 0.04, 1);
  const spanY = Math.max(rawMaxY - rawMinY, Math.abs(rawMaxY) * 0.04, 0.001);
  const minX = rawMinX - spanX * 0.18; const maxX = rawMaxX + spanX * 0.18;
  const minY = rawMinY - spanY * 0.18; const maxY = rawMaxY + spanY * 0.18;
  const x = (v: number) => pad.l + ((v - minX) / Math.max(maxX - minX, 1)) * (width - pad.l - pad.r);
  const y = (v: number) => height - pad.b - ((v - minY) / Math.max(maxY - minY, 0.001)) * (height - pad.t - pad.b);
  const ordered = [...solutions].sort((a, b) => a.fuel - b.fuel);
  const xTicks = [minX, (minX + maxX) / 2, maxX];
  const yTicks = [minY, (minY + maxY) / 2, maxY];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height: 128, display: "block" }}>
      {yTicks.map(tick => <g key={tick}><line x1={pad.l} x2={width - pad.r} y1={y(tick)} y2={y(tick)} stroke="var(--gf-grid)" /><text x={pad.l - 5} y={y(tick) + 3} fontSize="7" fill={C.muted} textAnchor="end">${tick.toFixed(3)}M</text></g>)}
      <line x1={pad.l} x2={pad.l} y1={pad.t} y2={height - pad.b} stroke="var(--gf-axis)" />
      <line x1={pad.l} x2={width - pad.r} y1={height - pad.b} y2={height - pad.b} stroke="var(--gf-axis)" />
      {xTicks.map(tick => <text key={tick} x={x(tick)} y={height - pad.b + 11} fontSize="7" fill={C.muted} textAnchor="middle">{tick.toFixed(1)} t</text>)}
      {ordered.length > 1 && <polyline points={ordered.map(s => `${x(s.fuel)},${y(s.cost)}`).join(" ")} fill="none" stroke={C.gold} strokeWidth="1.2" />}
      {solutions.map(s => <circle key={s.id} cx={x(s.fuel)} cy={y(s.cost)} r={s.id === selectedId ? 5 : 3.7} fill={s.id === selectedId ? C.teal : "#70a4a0"} stroke="white" strokeWidth="1.4" />)}
      <text x={width / 2} y={height - 5} fontSize="8" fill={C.muted} textAnchor="middle">Fuel consumption (t)</text>
      <text x="10" y={height / 2} fontSize="8" fill={C.muted} textAnchor="middle" transform={`rotate(-90 10 ${height / 2})`}>Cost ($M)</text>
    </svg>
  );
}

export default function Overview({ solutionId, result, loading, error, onGoToOptimization }: Props) {
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const { vessels, ports, routes, error: fleetError } = useFleetData();
  const solutions = result?.pareto_solutions ?? [];
  const selected = solutions.find(s => s.id === solutionId) ?? solutions[0];
  const assignments = selected?.assignments ?? [];
  const baseline = result?.baseline ?? null;
  const activeRouteIds = Array.from(new Set(assignments.map(a => a.routeId).filter((id): id is string => Boolean(id))));

  const utilizationRows = useMemo(() => {
    const grouped = new Map<string, { values: number[]; fuels: Map<string, number> }>();
    assignments.forEach(a => {
      const vessel = vessels.find(v => v.id === a.vesselId);
      const capacity = vessel?.capacity ?? 0;
      const utilization = capacity > 0 ? Math.min(100, ((a.cargoTons ?? a.cargoTEU) / capacity) * 100) : 0;
      const key = a.vesselType ?? vessel?.type ?? a.vesselId;
      const row = grouped.get(key) ?? { values: [], fuels: new Map<string, number>() };
      row.values.push(utilization);
      row.fuels.set(a.fuelType, (row.fuels.get(a.fuelType) ?? 0) + 1);
      grouped.set(key, row);
    });
    return Array.from(grouped.entries()).map(([name, row]) => ({
      name,
      utilization: row.values.length ? row.values.reduce((a, b) => a + b, 0) / row.values.length : 0,
      primaryFuel: Array.from(row.fuels.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown",
    }));
  }, [assignments, vessels]);

  const averageUtilization = utilizationRows.length ? utilizationRows.reduce((sum, row) => sum + row.utilization, 0) / utilizationRows.length : null;
  const onTime = assignments.length ? assignments.filter(a => a.status === "on-schedule").length / assignments.length * 100 : null;
  const fuelDelta = pctChange(baseline?.fuel, selected?.fuel);
  const costDelta = pctChange(baseline?.cost, selected?.cost);
  const ghgDelta = pctChange(baseline?.ghg, selected?.ghg);
  const routeLabels = activeRouteIds.map(id => routes.find(r => r.id === id)).filter(Boolean).slice(0, 4);
  const algorithmNames = Array.from(new Set(solutions.map(s => s.algorithm).filter(Boolean))).join(" / ") || "Optimizer";

  if (error || fleetError) return <div style={{ padding: 24, color: "#9c3028" }}>Backend data unavailable: {error ?? fleetError}</div>;

  return (
    <div style={{ padding: "10px 12px 18px", minHeight: "100%", background: C.canvas }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, fontSize: 9, color: C.muted }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.ink, fontWeight: 650 }}><i style={{ width: 5, height: 5, borderRadius: "50%", background: loading ? C.gold : C.green }} />{loading ? "Loading optimizer data" : "Real optimization result"}</span>
        <span>•</span><span>{result?.source ?? "Live API"}</span><span>•</span><span>{assignments.length} assignments</span><span>•</span><span>{algorithmNames}</span>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 9, marginBottom: 9 }}>
        <KpiCard title="Fleet Fuel Consumption" value={selected ? `${selected.fuel.toLocaleString()} t` : "—"} delta={fuelDelta == null ? undefined : `${Math.abs(fuelDelta).toFixed(1)}% vs. baseline`} detail={selected?.label ?? "No solution"} base={baseline?.fuel} current={selected?.fuel} />
        <KpiCard title="Total Operating Cost" value={selected ? `$${selected.cost.toFixed(3)}M` : "—"} delta={costDelta == null ? undefined : `${Math.abs(costDelta).toFixed(1)}% reduction`} detail="Selected fleet plan" base={baseline?.cost} current={selected?.cost} color={C.gold} />
        <KpiCard title="GHG Emissions" value={selected ? `${selected.ghg.toLocaleString()} kgCO₂` : "—"} delta={ghgDelta == null ? undefined : `${Math.abs(ghgDelta).toFixed(1)}% reduction`} detail="Lifecycle emissions" base={baseline?.ghg} current={selected?.ghg} color={C.green} />
        <KpiCard title="Average Vessel Utilization" value={averageUtilization == null ? "Unavailable" : `${averageUtilization.toFixed(0)}%`} detail={`${utilizationRows.length} vessel classes`} base={100} current={averageUtilization ?? undefined} color={C.tealDark} />
        <KpiCard title="Fleet On-Time Performance" value={onTime == null ? "Unavailable" : `${onTime.toFixed(1)}%`} detail={`${assignments.length} route assignments`} base={100} current={onTime ?? undefined} />
      </section>

      <section style={{ background: C.card, border: `1px solid ${C.line}`, marginBottom: 9 }}>
        <div style={{ minHeight: 43, padding: "8px 12px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>Fleet & Route Visualization — {selected?.label ?? "No solution selected"}</div><div style={{ fontSize: 8.5, color: C.muted, marginTop: 2 }}>{activeRouteIds.length} active routes from real port/route coordinates · click a port to view details</div></div>
          <button onClick={onGoToOptimization} style={{ background: C.teal, color: "white", border: 0, padding: "7px 12px", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>View Pareto Results →</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 180px", height: 255 }}>
          <GoogleFleetMap ports={ports} routes={routes} highlightRouteIds={activeRouteIds} selectedPortId={selectedPortId} onPortClick={id => setSelectedPortId(id === selectedPortId ? null : id)} showAllRoutes />
          <aside style={{ borderLeft: `1px solid ${C.line}`, padding: "11px 12px", overflow: "hidden" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.ink, marginBottom: 9 }}>Active Route Network</div>
            <div style={{ fontSize: 8.5, color: C.muted, lineHeight: 1.5, marginBottom: 11 }}>Real geocoded routes for the selected fleet plan.</div>
            <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 8.5, color: C.muted }}><b style={{ color: C.green }}>●</b> Selected solution route</span>
              <span style={{ fontSize: 8.5, color: C.muted }}><b style={{ color: C.gold }}>●</b> Other available route</span>
              <span style={{ fontSize: 8.5, color: C.muted }}><b style={{ color: C.teal }}>●</b> Port coordinate</span>
            </div>
            {routeLabels.map(route => route && <div key={route.id} style={{ padding: "7px 0", borderTop: `1px solid ${C.line}` }}><div style={{ fontSize: 9, fontWeight: 650, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{route.name}</div><div style={{ fontSize: 8, color: C.faint, marginTop: 2 }}>{route.distanceNm.toLocaleString()} nm</div></div>)}
          </aside>
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, padding: "9px 12px 6px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.ink }}>Pareto-Optimal Trade-off Curve</div>
          <div style={{ fontSize: 8.5, color: C.muted, marginTop: 2 }}>Objective improvement relative to the returned solution set</div>
          {solutions.length ? <ParetoMiniChart solutions={solutions} selectedId={selected?.id ?? ""} /> : <div style={{ padding: 30, color: C.muted }}>No solutions available.</div>}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.line}`, padding: "9px 12px 10px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.ink }}>Vessel Class Utilization Breakdown</div>
          <div style={{ fontSize: 8.5, color: C.muted, marginTop: 2, marginBottom: 12 }}>Cargo-to-capacity utilization from selected assignments</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(utilizationRows.length, 1)}, minmax(52px, 1fr))`, gap: 10, alignItems: "end", height: 104, borderBottom: `1px solid ${C.line}` }}>
            {utilizationRows.map(row => <div key={row.name} style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}><span style={{ fontSize: 8, color: C.muted, marginBottom: 3 }}>{row.utilization.toFixed(0)}%</span><div title={`${row.name}: ${row.utilization.toFixed(1)}% · ${row.primaryFuel}`} style={{ width: "62%", minWidth: 28, height: `${Math.max(8, row.utilization)}%`, background: `linear-gradient(to top, ${C.tealDark} 0 45%, ${C.teal} 45% 78%, ${C.gold} 78% 100%)` }} /><span style={{ fontSize: 7.5, color: C.muted, marginTop: 5, maxWidth: 70, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</span></div>)}
          </div>
        </div>
      </section>
    </div>
  );
}
