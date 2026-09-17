import React from "react";

type Screen = "overview" | "fleet" | "optimization" | "fleetplan" | "scenarios" | "alerts" | "reports";

interface RunMeta {
  method: string;
  runId: string;
  feasibleSolutions: number;
  paretoCount: number;
}

interface Props {
  screen: Screen;
  onAlerts: () => void;
  alertCount: number;
  selectedSolutionId: string;
  runMeta: RunMeta | null;
}

function titlesFor(screen: Screen, selectedSolutionId: string, runMeta: RunMeta | null): { title: string; sub: string } {
  const solutionLabel = selectedSolutionId || "no solution selected";
  switch (screen) {
    case "overview":
      return {
        title: "Fleet Optimization Overview",
        sub: runMeta
          ? `${solutionLabel} · ${runMeta.method} · Run ${runMeta.runId}`
          : "No optimization result loaded yet",
      };
    case "fleet":
      return { title: "Fleet & Routes", sub: "Vessel assignments, routes and operational status" };
    case "optimization":
      return {
        title: "Optimization Results",
        sub: runMeta
          ? `Pareto-optimal fleet deployment plans — ${runMeta.paretoCount} solutions`
          : "No optimization result loaded yet",
      };
    case "fleetplan":
      return {
        title: `Optimized Fleet Plan — ${solutionLabel}`,
        sub: "Vessel assignments, routes and constraint status",
      };
    case "scenarios":
      return { title: "What-If Scenario Analysis", sub: "Assess changes in operating conditions against the baseline plan" };
    case "alerts":
      return { title: "Operational Alerts", sub: "Active notifications for fleet, environmental and optimization events" };
    case "reports":
      return { title: "Reports & Exports", sub: "Generate and download compliance and optimization reports" };
  }
}

export default function Header({ screen, onAlerts, alertCount, selectedSolutionId, runMeta }: Props) {
  const { title, sub } = titlesFor(screen, selectedSolutionId, runMeta);
  return (
    <header style={{
      background: "#FFFFFF",
      borderBottom: "1px solid #E4E2DE",
      padding: "0 24px",
      height: 54,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
        <h1 style={{
          margin: 0, fontSize: 14, fontWeight: 600, color: "#1A1918",
          fontFamily: "'Instrument Sans', sans-serif",
          letterSpacing: "-0.01em",
        }}>
          {title}
        </h1>
        <span style={{
          fontSize: 11, color: "#9A9793",
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {sub}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Run status indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: runMeta ? "#15803D" : "#9A9793" }} />
          <span style={{ fontSize: 11, color: "#6A6763", fontFamily: "'JetBrains Mono', monospace" }}>
            {runMeta
              ? `${runMeta.method} · Run ${runMeta.runId} · ${runMeta.feasibleSolutions} evaluated`
              : "No optimization result"}
          </span>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: "#E4E2DE" }} />

        {/* Alert button */}
        <button
          onClick={onAlerts}
          style={{
            position: "relative",
            width: 32, height: 32,
            border: "1px solid #E4E2DE",
            background: "white",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#6A6763",
            transition: "border-color 0.1s, color 0.1s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#0A6C70";
            (e.currentTarget as HTMLButtonElement).style.color = "#0A6C70";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#E4E2DE";
            (e.currentTarget as HTMLButtonElement).style.color = "#6A6763";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {alertCount > 0 && (
            <span style={{
              position: "absolute", top: -5, right: -5,
              background: "#B91C1C", color: "white",
              fontSize: 8, fontWeight: 700,
              padding: "1px 4px", minWidth: 14, height: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {alertCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
