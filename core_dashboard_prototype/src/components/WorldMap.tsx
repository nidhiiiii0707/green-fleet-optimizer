import React, { useState } from "react";
import { PORTS, ROUTES, Port } from "../data/mock";

interface Props {
  highlightRouteIds?: string[];
  onPortClick?: (portId: string) => void;
  selectedPortId?: string | null;
  vesselPositions?: { id: string; x: number; y: number; name: string; status: string }[];
  onVesselClick?: (vesselId: string) => void;
  selectedVesselId?: string | null;
  showAllRoutes?: boolean;
  compact?: boolean;
}

const CONTINENT_PATHS = [
  // North America
  "M 40,58 L 295,48 L 310,72 L 285,115 L 258,160 L 232,180 L 212,176 L 175,167 L 150,138 L 142,108 L 84,80 Z",
  // Greenland
  "M 272,34 L 402,34 L 402,72 L 318,72 Z",
  // South America
  "M 265,195 L 362,232 L 360,278 L 305,306 L 285,356 L 260,342 L 252,220 Z",
  // Europe
  "M 432,130 L 445,95 L 465,68 L 490,52 L 525,62 L 525,90 L 515,120 L 515,132 L 440,132 Z",
  // Scandinavia extra
  "M 465,68 L 480,50 L 492,56 L 488,70 L 472,76 L 465,68",
  // Africa
  "M 435,132 L 515,145 L 578,192 L 538,282 L 498,306 L 478,258 L 462,208 L 408,188 L 435,158 Z",
  // Arabian Peninsula
  "M 545,142 L 584,132 L 622,146 L 630,172 L 610,192 L 582,190 L 558,178 L 545,162 Z",
  // India
  "M 605,155 L 642,150 L 660,165 L 660,190 L 642,218 L 620,228 L 602,218 L 588,195 L 590,172 Z",
  // Asia (main body)
  "M 525,62 L 605,55 L 680,46 L 762,50 L 838,58 L 870,76 L 870,96 L 842,106 L 815,110 L 790,116 L 775,132 L 758,148 L 728,172 L 710,218 L 695,162 L 660,165 L 642,150 L 605,155 L 590,172 L 558,178 L 545,162 L 530,150 L 515,145 L 525,90 Z",
  // Japan
  "M 802,120 L 820,112 L 822,128 L 812,134 L 800,136 Z",
  // Australia
  "M 730,280 L 800,268 L 852,283 L 860,310 L 847,335 L 822,345 L 796,348 L 768,338 L 748,318 L 738,295 Z",
  // New Zealand
  "M 868,320 L 876,330 L 872,344 L 864,342 L 862,328 Z",
];

function getVesselMidpoint(routeId: string) {
  const route = ROUTES.find(r => r.id === routeId);
  if (!route) return null;
  const from = PORTS.find(p => p.id === route.originId);
  const to = PORTS.find(p => p.id === route.destinationId);
  if (!from || !to) return null;
  // midpoint along quadratic bezier at t=0.5
  const t = 0.5;
  const cx = route.controlX, cy = route.controlY;
  const x = (1-t)*(1-t)*from.x + 2*(1-t)*t*cx + t*t*to.x;
  const y = (1-t)*(1-t)*from.y + 2*(1-t)*t*cy + t*t*to.y;
  return { x, y };
}

export default function WorldMap({
  highlightRouteIds = [],
  onPortClick,
  selectedPortId,
  vesselPositions = [],
  onVesselClick,
  selectedVesselId,
  showAllRoutes = false,
  compact = false,
}: Props) {
  const [hoveredPort, setHoveredPort] = useState<string | null>(null);
  const [hoveredVessel, setHoveredVessel] = useState<string | null>(null);

  const visibleRoutes = showAllRoutes
    ? ROUTES
    : ROUTES.filter(r => highlightRouteIds.includes(r.id));

  const allRoutes = ROUTES;

  const portLabelOffset = (port: Port): { dx: number; dy: number } => {
    const map: Record<string, { dx: number; dy: number }> = {
      RTM: { dx: 0, dy: -10 },
      SGP: { dx: 10, dy: 6 },
      SHA: { dx: 12, dy: -4 },
      LAX: { dx: -8, dy: -10 },
      HOU: { dx: -8, dy: 12 },
      DXB: { dx: 10, dy: 8 },
      YKH: { dx: 8, dy: 10 },
      SYD: { dx: 10, dy: 6 },
      CPT: { dx: 0, dy: 14 },
      STS: { dx: -10, dy: 10 },
      BOM: { dx: -8, dy: 10 },
      PUS: { dx: -10, dy: -8 },
    };
    return map[port.id] ?? { dx: 0, dy: -10 };
  };

  return (
    <svg
      viewBox="0 0 900 440"
      width="100%"
      height="100%"
      style={{ display: "block" }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Ocean */}
      <rect width="900" height="440" fill="#C8DCF0" rx="0" />

      {/* Continents */}
      {CONTINENT_PATHS.map((d, i) => (
        <path key={i} d={d} fill="#C4D4B0" stroke="#AABF96" strokeWidth="0.8" />
      ))}

      {/* Background (all) routes — faint */}
      {showAllRoutes && allRoutes.map(r => {
        const from = PORTS.find(p => p.id === r.originId);
        const to = PORTS.find(p => p.id === r.destinationId);
        if (!from || !to) return null;
        const highlighted = highlightRouteIds.includes(r.id);
        if (highlighted) return null;
        return (
          <path
            key={`bg-${r.id}`}
            d={`M ${from.x} ${from.y} Q ${r.controlX} ${r.controlY} ${to.x} ${to.y}`}
            fill="none"
            stroke="#93B8D4"
            strokeWidth="1"
            strokeDasharray="4 5"
            opacity="0.5"
          />
        );
      })}

      {/* Highlighted routes */}
      {visibleRoutes.map(r => {
        const from = PORTS.find(p => p.id === r.originId);
        const to = PORTS.find(p => p.id === r.destinationId);
        if (!from || !to) return null;
        return (
          <g key={r.id}>
            {/* Shadow */}
            <path
              d={`M ${from.x} ${from.y} Q ${r.controlX} ${r.controlY} ${to.x} ${to.y}`}
              fill="none"
              stroke="#1D4ED8"
              strokeWidth="3"
              opacity="0.12"
            />
            {/* Route line */}
            <path
              d={`M ${from.x} ${from.y} Q ${r.controlX} ${r.controlY} ${to.x} ${to.y}`}
              fill="none"
              stroke="#1D4ED8"
              strokeWidth="1.8"
              opacity="0.8"
              markerEnd="none"
            />
            {/* Direction arrow at midpoint */}
          </g>
        );
      })}

      {/* Vessel positions */}
      {vesselPositions.map(v => {
        const isSelected = v.id === selectedVesselId;
        const isHovered = v.id === hoveredVessel;
        const col = v.status === "warning" ? "#D97706" : v.status === "critical" ? "#DC2626" : "#1D4ED8";
        return (
          <g
            key={v.id}
            transform={`translate(${v.x}, ${v.y})`}
            style={{ cursor: "pointer" }}
            onClick={() => onVesselClick?.(v.id)}
            onMouseEnter={() => setHoveredVessel(v.id)}
            onMouseLeave={() => setHoveredVessel(null)}
          >
            {(isSelected || isHovered) && (
              <circle r="10" fill={col} opacity="0.2" />
            )}
            {/* Ship marker (triangle) */}
            <polygon points="0,-5 4,4 -4,4" fill={isSelected ? "#0F172A" : col} stroke="white" strokeWidth="1.2" />
            {isSelected && (
              <text y="14" textAnchor="middle" fontSize="7" fill="#0F172A" fontFamily="'JetBrains Mono', monospace" fontWeight="600">
                {v.name.replace("MV ", "").substring(0, 10)}
              </text>
            )}
          </g>
        );
      })}

      {/* Port markers */}
      {PORTS.map(port => {
        const isSelected = port.id === selectedPortId;
        const isHovered = port.id === hoveredPort;
        const lbl = portLabelOffset(port);
        const isActive = showAllRoutes || highlightRouteIds.some(rid => {
          const r = ROUTES.find(ro => ro.id === rid);
          return r && (r.originId === port.id || r.destinationId === port.id);
        });
        return (
          <g
            key={port.id}
            style={{ cursor: onPortClick ? "pointer" : "default" }}
            onClick={() => onPortClick?.(port.id)}
            onMouseEnter={() => setHoveredPort(port.id)}
            onMouseLeave={() => setHoveredPort(null)}
          >
            {(isSelected || isHovered) && (
              <circle cx={port.x} cy={port.y} r="10" fill="#1D4ED8" opacity="0.15" />
            )}
            <circle
              cx={port.x}
              cy={port.y}
              r={isSelected ? 6 : 4.5}
              fill={isSelected ? "#1D4ED8" : isActive ? "#1D4ED8" : "#7295B0"}
              stroke="white"
              strokeWidth="1.5"
            />
            {port.shorepower && (
              <circle cx={port.x + 6} cy={port.y - 6} r="3" fill="#059669" stroke="white" strokeWidth="1" />
            )}
            <text
              x={port.x + lbl.dx}
              y={port.y + lbl.dy}
              textAnchor="middle"
              fontSize={isSelected ? "8.5" : "7.5"}
              fontWeight={isSelected ? "700" : "600"}
              fill={isSelected ? "#1D4ED8" : "#1E3A52"}
              fontFamily="'JetBrains Mono', monospace"
              style={{ userSelect: "none" }}
            >
              {port.id}
            </text>
          </g>
        );
      })}

      {/* Tooltip for hovered port */}
      {hoveredPort && (() => {
        const port = PORTS.find(p => p.id === hoveredPort);
        if (!port) return null;
        const lbl = portLabelOffset(port);
        const tx = Math.min(Math.max(port.x, 80), 820);
        const ty = port.y + lbl.dy - 20;
        return (
          <g>
            <rect x={tx - 60} y={ty - 16} width="120" height="32" rx="4" fill="#0F172A" opacity="0.9" />
            <text x={tx} y={ty - 4} textAnchor="middle" fontSize="8" fontWeight="600" fill="white" fontFamily="'DM Sans', sans-serif">{port.name}</text>
            <text x={tx} y={ty + 8} textAnchor="middle" fontSize="7" fill="#94A3B8" fontFamily="sans-serif">{port.country} · {port.capacity} capacity</text>
          </g>
        );
      })()}

      {/* Legend */}
      {!compact && (
        <g transform="translate(14, 14)">
          <rect width="130" height="70" rx="4" fill="white" opacity="0.88" />
          <text x="10" y="18" fontSize="8" fontWeight="700" fill="#334155" fontFamily="'DM Sans', sans-serif">LEGEND</text>
          <circle cx="18" cy="30" r="4" fill="#1D4ED8" stroke="white" strokeWidth="1.5" />
          <text x="26" y="33" fontSize="8" fill="#475569">Active port</text>
          <circle cx="18" cy="44" r="3" fill="#059669" stroke="white" strokeWidth="1" />
          <text x="26" y="47" fontSize="8" fill="#475569">Shore power</text>
          <polygon points="18,52 22,60 14,60" fill="#1D4ED8" stroke="white" strokeWidth="1" />
          <text x="26" y="60" fontSize="8" fill="#475569">Vessel position</text>
        </g>
      )}
    </svg>
  );
}
