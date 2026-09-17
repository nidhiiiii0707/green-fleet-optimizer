import React, { useState } from "react";
import GoogleFleetMap from "../components/GoogleFleetMap";
import VesselDrawer from "../components/VesselDrawer";
import type { Assignment } from "../api/types";
import { useFleetData, useLatestOptimization } from "../api/hooks";

const FUEL_COLORS: Record<string, string> = {
  LNG: "#2563EB", Methanol: "#059669", Ammonia: "#7C3AED", Conv: "#94A3B8",
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  "on-schedule": { bg: "#F0FDF4", color: "#15803D" },
  warning:       { bg: "#FFFBEB", color: "#D97706" },
  critical:      { bg: "#FEF2F2", color: "#DC2626" },
};

export default function FleetRoutes({ solutionId }: { solutionId: string }) {
  const [selectedVesselId, setSelectedVesselId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fuelFilter, setFuelFilter] = useState("All");
  const [availFilter, setAvailFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const { vessels: VESSELS, ports: PORTS, routes: ROUTES, loading: fleetLoading, error: fleetError } = useFleetData();
  const { data: liveResult, loading: optimizationLoading, error: optimizationError } = useLatestOptimization();
  const solution = liveResult?.pareto_solutions.find((item) => item.id === solutionId);
  const assignments: Assignment[] = solution?.assignments ?? [];
  const activeRouteIds = Array.from(new Set(assignments.map(a => a.routeId).filter((id): id is string => id != null)));
  const availabilitySupported = VESSELS.some(v => v.availability != null);

  const displayRows = assignments.map(a => {
    const vessel = VESSELS.find(v => v.id === a.vesselId);
    const origin = PORTS.find(p => p.id === a.originId);
    const dest = PORTS.find(p => p.id === a.destinationId);
    return { ...a, vessel, vesselName: vessel?.name ?? a.vesselId, originName: origin?.name ?? a.originId, destName: dest?.name ?? a.destinationId };
  }).filter(row => {
    if (fuelFilter !== "All" && row.fuelType !== fuelFilter) return false;
    if (availabilitySupported && availFilter !== "All" && row.vessel?.availability !== availFilter) return false;
    if (statusFilter !== "All" && row.status !== statusFilter) return false;
    return true;
  });

  const selectedRoute = selectedVesselId
    ? assignments.find(a => a.vesselId === selectedVesselId)?.routeId ?? null
    : null;

  if (fleetLoading || optimizationLoading) return <div style={{ padding: 24, color: "#64748B" }}>Loading real fleet plan…</div>;
  if (fleetError || optimizationError) return <div style={{ padding: 24, color: "#B91C1C" }}>Backend data unavailable: {fleetError ?? optimizationError}</div>;
  if (!solution) return <div style={{ padding: 24, color: "#B91C1C" }}>Solution {solutionId} is not present in the latest result.</div>;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Filter sidebar */}
      <div style={{ width: 200, background: "white", borderRight: "1px solid #E2E8F0", padding: "16px", overflowY: "auto", flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>Filters</div>

        {[
          { label: "Fuel Type", options: ["All", "DM", "RM380"], value: fuelFilter, set: setFuelFilter, disabled: false },
          { label: "Availability", options: ["All", "available", "in-transit", "maintenance"], value: availFilter, set: setAvailFilter, disabled: !availabilitySupported },
          { label: "Status", options: ["All", "on-schedule", "warning", "critical"], value: statusFilter, set: setStatusFilter, disabled: false },
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 16, opacity: f.disabled ? 0.45 : 1 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, color: "#94A3B8", marginBottom: 6 }}>{f.label}</div>
            {f.disabled && (
              <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 6 }}>Not tracked by the current fleet data.</div>
            )}
            {f.options.map(opt => (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, cursor: f.disabled ? "not-allowed" : "pointer" }}>
                <input
                  type="radio"
                  name={f.label}
                  value={opt}
                  checked={f.value === opt}
                  disabled={f.disabled}
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
          <GoogleFleetMap
            ports={PORTS}
            routes={ROUTES}
            highlightRouteIds={selectedRoute ? [selectedRoute] : activeRouteIds}
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
        vessels={VESSELS}
        ports={PORTS}
        routes={ROUTES}
      />
    </div>
  );
}
