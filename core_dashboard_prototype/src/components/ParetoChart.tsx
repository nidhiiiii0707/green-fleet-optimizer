import React, { useState } from "react";
import type { ParetoSolution } from "../api/types";

export type AxisKey = "cost" | "ghg" | "fuel";

interface Props {
  solutions: ParetoSolution[];
  selectedId: string;
  onSelect: (id: string) => void;
  filteredIds: Set<string>;
  liveFront: ParetoSolution[];
  axisIdx: number;
  onAxisChange: (i: number) => void;
}

export const AXIS_LABELS: Record<AxisKey, string> = {
  cost: "Operating Cost ($M)",
  ghg:  "Lifecycle GHG (kgCO₂)",
  fuel: "Fuel Consumption (t)",
};

export const AXIS_PAIRS: { x: AxisKey; y: AxisKey; label: string }[] = [
  { x: "cost", y: "ghg",  label: "Cost ↔ GHG"  },
  { x: "fuel", y: "cost", label: "Fuel ↔ Cost"  },
  { x: "fuel", y: "ghg",  label: "Fuel ↔ GHG"  },
];

const PAD = { top: 32, right: 32, bottom: 54, left: 76 };
const W = 560, H = 340;
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

// Engineering teal accent
const TEAL = "#0A6C70";
const AMBER = "#B45309";

function mapVal(val: number, min: number, max: number, out0: number, out1: number) {
  if (max === min) return out0;
  return out0 + ((val - min) / (max - min)) * (out1 - out0);
}

function fmtVal(v: number, key: AxisKey) {
  if (key === "cost") return `$${v.toFixed(2)}M`;
  return `${(v / 1000).toFixed(1)}k`;
}

export default function ParetoChart({
  solutions, selectedId, onSelect, filteredIds, liveFront, axisIdx, onAxisChange,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const pair = AXIS_PAIRS[axisIdx];
  const xKey = pair.x, yKey = pair.y;

  if (solutions.length === 0) {
    return (
      <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#9A9793", fontSize: 11 }}>
        No solutions available from the latest optimization result.
      </div>
    );
  }

  const allX = solutions.map(s => s[xKey] as number);
  const allY = solutions.map(s => s[yKey] as number);
  const xMin = Math.min(...allX) * 0.96;
  const xMax = Math.max(...allX) * 1.04;
  const yMin = Math.min(...allY) * 0.95;
  const yMax = Math.max(...allY) * 1.04;

  function svgPt(x: number, y: number) {
    return {
      sx: PAD.left + mapVal(x, xMin, xMax, 0, PLOT_W),
      sy: PAD.top  + mapVal(y, yMax, yMin, 0, PLOT_H),
    };
  }
  function solPt(s: ParetoSolution) {
    return svgPt(s[xKey] as number, s[yKey] as number);
  }

  const baseSols = solutions.filter(s => s.pareto).sort((a, b) => (a[xKey] as number) - (b[xKey] as number));
  const basePts  = baseSols.map(s => solPt(s));
  const basePath = basePts.length > 1 ? "M " + basePts.map(p => `${p.sx},${p.sy}`).join(" L ") : "";

  const liveSorted = [...liveFront].sort((a, b) => (a[xKey] as number) - (b[xKey] as number));
  const livePts    = liveSorted.map(s => solPt(s));
  const livePath   = livePts.length > 1 ? "M " + livePts.map(p => `${p.sx},${p.sy}`).join(" L ") : "";
  const liveActive = filteredIds.size < solutions.length && livePts.length > 0;

  const xTicks = 5, yTicks = 4;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Axis selector */}
      <div style={{ display: "flex", gap: 1, marginBottom: 10, flexShrink: 0 }}>
        {AXIS_PAIRS.map((ap, i) => (
          <button
            key={i}
            onClick={() => onAxisChange(i)}
            style={{
              padding: "4px 12px", fontSize: 10, border: "1px solid",
              borderColor: i === axisIdx ? TEAL : "#E4E2DE",
              background: i === axisIdx ? TEAL : "white",
              color: i === axisIdx ? "white" : "#6A6763",
              cursor: "pointer",
              fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: i === axisIdx ? 600 : 400,
              letterSpacing: "0.02em",
            }}
          >
            {ap.label}
          </button>
        ))}
        {filteredIds.size < solutions.length && (
          <span style={{
            marginLeft: "auto", fontSize: 9, color: AMBER,
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
            background: "#FFFBEB", padding: "3px 8px",
            border: "1px solid #FDE68A", alignSelf: "center",
          }}>
            {filteredIds.size}/{solutions.length} visible · live front active
          </span>
        )}
      </div>

      {/* SVG chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ overflow: "visible" }}>

          {/* Grid — very light, restrained */}
          {Array.from({ length: xTicks + 1 }, (_, i) => {
            const x = PAD.left + (i / xTicks) * PLOT_W;
            const v = xMin + (i / xTicks) * (xMax - xMin);
            return (
              <g key={`xg-${i}`}>
                <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + PLOT_H}
                  stroke={i === 0 ? "#D4D2CE" : "#ECEAE5"} strokeWidth={i === 0 ? "1" : "0.75"} />
                <text x={x} y={PAD.top + PLOT_H + 14} textAnchor="middle" fontSize="8.5"
                  fill="#9A9793" fontFamily="'JetBrains Mono', monospace">
                  {fmtVal(v, xKey)}
                </text>
              </g>
            );
          })}
          {Array.from({ length: yTicks + 1 }, (_, i) => {
            const y = PAD.top + (i / yTicks) * PLOT_H;
            const v = yMax - (i / yTicks) * (yMax - yMin);
            return (
              <g key={`yg-${i}`}>
                <line x1={PAD.left} y1={y} x2={PAD.left + PLOT_W} y2={y}
                  stroke={i === yTicks ? "#D4D2CE" : "#ECEAE5"} strokeWidth={i === yTicks ? "1" : "0.75"} />
                <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="8.5"
                  fill="#9A9793" fontFamily="'JetBrains Mono', monospace">
                  {fmtVal(v, yKey)}
                </text>
              </g>
            );
          })}

          {/* Axis borders */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} stroke="#C4C2BE" strokeWidth="1" />
          <line x1={PAD.left} y1={PAD.top + PLOT_H} x2={PAD.left + PLOT_W} y2={PAD.top + PLOT_H} stroke="#C4C2BE" strokeWidth="1" />

          {/* Axis labels */}
          <text x={PAD.left + PLOT_W / 2} y={H - 8} textAnchor="middle" fontSize="9.5"
            fill="#6A6763" fontFamily="'Instrument Sans', sans-serif" fontWeight="500">
            {AXIS_LABELS[xKey]}
          </text>
          <text x={13} y={PAD.top + PLOT_H / 2} textAnchor="middle" fontSize="9.5"
            fill="#6A6763" fontFamily="'Instrument Sans', sans-serif" fontWeight="500"
            transform={`rotate(-90, 13, ${PAD.top + PLOT_H / 2})`}>
            {AXIS_LABELS[yKey]}
          </text>

          {/* ── Baseline Pareto front — solid teal ── */}
          {basePath && (
            <path d={basePath} fill="none" stroke={TEAL} strokeWidth="1.25"
              opacity={liveActive ? 0.3 : 0.75} />
          )}

          {/* ── Live (filtered) front — amber ── */}
          {liveActive && livePath && (
            <path d={livePath} fill="none" stroke={AMBER} strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          )}

          {/* ── Dominated solutions ── */}
          {solutions.filter(s => !s.pareto).map(s => {
            const { sx, sy } = solPt(s);
            const inFilter = filteredIds.has(s.id);
            return (
              <circle key={s.id} cx={sx} cy={sy} r="3"
                fill="white" stroke={inFilter ? "#C4C2BE" : "#E4E2DE"}
                strokeWidth="1"
                opacity={inFilter ? 0.9 : 0.3}
                style={{ cursor: inFilter ? "pointer" : "default" }}
                onClick={() => inFilter && onSelect(s.id)}
                onMouseEnter={() => inFilter && setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}

          {/* ── Pareto-optimal solutions ── */}
          {solutions.filter(s => s.pareto).map(s => {
            const { sx, sy } = solPt(s);
            const isSelected = s.id === selectedId;
            const isHovered  = s.id === hovered;
            const inFilter   = filteredIds.has(s.id);
            const onLive     = liveActive && liveFront.some(l => l.id === s.id);
            const dotColor   = onLive ? AMBER : TEAL;

            return (
              <g
                key={s.id}
                style={{ cursor: inFilter ? "pointer" : "default" }}
                opacity={inFilter ? 1 : 0.18}
                onClick={() => inFilter && onSelect(s.id)}
                onMouseEnter={() => inFilter && setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Crosshair for selected solution */}
                {isSelected && inFilter && (
                  <>
                    <line x1={PAD.left} y1={sy} x2={sx - 8} y2={sy}
                      stroke={dotColor} strokeWidth="0.75" strokeDasharray="3 3" opacity="0.5" />
                    <line x1={sx + 8} y1={sy} x2={PAD.left + PLOT_W} y2={sy}
                      stroke={dotColor} strokeWidth="0.75" strokeDasharray="3 3" opacity="0.5" />
                    <line x1={sx} y1={PAD.top} x2={sx} y2={sy - 8}
                      stroke={dotColor} strokeWidth="0.75" strokeDasharray="3 3" opacity="0.5" />
                    <line x1={sx} y1={sy + 8} x2={sx} y2={PAD.top + PLOT_H}
                      stroke={dotColor} strokeWidth="0.75" strokeDasharray="3 3" opacity="0.5" />
                    {/* Axis value callouts */}
                    <rect x={sx - 22} y={PAD.top + PLOT_H + 1} width={44} height={13} fill={dotColor} />
                    <text x={sx} y={PAD.top + PLOT_H + 10} textAnchor="middle" fontSize="7.5"
                      fill="white" fontFamily="'JetBrains Mono', monospace" fontWeight="500">
                      {fmtVal(s[xKey] as number, xKey)}
                    </text>
                    <rect x={PAD.left - 46} y={sy - 6} width={42} height={13} fill={dotColor} />
                    <text x={PAD.left - 25} y={sy + 4} textAnchor="middle" fontSize="7.5"
                      fill="white" fontFamily="'JetBrains Mono', monospace" fontWeight="500">
                      {fmtVal(s[yKey] as number, yKey)}
                    </text>
                  </>
                )}

                {/* Point: outer ring for selected */}
                {isSelected && (
                  <circle cx={sx} cy={sy} r={11}
                    fill="none" stroke={dotColor} strokeWidth="1" opacity="0.3" />
                )}

                {/* Main dot */}
                <circle cx={sx} cy={sy}
                  r={isSelected ? 5.5 : isHovered ? 5 : 4}
                  fill={isSelected ? dotColor : "white"}
                  stroke={dotColor}
                  strokeWidth={isSelected ? 0 : 1.5}
                />

                {/* Center dot for selected */}
                {isSelected && (
                  <circle cx={sx} cy={sy} r={1.5} fill="white" />
                )}

                {/* Label above selected */}
                {isSelected && (
                  <text x={sx} y={sy - 15} textAnchor="middle" fontSize="8"
                    fontWeight="600" fill={dotColor}
                    fontFamily="'Instrument Sans', sans-serif">
                    {s.label}
                  </text>
                )}

                {/* Hover tooltip */}
                {isHovered && !isSelected && (
                  <g>
                    <rect x={sx - 54} y={sy - 44} width="108" height="34" fill="#1A1918" opacity="0.92" />
                    <text x={sx} y={sy - 30} textAnchor="middle" fontSize="8.5"
                      fontWeight="600" fill="white" fontFamily="'Instrument Sans', sans-serif">
                      {s.label}
                    </text>
                    <text x={sx} y={sy - 17} textAnchor="middle" fontSize="7.5"
                      fill="#9A9793" fontFamily="'JetBrains Mono', monospace">
                      {fmtVal(s[xKey] as number, xKey)} · {fmtVal(s[yKey] as number, yKey)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Legend */}
          <text x={PAD.left + 6} y={PAD.top + 12} fontSize="8" fill={TEAL}
            fontFamily="'Instrument Sans', sans-serif" fontWeight="600" opacity="0.75">
            — Pareto front
          </text>
          {liveActive && (
            <text x={PAD.left + 6} y={PAD.top + 24} fontSize="8" fill={AMBER}
              fontFamily="'Instrument Sans', sans-serif" fontWeight="700">
              — Live front (filtered)
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
