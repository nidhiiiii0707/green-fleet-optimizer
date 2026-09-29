import React, { useState } from "react";
import type { ParetoSolution } from "../api/types";

export interface ComparisonChartSeries {
  name: "MO-QIGA" | "NSGA-II" | "MILP Reference";
  color: string;
  solutions: Array<{ id: string; fuel: number; cost: number; ghg: number }>;
}

export type AxisKey = "cost" | "ghg" | "fuel";

interface Props {
  solutions: ParetoSolution[];
  selectedId: string;
  onSelect: (id: string) => void;
  filteredIds: Set<string>;
  liveFront: ParetoSolution[];
  axisIdx: number;
  onAxisChange: (i: number) => void;
  comparisonSeries?: ComparisonChartSeries[];
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
  solutions, selectedId, onSelect, filteredIds, liveFront, axisIdx, onAxisChange, comparisonSeries = [],
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

  const comparisonSolutions = comparisonSeries.flatMap(series => series.solutions);
  const allX = [...solutions.map(s => s[xKey] as number), ...comparisonSolutions.map(s => s[xKey])];
  const allY = [...solutions.map(s => s[yKey] as number), ...comparisonSolutions.map(s => s[yKey])];
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
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexShrink: 0 }}>
        {AXIS_PAIRS.map((ap, i) => (
          <button
            key={i}
            onClick={() => onAxisChange(i)}
            style={{
              padding: "6px 14px", fontSize: 11.5, border: "1px solid",
              borderRadius: 6,
              borderColor: i === axisIdx ? "#0D9488" : "var(--gf-line)",
              background: i === axisIdx ? "var(--gf-teal-soft)" : "var(--gf-card)",
              color: i === axisIdx ? "#2DD4BF" : "var(--gf-muted)",
              cursor: "pointer",
              fontFamily: "'Instrument Sans', sans-serif",
              fontWeight: i === axisIdx ? 700 : 500,
              letterSpacing: "0.02em",
              boxShadow: i === axisIdx ? "0 0 10px rgba(45, 212, 191, 0.2)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            {ap.label}
          </button>
        ))}
        {filteredIds.size < solutions.length && (
          <span style={{
            marginLeft: "auto", fontSize: 10.5, color: AMBER,
            fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
            background: "var(--gf-amber-soft)", padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid rgba(245, 158, 11, 0.3)", alignSelf: "center",
          }}>
            {filteredIds.size}/{solutions.length} visible · live front active
          </span>
        )}
      </div>

      {/* SVG chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ overflow: "visible" }}>

          {/* Grid — light and clean */}
          {Array.from({ length: xTicks + 1 }, (_, i) => {
            const x = PAD.left + (i / xTicks) * PLOT_W;
            const v = xMin + (i / xTicks) * (xMax - xMin);
            return (
              <g key={`xg-${i}`}>
                <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + PLOT_H}
                  stroke={i === 0 ? "var(--gf-axis)" : "var(--gf-grid)"} strokeWidth={i === 0 ? "1" : "0.75"} />
                <text x={x} y={PAD.top + PLOT_H + 16} textAnchor="middle" fontSize="10"
                  fill="var(--gf-muted)" fontFamily="'JetBrains Mono', monospace">
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
                  stroke={i === yTicks ? "var(--gf-axis)" : "var(--gf-grid)"} strokeWidth={i === yTicks ? "1" : "0.75"} />
                <text x={PAD.left - 8} y={y + 3.5} textAnchor="end" fontSize="10"
                  fill="var(--gf-muted)" fontFamily="'JetBrains Mono', monospace">
                  {fmtVal(v, yKey)}
                </text>
              </g>
            );
          })}

          {/* Axis borders */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} stroke="var(--gf-axis)" strokeWidth="1.2" />
          <line x1={PAD.left} y1={PAD.top + PLOT_H} x2={PAD.left + PLOT_W} y2={PAD.top + PLOT_H} stroke="var(--gf-axis)" strokeWidth="1.2" />

          {/* Axis labels */}
          <text x={PAD.left + PLOT_W / 2} y={H - 6} textAnchor="middle" fontSize="11"
            fill="var(--gf-ink)" fontFamily="'Instrument Sans', sans-serif" fontWeight="600">
            {AXIS_LABELS[xKey]}
          </text>
          <text x={12} y={PAD.top + PLOT_H / 2} textAnchor="middle" fontSize="11"
            fill="var(--gf-ink)" fontFamily="'Instrument Sans', sans-serif" fontWeight="600"
            transform={`rotate(-90, 12, ${PAD.top + PLOT_H / 2})`}>
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
                fill="var(--gf-card)" stroke={inFilter ? "var(--gf-line-medium)" : "var(--gf-line)"}
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
                    <rect x={sx - 26} y={PAD.top + PLOT_H + 2} width={52} height={16} rx="3" fill="#0D9488" />
                    <text x={sx} y={PAD.top + PLOT_H + 13.5} textAnchor="middle" fontSize="9.5"
                      fill="white" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
                      {fmtVal(s[xKey] as number, xKey)}
                    </text>
                    <rect x={PAD.left - 54} y={sy - 8} width={48} height={16} rx="3" fill="#0D9488" />
                    <text x={PAD.left - 30} y={sy + 3.5} textAnchor="middle" fontSize="9.5"
                      fill="white" fontFamily="'JetBrains Mono', monospace" fontWeight="700">
                      {fmtVal(s[yKey] as number, yKey)}
                    </text>
                  </>
                )}

                {/* Point: outer ring for selected */}
                {isSelected && (
                  <circle cx={sx} cy={sy} r={12}
                    fill="none" stroke="#2DD4BF" strokeWidth="1.5" opacity="0.4" />
                )}

                {/* Main dot */}
                <circle cx={sx} cy={sy}
                  r={isSelected ? 6 : isHovered ? 5.5 : 4.5}
                  fill={isSelected ? "#2DD4BF" : "var(--gf-card)"}
                  stroke={dotColor}
                  strokeWidth={isSelected ? 0 : 2}
                  style={{ transition: "r 0.15s ease" }}
                />

                {/* Center dot for selected */}
                {isSelected && (
                  <circle cx={sx} cy={sy} r={2} fill="#091419" />
                )}

                {/* Label above selected */}
                {isSelected && (
                  <text x={sx} y={sy - 16} textAnchor="middle" fontSize="10.5"
                    fontWeight="700" fill="#2DD4BF"
                    fontFamily="'Instrument Sans', sans-serif">
                    {s.label}
                  </text>
                )}

                {/* Hover tooltip */}
                {isHovered && !isSelected && (
                  <g>
                    <rect x={sx - 60} y={sy - 48} width="120" height="38" rx="5" fill="#0B1E26" stroke="#2DD4BF" strokeWidth="1" opacity="0.96" />
                    <text x={sx} y={sy - 32} textAnchor="middle" fontSize="10"
                      fontWeight="700" fill="#F1F7F6" fontFamily="'Instrument Sans', sans-serif">
                      {s.label}
                    </text>
                    <text x={sx} y={sy - 18} textAnchor="middle" fontSize="9"
                      fill="#9FB5BA" fontFamily="'JetBrains Mono', monospace">
                      {fmtVal(s[xKey] as number, xKey)} · {fmtVal(s[yKey] as number, yKey)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Algorithm-comparison overlay; primary chart interactions remain unchanged. */}
          {comparisonSeries.flatMap(series => series.solutions.map(solution => {
            const { sx, sy } = svgPt(solution[xKey], solution[yKey]);
            return (
              <g key={`${series.name}-${solution.id}`}>
                {series.name === "MILP Reference" ? (
                  <path d={`M ${sx - 5} ${sy - 5} L ${sx + 5} ${sy + 5} M ${sx + 5} ${sy - 5} L ${sx - 5} ${sy + 5}`} stroke={series.color} strokeWidth="2" />
                ) : (
                  <circle cx={sx} cy={sy} r="4" fill={series.color} stroke="var(--gf-card)" strokeWidth="1" opacity="0.9" />
                )}
              </g>
            );
          }))}

          {/* Legend */}
          <text x={PAD.left + 8} y={PAD.top + 14} fontSize="10" fill="#0D9488"
            fontFamily="'Instrument Sans', sans-serif" fontWeight="700" opacity="0.9">
            — Pareto front
          </text>
          {liveActive && (
            <text x={PAD.left + 8} y={PAD.top + 28} fontSize="10" fill={AMBER}
              fontFamily="'Instrument Sans', sans-serif" fontWeight="700">
              — Live front (filtered)
            </text>
          )}
          {comparisonSeries.map((series, index) => (
            <text key={series.name} x={PAD.left + 130 + index * 105} y={PAD.top + 14} fontSize="9" fill={series.color} fontFamily="'Instrument Sans', sans-serif" fontWeight="700">
              {series.name}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
