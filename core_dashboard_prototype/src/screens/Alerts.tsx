import React, { useState } from "react";
import { useAlerts } from "../api/hooks";
import type { Alert } from "../api/types";

const SEVERITY_CONFIG = {
  high: {
    label: "High Priority",
    shortLabel: "High",
    border: "rgba(239, 68, 68, 0.4)",
    stripColor: "#EF4444",
    tagBg: "rgba(239, 68, 68, 0.15)",
    tagText: "#F87171",
    tagBorder: "rgba(239, 68, 68, 0.3)",
    iconBg: "rgba(239, 68, 68, 0.12)",
    iconColor: "#EF4444",
  },
  medium: {
    label: "Medium Priority",
    shortLabel: "Medium",
    border: "rgba(245, 158, 11, 0.4)",
    stripColor: "#F59E0B",
    tagBg: "rgba(245, 158, 11, 0.15)",
    tagText: "#FBBF24",
    tagBorder: "rgba(245, 158, 11, 0.3)",
    iconBg: "rgba(245, 158, 11, 0.12)",
    iconColor: "#F59E0B",
  },
  info: {
    label: "Informational",
    shortLabel: "Info",
    border: "rgba(14, 165, 233, 0.35)",
    stripColor: "#0EA5E9",
    tagBg: "rgba(14, 165, 233, 0.15)",
    tagText: "#38BDF8",
    tagBorder: "rgba(14, 165, 233, 0.3)",
    iconBg: "rgba(14, 165, 233, 0.12)",
    iconColor: "#0EA5E9",
  },
};

function AlertCard({ alert, onAck }: { alert: Alert; onAck: (id: string) => void }) {
  const conf = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
  const isAck = alert.status === "acknowledged";

  return (
    <div style={{
      background: "var(--gf-card)",
      border: `1px solid ${conf.border}`,
      borderRadius: 10,
      padding: "16px 20px",
      marginBottom: 12,
      position: "relative",
      overflow: "hidden",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
      transition: "border-color 0.15s ease, transform 0.1s ease",
    }}>
      {/* Color Accent Strip on Left */}
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        background: isAck ? "var(--gf-line-medium)" : conf.stripColor,
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1, paddingLeft: 4 }}>
          {/* Header Badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{
              background: conf.tagBg,
              color: conf.tagText,
              border: `1px solid ${conf.tagBorder}`,
              borderRadius: 5,
              fontSize: 10.5,
              fontWeight: 700,
              padding: "2px 8px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              {conf.shortLabel}
            </span>

            <span style={{
              fontSize: 11,
              color: "var(--gf-ink)",
              background: "var(--gf-row-alt)",
              border: "1px solid var(--gf-line)",
              borderRadius: 5,
              padding: "2px 8px",
              fontWeight: 500,
            }}>
              {alert.category}
            </span>

            {isAck ? (
              <span style={{
                fontSize: 10.5,
                color: "var(--gf-muted)",
                background: "var(--gf-teal-soft)",
                border: "1px solid var(--gf-line)",
                borderRadius: 5,
                padding: "2px 8px",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}>
                ✓ Acknowledged
              </span>
            ) : (
              <span style={{
                fontSize: 10.5,
                color: "#10B981",
                background: "rgba(16, 185, 129, 0.12)",
                borderRadius: 5,
                padding: "2px 8px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                Active
              </span>
            )}
          </div>

          {/* Title */}
          <div style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: "var(--gf-ink)",
            marginBottom: 6,
            lineHeight: 1.3,
          }}>
            {alert.title}
          </div>

          {/* Description */}
          <div style={{
            fontSize: 12.5,
            color: "var(--gf-muted)",
            lineHeight: 1.6,
            marginBottom: 12,
          }}>
            {alert.description}
          </div>

          {/* Metadata Footer */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontSize: 11.5,
            color: "var(--gf-muted)",
            borderTop: "1px solid var(--gf-line)",
            paddingTop: 8,
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span>Affected:</span>
              <strong style={{
                color: "var(--gf-ink)",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
              }}>
                {alert.affected || "Entire Fleet"}
              </strong>
            </span>

            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              <span>{alert.timestamp || "Real-time sync"}</span>
            </span>

            <span style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--gf-faint)" }}>
              ID: {alert.id}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ flexShrink: 0, paddingTop: 2 }}>
          {!isAck && (
            <button
              onClick={() => onAck(alert.id)}
              style={{
                background: "var(--gf-teal-soft)",
                border: "1px solid var(--gf-line-medium)",
                borderRadius: 7,
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--gf-ink)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#0D9488";
                (e.currentTarget as HTMLButtonElement).style.color = "#0D9488";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gf-line-medium)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--gf-ink)";
              }}
            >
              <span>✓</span>
              <span>Acknowledge</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Alerts() {
  const { alerts: liveAlerts, loading, error, acknowledge } = useAlerts();
  const [filter, setFilter] = useState<Alert["severity"] | "all" | "active">("all");

  const counts = {
    total: liveAlerts.length,
    activeTotal: liveAlerts.filter(a => a.status === "active").length,
    high: liveAlerts.filter(a => a.severity === "high" && a.status === "active").length,
    medium: liveAlerts.filter(a => a.severity === "medium" && a.status === "active").length,
    info: liveAlerts.filter(a => a.severity === "info" && a.status === "active").length,
    acknowledged: liveAlerts.filter(a => a.status === "acknowledged").length,
  };

  const filtered = liveAlerts.filter(a => {
    if (filter === "all") return true;
    if (filter === "active") return a.status === "active";
    return a.severity === filter;
  });

  const highAlerts = filtered.filter(a => a.severity === "high");
  const mediumAlerts = filtered.filter(a => a.severity === "medium");
  const infoAlerts = filtered.filter(a => a.severity === "info");

  function handleAcknowledgeAll() {
    liveAlerts
      .filter(a => a.status === "active")
      .forEach(a => acknowledge(a.id));
  }

  return (
    <div style={{ padding: "24px 28px", overflowY: "auto", height: "100%", background: "var(--gf-canvas)" }}>

      {/* API status banner if needed */}
      {error && (
        <div style={{
          background: "rgba(239, 68, 68, 0.1)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 18,
          fontSize: 12.5,
          color: "#EF4444",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <span>⚠ Could not reach live backend — displaying fallback optimization data ({error}).</span>
        </div>
      )}

      {loading && (
        <div style={{
          background: "var(--gf-teal-soft)",
          border: "1px solid var(--gf-line)",
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 18,
          fontSize: 12.5,
          color: "var(--gf-ink)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <span style={{
            width: 14,
            height: 14,
            border: "2px solid #0D9488",
            borderTopColor: "transparent",
            borderRadius: "50%",
            display: "inline-block",
            animation: "gfSpin 0.75s linear infinite",
          }} />
          <span>Synchronizing operational alerts from optimization solver...</span>
          <style>{`@keyframes gfSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Top Summary Cards Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
        gap: 14,
        marginBottom: 24,
      }}>
        {/* High Priority Card */}
        <div
          onClick={() => setFilter("high")}
          style={{
            background: "var(--gf-card)",
            border: filter === "high" ? "1.5px solid #EF4444" : "1px solid var(--gf-line)",
            borderRadius: 10,
            padding: "16px 20px",
            cursor: "pointer",
            boxShadow: filter === "high" ? "0 0 12px rgba(239, 68, 68, 0.2)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              High Priority
            </span>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: counts.high > 0 ? "#EF4444" : "var(--gf-line-medium)",
              boxShadow: counts.high > 0 ? "0 0 8px #EF4444" : "none",
            }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--gf-ink)", fontFamily: "'JetBrains Mono', monospace" }}>
              {counts.high}
            </span>
            <span style={{ fontSize: 12, color: "var(--gf-muted)" }}>active alerts</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--gf-faint)", marginTop: 6 }}>
            Constraint breaches & severe delays
          </div>
        </div>

        {/* Medium Priority Card */}
        <div
          onClick={() => setFilter("medium")}
          style={{
            background: "var(--gf-card)",
            border: filter === "medium" ? "1.5px solid #F59E0B" : "1px solid var(--gf-line)",
            borderRadius: 10,
            padding: "16px 20px",
            cursor: "pointer",
            boxShadow: filter === "medium" ? "0 0 12px rgba(245, 158, 11, 0.2)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Medium Priority
            </span>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: counts.medium > 0 ? "#F59E0B" : "var(--gf-line-medium)",
            }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--gf-ink)", fontFamily: "'JetBrains Mono', monospace" }}>
              {counts.medium}
            </span>
            <span style={{ fontSize: 12, color: "var(--gf-muted)" }}>active warnings</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--gf-faint)", marginTop: 6 }}>
            Feasibility & speed margin warnings
          </div>
        </div>

        {/* Informational Card */}
        <div
          onClick={() => setFilter("info")}
          style={{
            background: "var(--gf-card)",
            border: filter === "info" ? "1.5px solid #0EA5E9" : "1px solid var(--gf-line)",
            borderRadius: 10,
            padding: "16px 20px",
            cursor: "pointer",
            boxShadow: filter === "info" ? "0 0 12px rgba(14, 165, 233, 0.2)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0EA5E9", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Informational
            </span>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: counts.info > 0 ? "#0EA5E9" : "var(--gf-line-medium)",
            }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "var(--gf-ink)", fontFamily: "'JetBrains Mono', monospace" }}>
              {counts.info}
            </span>
            <span style={{ fontSize: 12, color: "var(--gf-muted)" }}>active updates</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--gf-faint)", marginTop: 6 }}>
            Optimizer runs & system events
          </div>
        </div>

        {/* System Monitoring Card */}
        <div style={{
          background: "var(--gf-card)",
          border: "1px solid var(--gf-line)",
          borderRadius: 10,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Fleet Telemetry
            </span>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#10B981",
              boxShadow: "0 0 8px rgba(16, 185, 129, 0.8)",
            }} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gf-ink)", marginTop: 4 }}>
              Active Continuous Monitor
            </div>
            <div style={{ fontSize: 11, color: "var(--gf-muted)", marginTop: 4 }}>
              {counts.activeTotal} active · {counts.acknowledged} acknowledged
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
        flexWrap: "wrap",
        gap: 12,
        background: "var(--gf-card)",
        border: "1px solid var(--gf-line)",
        borderRadius: 10,
        padding: "10px 16px",
      }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All Alerts", count: counts.total },
            { id: "active", label: "Active Only", count: counts.activeTotal },
            { id: "high", label: "High Priority", count: counts.high },
            { id: "medium", label: "Medium", count: counts.medium },
            { id: "info", label: "Informational", count: counts.info },
          ].map(tab => {
            const isSelected = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as typeof filter)}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  borderRadius: 6,
                  border: isSelected ? "1.5px solid #0D9488" : "1px solid var(--gf-line)",
                  background: isSelected ? "var(--gf-teal-soft)" : "transparent",
                  color: isSelected ? "#0D9488" : "var(--gf-ink)",
                  cursor: "pointer",
                  fontWeight: isSelected ? 700 : 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease",
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  fontSize: 10.5,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: isSelected ? "rgba(13, 148, 136, 0.2)" : "var(--gf-row-alt)",
                  color: isSelected ? "#0D9488" : "var(--gf-muted)",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {counts.activeTotal > 0 && (
          <button
            onClick={handleAcknowledgeAll}
            style={{
              background: "transparent",
              border: "1px solid var(--gf-line-medium)",
              color: "var(--gf-ink)",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#0D9488";
              (e.currentTarget as HTMLButtonElement).style.color = "#0D9488";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--gf-line-medium)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--gf-ink)";
            }}
          >
            <span>✓ Acknowledge All Active</span>
          </button>
        )}
      </div>

      {/* Alerts Content */}
      {filtered.length === 0 && !loading ? (
        <div style={{
          background: "var(--gf-card)",
          border: "1px solid var(--gf-line)",
          borderRadius: 12,
          padding: "50px 24px",
          textAlign: "center",
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(16, 185, 129, 0.12)",
            color: "#10B981",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 16px",
            fontSize: 24,
          }}>
            ✓
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gf-ink)", marginBottom: 6 }}>
            No Alerts in this Category
          </div>
          <div style={{ fontSize: 13, color: "var(--gf-muted)", maxWidth: 380, margin: "0 auto" }}>
            All vessel routes, speed curves, bunkering schedules, and environmental constraints are operating smoothly.
          </div>
        </div>
      ) : (
        <div>
          {/* High Priority Section */}
          {highAlerts.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 700,
                color: "#EF4444",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 12,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444", boxShadow: "0 0 6px #EF4444" }} />
                <span>High Priority ({highAlerts.length})</span>
              </div>
              {highAlerts.map(a => <AlertCard key={a.id} alert={a} onAck={acknowledge} />)}
            </div>
          )}

          {/* Medium Priority Section */}
          {mediumAlerts.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 700,
                color: "#F59E0B",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 12,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
                <span>Medium Priority Warnings ({mediumAlerts.length})</span>
              </div>
              {mediumAlerts.map(a => <AlertCard key={a.id} alert={a} onAck={acknowledge} />)}
            </div>
          )}

          {/* Informational Section */}
          {infoAlerts.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 700,
                color: "#0EA5E9",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 12,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0EA5E9" }} />
                <span>Informational & System Updates ({infoAlerts.length})</span>
              </div>
              {infoAlerts.map(a => <AlertCard key={a.id} alert={a} onAck={acknowledge} />)}
            </div>
          )}
        </div>
      )}

      {/* Fleet Monitoring Context Box */}
      <div style={{
        marginTop: 20,
        background: "var(--gf-card)",
        border: "1px solid var(--gf-line)",
        borderRadius: 10,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "var(--gf-teal-soft)",
            display: "grid",
            placeItems: "center",
            color: "#0D9488",
            fontSize: 18,
          }}>
            ⚓
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gf-ink)" }}>
              Automated Mathematical Constraint Engine
            </div>
            <div style={{ fontSize: 11.5, color: "var(--gf-muted)", marginTop: 2 }}>
              Alerts are derived dynamically from feasibility checkers, IMO 2030 CII limits, and XGBoost momentary fuel thresholds.
            </div>
          </div>
        </div>

        <span style={{
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          color: "var(--gf-muted)",
          padding: "4px 9px",
          borderRadius: 5,
          background: "var(--gf-row-alt)",
          border: "1px solid var(--gf-line)",
        }}>
          STATUS: OPERATIONAL
        </span>
      </div>

    </div>
  );
}
