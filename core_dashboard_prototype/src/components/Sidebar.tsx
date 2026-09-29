import React from "react";

type Screen = "overview" | "fleet" | "optimization" | "fleetplan" | "scenarios" | "alerts" | "reports";

interface Props {
  current: Screen;
  onNav: (s: Screen) => void;
  alertCount: number;
  runId?: string | null;
}

const NAV = [
  { id: "overview",     label: "Overview",       icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "fleet",        label: "Fleet & Routes",  icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
  { id: "optimization", label: "Optimization",    icon: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" },
  { id: "scenarios",    label: "What-If Scenarios", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
  { id: "reports",      label: "Reports & Logs",   icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
] as { id: Screen; label: string; icon: string }[];

const BOTTOM = [
  { id: "alerts",  label: "Operational Alerts", icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
  { id: "reports", label: "System Config",      icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
] as { id: Screen; label: string; icon: string }[];

// High-contrast tokens for sidebar
const SB = {
  bg:          "#08161D",
  borderColor: "#17313A",
  text:        "#8FAAB0",
  textHover:   "#D4E6EA",
  textActive:  "#F1F7F6",
  activeBg:    "rgba(13, 148, 136, 0.15)",
  accentTeal:  "#0D9488",
};

export default function Sidebar({ current, onNav, alertCount, runId }: Props) {
  return (
    <aside style={{
      width: 185, minWidth: 185,
      background: SB.bg,
      display: "flex", flexDirection: "column",
      height: "100vh", flexShrink: 0,
      borderRight: `1px solid ${SB.borderColor}`,
    }}>

      {/* Logo / Product identity */}
      <div style={{ padding: "16px 14px", borderBottom: `1px solid ${SB.borderColor}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 26, height: 26,
            background: "linear-gradient(135deg, #0EA5E9 0%, #0D9488 100%)",
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(13, 148, 136, 0.4)",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l3-8 3 4 3-6 3 5 3-4 3 6" />
              <path d="M3 21h18" />
            </svg>
          </div>
          <div>
            <div style={{
              fontSize: 12.5, fontWeight: 750, color: "#F1F7F6",
              fontFamily: "'Instrument Sans', sans-serif",
              letterSpacing: "0.04em", textTransform: "uppercase",
            }}>
              GreenFleet
            </div>
            <div style={{ fontSize: 9, color: SB.text, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 2 }}>
              AI Optimization
            </div>
          </div>
        </div>
      </div>

      {/* Active run indicator */}
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${SB.borderColor}`, background: "rgba(0, 0, 0, 0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: runId ? "#22C55E" : "#6A6763", flexShrink: 0, boxShadow: runId ? "0 0 6px #22C55E" : "none" }} />
          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: SB.textHover, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
            {runId ? `RUN ${runId}` : "Solver Ready"}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 9.5, color: "#22C55E", fontWeight: 600, flexShrink: 0 }}>
            {runId ? "Active" : ""}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "10px 8px 0", overflowY: "auto" }}>
        <div style={{
          fontSize: 10, color: SB.text, textTransform: "uppercase",
          letterSpacing: "0.1em", padding: "8px 10px 6px", fontWeight: 700,
        }}>
          Navigation
        </div>
        {NAV.map(item => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", border: "none", cursor: "pointer", marginBottom: 2,
                borderRadius: 6,
                background: active ? SB.activeBg : "transparent",
                color: active ? SB.textActive : SB.text,
                fontSize: 12,
                fontWeight: active ? 650 : 500,
                fontFamily: "'Instrument Sans', sans-serif",
                textAlign: "left",
                borderLeft: active ? `3px solid ${SB.accentTeal}` : "3px solid transparent",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.color = SB.textHover;
                  el.style.background = "rgba(255, 255, 255, 0.05)";
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.color = SB.text;
                  el.style.background = "transparent";
                }
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div style={{ padding: "8px 8px 12px", borderTop: `1px solid ${SB.borderColor}` }}>
        {BOTTOM.map(item => {
          const active = current === item.id;
          return (
            <button
              key={item.label}
              onClick={() => onNav(item.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", border: "none", cursor: "pointer", marginBottom: 2,
                borderRadius: 6,
                background: active ? SB.activeBg : "transparent",
                color: active ? SB.textActive : SB.text,
                fontSize: 12,
                fontWeight: active ? 650 : 500,
                fontFamily: "'Instrument Sans', sans-serif",
                textAlign: "left",
                borderLeft: active ? `3px solid ${SB.accentTeal}` : "3px solid transparent",
                transition: "all 0.15s ease",
                position: "relative",
              }}
              onMouseEnter={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.color = SB.textHover;
                  el.style.background = "rgba(255, 255, 255, 0.05)";
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.color = SB.text;
                  el.style.background = "transparent";
                }
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              <span>{item.label}</span>
              {item.id === "alerts" && alertCount > 0 && (
                <span style={{
                  marginLeft: "auto",
                  background: "#EF4444", color: "white",
                  fontSize: 10, fontWeight: 700,
                  padding: "1px 6px", minWidth: 16, borderRadius: 10,
                  textAlign: "center", fontFamily: "'JetBrains Mono', monospace",
                  boxShadow: "0 0 6px rgba(239, 68, 68, 0.6)",
                }}>
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}

        {/* User profile */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 10px 4px", marginTop: 6,
          borderTop: `1px solid ${SB.borderColor}`,
        }}>
          <div style={{
            width: 24, height: 24,
            background: "linear-gradient(135deg, #0EA5E9, #0D9488)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10.5, fontWeight: 700, color: "white",
            flexShrink: 0, fontFamily: "'Instrument Sans', sans-serif",
          }}>
            AK
          </div>
          <div>
            <div style={{ fontSize: 11, color: SB.textHover, fontWeight: 600, fontFamily: "'Instrument Sans', sans-serif" }}>Alex Kim</div>
            <div style={{ fontSize: 9, color: SB.text, marginTop: 1 }}>Fleet Operations</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
