import React, { useState } from "react";
import { useAlerts } from "../api/hooks";
import type { Alert } from "../api/types";

const SEV_STYLE = {
  high:   { bg: "#FEF2F2", border: "#FCA5A5", label: "#DC2626", icon: "🔴", tag: "#FEE2E2", tagText: "#DC2626" },
  medium: { bg: "#FFFBEB", border: "#FDE68A", label: "#D97706", icon: "🟡", tag: "#FEF3C7", tagText: "#D97706" },
  info:   { bg: "#EFF6FF", border: "#BFDBFE", label: "#2563EB", icon: "🔵", tag: "#DBEAFE", tagText: "#1D4ED8" },
};

function AlertCard({ alert, onAck }: { alert: Alert; onAck: (id: string) => void }) {
  const s = SEV_STYLE[alert.severity];
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 9, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ background: s.tag, color: s.tagText, borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "2px 7px", textTransform: "uppercase" }}>
              {alert.severity === "info" ? "Info" : alert.severity === "medium" ? "Medium" : "High Priority"}
            </span>
            <span style={{ fontSize: 10, color: "#94A3B8", background: "#F8FAFC", borderRadius: 4, padding: "2px 7px" }}>{alert.category}</span>
            {alert.status === "acknowledged" && (
              <span style={{ fontSize: 10, color: "#64748B", background: "#F1F5F9", borderRadius: 4, padding: "2px 7px" }}>Acknowledged</span>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 5 }}>{alert.title}</div>
          <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5, marginBottom: 8 }}>{alert.description}</div>
          <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748B" }}>
            <span>Affected: <strong style={{ color: "#334155" }}>{alert.affected}</strong></span>
            <span>{alert.timestamp}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {alert.status === "active" && (
            <button
              onClick={() => onAck(alert.id)}
              style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 6, padding: "5px 10px", fontSize: 11, color: "#475569", cursor: "pointer" }}
            >
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Alerts() {
  const { alerts: liveAlerts, loading, error, acknowledge } = useAlerts();
  const [filter, setFilter] = useState<Alert["severity"] | "all">("all");

  const filtered = filter === "all" ? liveAlerts : liveAlerts.filter(a => a.severity === filter);
  const counts = {
    high:   liveAlerts.filter(a => a.severity === "high"   && a.status === "active").length,
    medium: liveAlerts.filter(a => a.severity === "medium" && a.status === "active").length,
    info:   liveAlerts.filter(a => a.severity === "info"   && a.status === "active").length,
  };

  const grouped = {
    high:   filtered.filter(a => a.severity === "high"),
    medium: filtered.filter(a => a.severity === "medium"),
    info:   filtered.filter(a => a.severity === "info"),
  };

  return (
    <div style={{ padding: "24px 28px", overflowY: "auto", height: "100%" }}>

      {/* API status banner */}
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 12, color: "#DC2626" }}>
          ⚠ Could not reach backend — showing cached data. ({error})
        </div>
      )}
      {loading && (
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 12, color: "#1D4ED8" }}>
          Loading alerts from server...
        </div>
      )}

      {/* Summary */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {[
          { label: "High Priority", count: counts.high,   color: "#DC2626", bg: "#FEF2F2" },
          { label: "Medium",        count: counts.medium, color: "#D97706", bg: "#FFFBEB" },
          { label: "Informational", count: counts.info,   color: "#2563EB", bg: "#EFF6FF" },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.color}30`, borderRadius: 9, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, fontFamily: "'JetBrains Mono', monospace" }}>{c.count}</div>
            <div style={{ fontSize: 12, color: c.color, fontWeight: 600 }}>{c.label}<br /><span style={{ fontWeight: 400, color: "#94A3B8" }}>active alerts</span></div>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "flex-start" }}>
          {(["all", "high", "medium", "info"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "7px 14px", fontSize: 12, borderRadius: 7, border: "1px solid",
                borderColor: filter === f ? "#1D4ED8" : "#E2E8F0",
                background: filter === f ? "#EFF6FF" : "white",
                color: filter === f ? "#1D4ED8" : "#64748B",
                cursor: "pointer", fontWeight: filter === f ? 600 : 400, textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* High priority */}
      {grouped.high.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
            🔴 High Priority
          </div>
          {grouped.high.map(a => <AlertCard key={a.id} alert={a} onAck={acknowledge} />)}
        </div>
      )}

      {/* Medium */}
      {grouped.medium.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#D97706", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
            🟡 Medium Priority
          </div>
          {grouped.medium.map(a => <AlertCard key={a.id} alert={a} onAck={acknowledge} />)}
        </div>
      )}

      {/* Info */}
      {grouped.info.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
            🔵 Informational
          </div>
          {grouped.info.map(a => <AlertCard key={a.id} alert={a} onAck={acknowledge} />)}
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: 48, color: "#94A3B8" }}>
          <div style={{ fontSize: 32 }}>✅</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>No alerts in this category.</div>
        </div>
      )}
    </div>
  );
}
