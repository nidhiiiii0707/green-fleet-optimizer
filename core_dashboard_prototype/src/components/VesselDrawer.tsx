import React from "react";
import type { Assignment, Port, Route, Vessel } from "../api/types";

interface Props {
  vesselId: string | null;
  open: boolean;
  onClose: () => void;
  assignments?: Assignment[];
  vessels?: Vessel[];
  ports?: Port[];
  routes?: Route[];
}

const BADGE_STYLE: Record<string, { bg: string; color: string }> = {
  "on-schedule": { bg: "#F0FDF4", color: "#15803D" },
  warning:       { bg: "#FFFBEB", color: "#D97706" },
  critical:      { bg: "#FEF2F2", color: "#DC2626" },
  available:     { bg: "#F0FDF4", color: "#15803D" },
  "in-transit":  { bg: "#EFF6FF", color: "#1D4ED8" },
  maintenance:   { bg: "#FEF3C7", color: "#D97706" },
};

function Badge({ text }: { text: string }) {
  const s = BADGE_STYLE[text] ?? { bg: "#F1F5F9", color: "#475569" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 5, fontSize: 11, fontWeight: 600, padding: "2px 8px", border: `1px solid ${s.color}22` }}>
      {text}
    </span>
  );
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid #F1F5F9" }}>
      <span style={{ fontSize: 12, color: "#64748B" }}>{label}</span>
      <span style={{ fontSize: 12, color: "#0F172A", fontWeight: 500, fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit", textAlign: "right", maxWidth: "55%" }}>
        {value}
      </span>
    </div>
  );
}

export default function VesselDrawer({ vesselId, open, onClose, assignments = [], vessels = [], ports = [], routes = [] }: Props) {
  const vessel = vessels.find(v => v.id === vesselId);
  const assignment = assignments.find(a => a.vesselId === vesselId);
  const origin = ports.find(p => p.id === assignment?.originId);
  const dest = ports.find(p => p.id === assignment?.destinationId);
  const route = routes.find(r => r.id === assignment?.routeId);

  return (
    <>
      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.25)", zIndex: 40 }}
          onClick={onClose}
        />
      )}
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: 380, background: "white", zIndex: 50,
          boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.22s ease",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {!vessel ? (
          <div style={{ padding: 24, color: "#64748B" }}>No vessel selected.</div>
        ) : (
          <>
            <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, color: "#64748B", marginBottom: 2 }}>Vessel Detail</div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans', sans-serif" }}>
                    {vessel.name}
                  </h2>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#64748B" }}>{vessel.type}</span>
                    {vessel.availability ? <Badge text={vessel.availability} /> : null}
                    {assignment && <Badge text={assignment.status} />}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div style={{ padding: "0 20px 20px", overflowY: "auto" }}>
              <div style={{ paddingTop: 16, paddingBottom: 4 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, color: "#94A3B8", marginBottom: 2 }}>Vessel Identity</div>
                <Row label="Vessel ID" value={vessel.id} mono />
                <Row label="Type" value={vessel.type} />
                <Row label="Capacity" value={`${vessel.capacity.toLocaleString()} ${vessel.capacityUnit}`} mono />
                <Row label="Home Port" value={vessel.currentPort ? ports.find(p => p.id === vessel.currentPort)?.name ?? vessel.currentPort : "Unavailable"} />
                <Row label="Maintenance Status" value={vessel.maintenanceStatus ?? "Unavailable"} />
                <Row label="Shore Power Compatible" value={vessel.shorepower == null ? "Unavailable" : vessel.shorepower ? "Yes" : "No"} />
              </div>

              <div style={{ paddingTop: 12, paddingBottom: 4 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, color: "#94A3B8", marginBottom: 6 }}>Fuel Compatibility</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {vessel.fuelCompatibility.map(f => (
                    <span key={f} style={{ background: "#EFF6FF", color: "#1D4ED8", borderRadius: 5, fontSize: 11, fontWeight: 600, padding: "3px 9px", border: "1px solid #BFDBFE" }}>{f}</span>
                  ))}
                </div>
              </div>

              {assignment && (
                <>
                  <div style={{ paddingTop: 14, paddingBottom: 4 }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, color: "#94A3B8", marginBottom: 2 }}>Assigned Voyage</div>
                    <Row label="Cargo" value={assignment.cargo} />
                    <Row label="Volume" value={`${assignment.cargoTEU.toLocaleString()} ${vessel.capacityUnit}`} mono />
                    <Row label="Origin" value={`${origin?.name ?? assignment.originId} (${assignment.originId})`} />
                    <Row label="Destination" value={`${dest?.name ?? assignment.destinationId} (${assignment.destinationId})`} />
                    <Row label="Route" value={route?.name ?? assignment.routeId} />
                    <Row label="Cruising Speed" value={`${assignment.speed} kn`} mono />
                    <Row label="ETA" value={assignment.eta ?? "Unavailable"} />
                  </div>

                  <div style={{ paddingTop: 14, paddingBottom: 4 }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, color: "#94A3B8", marginBottom: 2 }}>Fuel & Environmental</div>
                    <Row label="Fuel Type" value={
                      <span style={{ background: "#EFF6FF", color: "#1D4ED8", borderRadius: 4, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>{assignment.fuelType}</span>
                    } />
                    <Row label="Shore Power" value={assignment.shorepower == null ? "Unavailable" : assignment.shorepower ? "Used at port" : "Not used"} />
                    <Row label="Predicted Fuel" value={`${assignment.fuelConsumption.toLocaleString()} model units`} mono />
                    <Row label="Operating Cost" value={`$${assignment.cost}K`} mono />
                    <Row label="Lifecycle GHG" value={`${assignment.ghg.toLocaleString()} kgCO₂`} mono />
                  </div>

                  <div style={{ paddingTop: 14, paddingBottom: 4 }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, color: "#94A3B8", marginBottom: 8 }}>Constraint Status</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {assignment.constraints.map((c, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 16, height: 16, borderRadius: "50%", background: c.satisfied ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${c.satisfied ? "#86EFAC" : "#FCA5A5"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                              {c.satisfied
                                ? <path d="M2 6l3 3 5-5" stroke="#15803D" strokeWidth="1.8" strokeLinecap="round" />
                                : <path d="M3 3l6 6M9 3l-6 6" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" />
                              }
                            </svg>
                          </div>
                          <span style={{ fontSize: 12, color: "#334155" }}>{c.label}</span>
                          {c.note && <span style={{ fontSize: 10, color: "#D97706", marginLeft: "auto" }} title={c.note}>⚠</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 16, padding: "14px 16px", background: "#F0FDF4", borderRadius: 8, border: "1px solid #BBF7D0" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#15803D", marginBottom: 8 }}>Why this vessel was selected</div>
                    {[
                      "Capacity requirement satisfied",
                      "Fuel compatibility satisfied",
                      "Available within planning window",
                      "Delivery deadline satisfied",
                      "Port constraints satisfied",
                      "GHG constraint satisfied",
                    ].map((r, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                        <span style={{ color: "#15803D", fontSize: 13 }}>✓</span>
                        <span style={{ fontSize: 12, color: "#166534" }}>{r}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
