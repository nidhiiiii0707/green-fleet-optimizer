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
  { id: "scenarios",    label: "Scenarios",        icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
  { id: "reports",      label: "Reports",          icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
] as { id: Screen; label: string; icon: string }[];

const BOTTOM = [
  { id: "alerts",  label: "Alerts",   icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
  { id: "reports", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
] as { id: Screen; label: string; icon: string }[];

// Design tokens for sidebar
const SB = {
  bg:          "#171614",
  borderColor: "#272421",
  text:        "#8A8784",
  textHover:   "#C4C2BE",
  textActive:  "#E8E6E1",
  activeBg:    "#222020",
  accentTeal:  "#0A6C70",
};

export default function Sidebar({ current, onNav, alertCount, runId }: Props) {
  return (
    <aside style={{
      width: 212, minWidth: 212,
      background: SB.bg,
      display: "flex", flexDirection: "column",
      height: "100vh", flexShrink: 0,
      borderRight: `1px solid ${SB.borderColor}`,
    }}>

      {/* Logo / Product identity */}
      <div style={{ padding: "18px 18px 14px", borderBottom: `1px solid ${SB.borderColor}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 26, height: 26,
            background: SB.accentTeal,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l3-8 3 4 3-6 3 5 3-4 3 6" />
              <path d="M3 21h18" />
            </svg>
          </div>
          <div>
            <div style={{
              fontSize: 12, fontWeight: 700, color: "#E8E6E1",
              fontFamily: "'Instrument Sans', sans-serif",
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}>GreenFleet</div>
            <div style={{ fontSize: 9, color: SB.text, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 1 }}>
              AI · Optimization Platform
            </div>
          </div>
        </div>
      </div>

      {/* Active run indicator */}
      <div style={{ padding: "10px 18px", borderBottom: `1px solid ${SB.borderColor}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: runId ? "#15803D" : "#6A6763", flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: SB.textHover, letterSpacing: "0.05em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {runId ? `RUN ${runId}` : "No run"}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 9, color: SB.text, flexShrink: 0 }}>{runId ? "Completed" : ""}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "8px 8px 0", overflowY: "auto" }}>
        <div style={{
          fontSize: 9, color: SB.text, textTransform: "uppercase",
          letterSpacing: "0.1em", padding: "8px 10px 4px", fontWeight: 600,
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
                width: "100%", display: "flex", alignItems: "center", gap: 9,
                padding: "8px 10px", border: "none", cursor: "pointer", marginBottom: 1,
                background: active ? SB.activeBg : "transparent",
                color: active ? SB.textActive : SB.text,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                fontFamily: "'Instrument Sans', sans-serif",
                textAlign: "left",
                borderLeft: active ? `2px solid ${SB.accentTeal}` : "2px solid transparent",
                transition: "color 0.1s, background 0.1s",
              }}
              onMouseEnter={e => {
                if (!active) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.color = SB.textHover;
                  el.style.background = "#1E1C1A";
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div style={{ padding: "8px 8px 14px", borderTop: `1px solid ${SB.borderColor}` }}>
        {BOTTOM.map(item => {
          const active = current === item.id && item.id === "alerts";
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 9,
                padding: "8px 10px", border: "none", cursor: "pointer", marginBottom: 1,
                background: "transparent",
                color: SB.text,
                fontSize: 12,
                fontFamily: "'Instrument Sans', sans-serif",
                textAlign: "left",
                borderLeft: active ? `2px solid ${SB.accentTeal}` : "2px solid transparent",
                transition: "color 0.1s, background 0.1s",
                position: "relative",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.color = SB.textHover;
                el.style.background = "#1E1C1A";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.color = SB.text;
                el.style.background = "transparent";
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {item.label}
              {item.id === "alerts" && alertCount > 0 && (
                <span style={{
                  marginLeft: "auto",
                  background: "#B91C1C", color: "white",
                  fontSize: 9, fontWeight: 700,
                  padding: "1px 5px", minWidth: 16,
                  textAlign: "center", fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}

        {/* User */}
        <div style={{
          display: "flex", alignItems: "center", gap: 9,
          padding: "10px 10px 0", marginTop: 6,
          borderTop: `1px solid ${SB.borderColor}`,
        }}>
          <div style={{
            width: 24, height: 24,
            background: SB.accentTeal,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 700, color: "white",
            flexShrink: 0, fontFamily: "'Instrument Sans', sans-serif",
            letterSpacing: "0.04em",
          }}>
            AK
          </div>
          <div>
            <div style={{ fontSize: 11, color: SB.textHover, fontWeight: 500, fontFamily: "'Instrument Sans', sans-serif" }}>Alex Kim</div>
            <div style={{ fontSize: 9, color: SB.text, marginTop: 1 }}>Fleet Planner</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
