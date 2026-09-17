import React, { useMemo, useState } from "react";
import GoogleFleetMap from "../components/GoogleFleetMap";
import VesselSimulationPanel from "../components/VesselSimulationPanel";
import VesselDrawer from "../components/VesselDrawer";
import type { Assignment } from "../api/types";
import { useFleetData, useLatestOptimization } from "../api/hooks";
import { cargoDemandDisplay, cargoFulfillmentPct } from "../lib/cargo";
import { buildSimVessels, useVesselSimulation } from "../lib/vesselSimulation";

interface Props {
  solutionId: string;
  onGoToScenario: () => void;
  onGoToOptimization: () => void;
}

const FUEL_COLORS: Record<string, string> = {
  LNG: "#2563EB", Methanol: "#059669", Ammonia: "#7C3AED", Conv: "#94A3B8",
};

export default function FleetPlan({ solutionId, onGoToScenario, onGoToOptimization }: Props) {
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sortCol, setSortCol] = useState<keyof Assignment | null>(null);

  const { data: liveResult, loading, error } = useLatestOptimization();
  const { vessels, ports, routes, error: fleetError } = useFleetData();
  const sol = liveResult?.pareto_solutions.find((solution) => solution.id === solutionId);
  const assignments: Assignment[] = sol?.assignments ?? [];
  const activeRouteIds = Array.from(new Set(assignments.map(a => a.routeId).filter((id): id is string => id != null)));

  const simVessels = useMemo(() => buildSimVessels(assignments), [assignments]);
  const sim = useVesselSimulation(simVessels);
  const selectedVesselId = assignments.find(a => a.id === selectedAssignmentId)?.vesselId ?? null;

  if (loading) return <div style={{ padding: 28, color: "#64748B" }}>Loading real optimization result…</div>;
  if (error || fleetError) return <div style={{ padding: 28, color: "#B91C1C" }}>Backend data unavailable: {error ?? fleetError}</div>;
  if (!sol) return <div style={{ padding: 28, color: "#B91C1C" }}>Solution {solutionId} is not present in the latest real optimization result.</div>;

  const displayRows = assignments.map(a => {
    const vessel = vessels.find(v => v.id === a.vesselId);
    const origin = ports.find(p => p.id === a.originId);
    const dest = ports.find(p => p.id === a.destinationId);
    return { ...a, vesselName: vessel?.name ?? a.vesselId, originName: origin?.name ?? a.originId, destName: dest?.name ?? a.destinationId };
  });

  const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
    "on-schedule": { bg: "#F0FDF4", color: "#15803D" },
    warning:       { bg: "#FFFBEB", color: "#D97706" },
    critical:      { bg: "#FEF2F2", color: "#DC2626" },
  };

  const planConstraints = assignments.flatMap((assignment) => assignment.constraints);
  const ghgWarning = planConstraints.find((constraint) => constraint.label.toLowerCase().includes("ghg") && constraint.note);

  const requestedCargo = liveResult?.structured_request?.cargo ?? null;
  const cargoDemand = cargoDemandDisplay(requestedCargo);
  const fulfillmentPct = cargoFulfillmentPct(assignments, requestedCargo);

  return (
    <div style={{ padding: "24px 28px", overflowY: "auto", height: "100%" }}>

      {/* Solution header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={onGoToOptimization}
          style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: 7, padding: "6px 12px", fontSize: 12, color: "#64748B", cursor: "pointer" }}
        >
          ← Optimization Results
        </button>
        <span style={{ fontSize: 12, color: "#94A3B8" }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{sol.label} — Fleet Plan</span>
        <span style={{ background: "#EFF6FF", color: "#1D4ED8", borderRadius: 5, fontSize: 10, fontWeight: 700, padding: "3px 8px" }}>PARETO-OPTIMAL</span>
        <button
          onClick={onGoToScenario}
          style={{ marginLeft: "auto", background: "#F0FDF4", color: "#15803D", border: "1px solid #BBF7D0", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          Run Scenario Analysis →
        </button>
      </div>

      {assignments.length === 0 && (
        <div style={{ marginBottom: 16, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#1E40AF" }}>
          {sol.emptyStateReason ?? "This real optimizer solution has no assignments."}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Fuel",          val: `${sol.fuel.toLocaleString()} t`,      color: "#1D4ED8", bg: "#EFF6FF" },
          { label: "Total Cost",          val: `$${sol.cost}M`,                         color: "#059669", bg: "#F0FDF4" },
          { label: "Lifecycle GHG",       val: `${sol.ghg.toLocaleString()} kgCO₂`,    color: "#0F172A", bg: "#F8FAFC" },
          { label: "Cargo Demand",        val: cargoDemand.value,                       color: "#059669", bg: "#F0FDF4", sub: fulfillmentPct != null ? `${fulfillmentPct}% assigned` : cargoDemand.sub },
          { label: "Vessels Deployed",    val: `${sol.vessels}`,                        color: "#0F172A", bg: "#F8FAFC" },
          { label: "Routes",              val: `${sol.routes}`,                         color: "#0F172A", bg: "#F8FAFC" },
        ].map(k => (
          <div key={k.label} style={{ flex: 1, background: k.bg, borderRadius: 9, padding: "14px 16px", border: "1px solid #E2E8F0" }}>
            <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: k.color, fontFamily: "'JetBrains Mono', monospace" }}>{k.val}</div>
            {"sub" in k && k.sub && <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 3 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, marginBottom: 20, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans', sans-serif" }}>Optimized Route Map — {sol.label}</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>All {sol.routes} active deployment routes for this fleet plan.</div>
        </div>
        <div style={{ height: 320 }}>
          <GoogleFleetMap
            ports={ports}
            routes={routes}
            highlightRouteIds={activeRouteIds}
            showAllRoutes={false}
            selectedPortId={null}
            compact={true}
            vessels={sim.markers}
            selectedVesselId={selectedAssignmentId}
            onVesselClick={id => { setSelectedAssignmentId(id); setDrawerOpen(true); }}
          />
        </div>
        <div style={{ padding: "10px 14px", borderTop: "1px solid #F1F5F9" }}>
          <VesselSimulationPanel sim={sim} vesselCount={simVessels.length} />
        </div>
      </div>

      {/* Main grid: Table + Constraints */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, marginBottom: 20 }}>

        {/* Fleet Assignment Table */}
        <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans', sans-serif" }}>Fleet Assignment</div>
            <span style={{ fontSize: 12, color: "#94A3B8" }}>{assignments.length} vessels · Click row for details</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Vessel", "Cargo", "Origin", "Destination", "Speed", "Fuel", "Shore Power", "ETA", "Fuel (t)", "Cost", "GHG", "Status"].map(col => (
                    <th key={col} style={{ padding: "9px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, i) => {
                  const isSelected = row.id === selectedAssignmentId;
                  const ss = STATUS_STYLE[row.status] ?? { bg: "white", color: "#475569" };
                  return (
                    <tr
                      key={row.id}
                      onClick={() => { setSelectedAssignmentId(row.id); setDrawerOpen(true); }}
                      style={{
                        background: isSelected ? "#EFF6FF" : i % 2 === 0 ? "white" : "#FAFAFA",
                        cursor: "pointer", borderBottom: "1px solid #F1F5F9",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "white" : "#FAFAFA"; }}
                    >
                      <td style={{ padding: "8px 10px", fontWeight: 600, color: isSelected ? "#1D4ED8" : "#0F172A", whiteSpace: "nowrap" }}>{row.vesselName.replace("MV ", "")}</td>
                      <td style={{ padding: "8px 10px", color: "#475569" }}>{row.cargo}</td>
                      <td style={{ padding: "8px 10px", color: "#475569", whiteSpace: "nowrap" }}>{row.originId}</td>
                      <td style={{ padding: "8px 10px", color: "#475569", whiteSpace: "nowrap" }}>{row.destinationId}</td>
                      <td style={{ padding: "8px 10px", color: "#475569", fontFamily: "'JetBrains Mono', monospace" }}>{row.speed} kn</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ background: "#EFF6FF", color: FUEL_COLORS[row.fuelType] ?? "#1D4ED8", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{row.fuelType}</span>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center" }}>
                        {row.shorepower ? <span style={{ color: "#059669", fontSize: 12 }}>✓</span> : <span style={{ color: "#CBD5E1", fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#475569", whiteSpace: "nowrap", fontSize: 11 }}>{row.eta}</td>
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

        {/* Constraint + Explanation */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* GHG warning */}
          {ghgWarning && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", display: "flex", gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚠</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>GHG Threshold Notice</div>
                <div style={{ fontSize: 11, color: "#78350F", marginTop: 2 }}>{ghgWarning.note}</div>
              </div>
            </div>
          )}

          {/* Constraint status */}
          <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, padding: "16px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>Constraint Status</div>
            {planConstraints.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: c.satisfied ? "#F0FDF4" : "#FEF2F2", border: `1.5px solid ${c.satisfied ? "#86EFAC" : "#FCA5A5"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    {c.satisfied
                      ? <path d="M2 6l3 3 5-5" stroke="#15803D" strokeWidth="1.8" strokeLinecap="round" />
                      : <path d="M3 3l6 6M9 3l-6 6" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" />
                    }
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#0F172A", fontWeight: 500 }}>{c.label}</div>
                  {c.note && <div style={{ fontSize: 10, color: "#D97706", marginTop: 1 }}>{c.note}</div>}
                </div>
                <span style={{ marginLeft: "auto", fontSize: 11, color: c.satisfied ? "#059669" : "#DC2626", fontWeight: 600 }}>
                  {c.satisfied ? "✓ Met" : "✗ Violated"}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>

      <VesselDrawer
        vesselId={selectedVesselId}
        assignmentId={selectedAssignmentId}
        progressPct={selectedAssignmentId ? sim.progressOf(selectedAssignmentId) : null}
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
