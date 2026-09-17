import React, { useState } from "react";
import WorldMap from "../components/WorldMap";
import VesselDrawer from "../components/VesselDrawer";
import { VESSELS as VESSELS_MOCK, PARETO_SOLUTIONS, PORTS as PORTS_MOCK, ROUTES as ROUTES_MOCK } from "../data/mock";
import type { Assignment } from "../data/mock";
import { useFleetData, useLatestOptimization } from "../api/hooks";

const FUEL_COLORS: Record<string, string> = {
  LNG: "#2563EB", Methanol: "#059669", Ammonia: "#7C3AED", Conv: "#94A3B8",
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  "on-schedule": { bg: "#F0FDF4", color: "#15803D" },
  warning:       { bg: "#FFFBEB", color: "#D97706" },
  critical:      { bg: "#FEF2F2", color: "#DC2626" },
};

export default function FleetRoutes() {
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fuelFilter, setFuelFilter] = useState("All");
  const [availFilter, setAvailFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Live fleet data, fall back to mock while loading
  const { vessels: liveVessels, ports: livePorts, routes: liveRoutes, loading: fleetLoading } = useFleetData();
  const { data: liveResult } = useLatestOptimization();

  const VESSELS = liveVessels.length > 0 ? liveVessels : VESSELS_MOCK;
  const PORTS   = livePorts.length   > 0 ? livePorts   : PORTS_MOCK;
  const ROUTES  = liveRoutes.length  > 0 ? liveRoutes  : ROUTES_MOCK;

  const paretoSolutions = liveResult?.pareto_solutions ?? PARETO_SOLUTIONS;
  const sol07 = paretoSolutions.find(s => s.id === "S07");
  const assignments: Assignment[] = (sol07?.assignments as Assignment[] | undefined) ?? [];
  const activeRouteIds = Array.from(new Set(assignments.map(a => a.routeId)));

  const displayRows = assignments.map(a => {
    const vessel = VESSELS.find(v => v.id === a.vesselId);
    const origin = PORTS.find(p => p.id === a.originId);
    const dest = PORTS.find(p => p.id === a.destinationId);
    return { ...a, vessel, vesselName: vessel?.name ?? a.vesselId, originName: origin?.name ?? a.originId, destName: dest?.name ?? a.destinationId };
  }).filter(row => {
    if (fuelFilter !== "All" && row.fuelType !== fuelFilter) return false;
    if (availFilter !== "All" && row.vessel?.availability !== availFilter) return false;
    if (statusFilter !== "All" && row.status !== statusFilter) return false;
    return true;
  });

  const PORTS_MAP: Record<string, { x: number; y: number }> = {
    RTM: { x: 461, y: 93 }, SGP: { x: 709, y: 217 }, SHA: { x: 755, y: 144 },
    LAX: { x: 154, y: 137 }, HOU: { x: 210, y: 148 }, DXB: { x: 586, y: 158 },
    YKH: { x: 800, y: 133 }, SYD: { x: 825, y: 303 }, CPT: { x: 496, y: 303 },
    STS: { x: 332, y: 278 }, BOM: { x: 630, y: 173 }, PUS: { x: 772, y: 120 },
  };

  const vesselPositions = assignments.slice(0, 18).map((a) => {
    const route = ROUTES.find(r => r.id === a.routeId);
    const vessel = VESSELS.find(v => v.id === a.vesselId);
    if (!route) return null;
    const p0 = PORTS_MAP[route.originId] ?? { x: 450, y: 220 };
    const p1 = PORTS_MAP[route.destinationId] ?? { x: 500, y: 220 };
    const t = 0.45;
    const cx = route.controlX, cy = route.controlY;
    const x = (1-t)*(1-t)*p0.x + 2*(1-t)*t*cx + t*t*p1.x;
    const y = (1-t)*(1-t)*p0.y + 2*(1-t)*t*cy + t*t*p1.y;
    return { id: a.vesselId, x, y, name: vessel?.name ?? a.vesselId, status: a.status };
  }).filter(Boolean) as { id: string; x: number; y: number; name: string; status: string }[];

  const selectedRoute = selectedVesselId
    ? assignments.find(a => a.vesselId === selectedVesselId)?.routeId ?? null
    : null;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Filter sidebar */}
      <div style={{ width: 200, background: "white", borderRight: "1px solid #E2E8F0", padding: "16px", overflowY: "auto", flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>Filters</div>

        {[
          { label: "Fuel Type", options: ["All", "LNG", "Methanol", "Ammonia", "Conv"], value: fuelFilter, set: setFuelFilter },
          { label: "Availability", options: ["All", "available", "in-transit", "maintenance"], value: availFilter, set: setAvailFilter },
          { label: "Status", options: ["All", "on-schedule", "warning", "critical"], value: statusFilter, set: setStatusFilter },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, color: "#94A3B8", marginBottom: 6 }}>{f.label}</div>
            {f.options.map(opt => (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, cursor: "pointer" }}>
                <input
                  type="radio"
                  name={f.label}
                  value={opt}
                  checked={f.value === opt}
                  onChange={() => f.set(opt)}
                  style={{ accentColor: "#1D4ED8" }}
                />
                <span style={{ fontSize: 12, color: f.value === opt ? "#1D4ED8" : "#475569", fontWeight: f.value === opt ? 600 : 400 }}>
                  {opt === "on-schedule" ? "On Schedule" : opt}
                </span>
              </label>
            ))}
          </div>
        ))}

        <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>{displayRows.length} of {assignments.length} assignments shown</div>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Map */}
        <div style={{ background: "white", borderBottom: "1px solid #E2E8F0", height: 260, flexShrink: 0 }}>
          <WorldMap
            highlightRouteIds={selectedRoute ? [selectedRoute] : activeRouteIds}
            vesselPositions={vesselPositions}
            onVesselClick={id => { setSelectedVesselId(id); setDrawerOpen(true); }}
            selectedVesselId={selectedVesselId}
            showAllRoutes={true}
            compact={true}
          />
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto", background: "white" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Fleet Assignment Table</div>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>Click a row to view vessel details</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", position: "sticky", top: 0, zIndex: 1 }}>
                {["Vessel", "Cargo", "Origin", "Destination", "Route", "Speed", "Fuel", "Shore Power", "ETA", "Fuel (t)", "Cost", "GHG", "Status"].map(c => (
                  <th key={c} style={{ padding: "9px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row, i) => {
                const isSelected = row.vesselId === selectedVesselId;
                const ss = STATUS_STYLE[row.status] ?? { bg: "white", color: "#475569" };
                const route = ROUTES.find(r => r.id === row.routeId);
                return (
                  <tr
                    key={row.id}
                    onClick={() => { setSelectedVesselId(row.vesselId); setDrawerOpen(true); }}
                    style={{ background: isSelected ? "#EFF6FF" : i % 2 === 0 ? "white" : "#FAFAFA", cursor: "pointer", borderBottom: "1px solid #F1F5F9" }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "white" : "#FAFAFA"; }}
                  >
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: isSelected ? "#1D4ED8" : "#0F172A", whiteSpace: "nowrap" }}>{row.vesselName.replace("MV ", "")}</td>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>{row.cargo}</td>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>{row.originId}</td>
                    <td style={{ padding: "8px 10px", color: "#475569" }}>{row.destinationId}</td>
                    <td style={{ padding: "8px 10px", color: "#64748B", fontSize: 11, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{route?.name ?? row.routeId}</td>
                    <td style={{ padding: "8px 10px", fontFamily: "'JetBrains Mono', monospace", color: "#475569" }}>{row.speed} kn</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ background: "#EFF6FF", color: FUEL_COLORS[row.fuelType] ?? "#1D4ED8", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{row.fuelType}</span>
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                      {row.shorepower ? <span style={{ color: "#059669", fontSize: 12 }}>✓</span> : <span style={{ color: "#CBD5E1" }}>—</span>}
                    </td>
                    <td style={{ padding: "8px 10px", color: "#475569", fontSize: 11, whiteSpace: "nowrap" }}>{row.eta}</td>
                    <td style={{ padding: "8px 10px", fontFamily: "'JetBrains Mono', monospace", color: "#0F172A" }}>{row.fuelConsumption.toLocaleString()}</td>
                    <td style={{ padding: "8px 10px", fontFamily: "'JetBrains Mono', monospace", color: "#0F172A" }}>${row.cost}K</td>
                    <td style={{ padding: "8px 10px", fontFamily: "'JetBrains Mono', monospace", color: "#0F172A" }}>{row.ghg.toLocaleString()}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ background: ss.bg, color: ss.color, borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {row.status === "on-schedule" ? "On Schedule" : row.status === "warning" ? "⚠ Warning" : "Critical"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
