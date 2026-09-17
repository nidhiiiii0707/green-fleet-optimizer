import React from "react";
import type { SimSpeed, VesselSimulationState } from "../lib/vesselSimulation";

const SPEEDS: SimSpeed[] = [1, 5, 10, 50];

interface Props {
  sim: VesselSimulationState;
  vesselCount: number;
}

export default function VesselSimulationPanel({ sim, vesselCount }: Props) {
  const { t, maxHours, playing, speed, play, pause, reset, setSpeed, seek } = sim;
  const pct = maxHours > 0 ? (t / maxHours) * 100 : 0;
  const done = maxHours > 0 && t >= maxHours;

  return (
    <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 4, padding: "2px 7px", letterSpacing: "0.04em" }}>
          SIMULATION — not live AIS tracking
        </span>
        <span style={{ fontSize: 10, color: "#94A3B8" }}>{vesselCount} vessel{vesselCount === 1 ? "" : "s"} animated</span>
      </div>

      {maxHours === 0 ? (
        <div style={{ fontSize: 11, color: "#94A3B8" }}>
          No assignment in this solution has both real coordinates and a derivable voyage time — nothing to animate.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button
              onClick={playing ? pause : play}
              disabled={done && !playing}
              style={{
                background: playing ? "#D97706" : done ? "#9CA3AF" : "#1D4ED8", color: "white", border: "none",
                borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 700,
                cursor: done && !playing ? "not-allowed" : "pointer",
              }}
            >
              {playing ? "⏸ Pause" : "▶ Play"}
            </button>
            <button
              onClick={reset}
              style={{ background: "white", color: "#475569", border: "1px solid #E2E8F0", borderRadius: 6, padding: "6px 14px", fontSize: 11, cursor: "pointer" }}
            >
              ⟲ Reset
            </button>
            <div style={{ display: "flex", gap: 0, border: "1px solid #E2E8F0", borderRadius: 6, overflow: "hidden", marginLeft: 4 }}>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  style={{
                    padding: "6px 10px", fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer",
                    background: speed === s ? "#1D4ED8" : "white",
                    color: speed === s ? "white" : "#475569",
                    borderLeft: s === 1 ? "none" : "1px solid #E2E8F0",
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
              {t.toFixed(1)}h / {maxHours.toFixed(1)}h {done ? "· all vessels arrived" : ""}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={maxHours}
            step={maxHours / 500 || 1}
            value={t}
            onChange={(e) => seek(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#1D4ED8" }}
          />
          <div style={{ height: 3, background: "#F1F5F9", borderRadius: 2, marginTop: -6, position: "relative", pointerEvents: "none" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#1D4ED8", borderRadius: 2 }} />
          </div>
        </>
      )}
    </div>
  );
}
