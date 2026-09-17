import React, { useMemo, useState } from "react";
import type { Port, Route } from "../api/types";

interface Props {
  ports: Port[];
  routes: Route[];
  highlightRouteIds?: string[];
  onPortClick?: (portId: string) => void;
  selectedPortId?: string | null;
  showAllRoutes?: boolean;
  compact?: boolean;
}

const CONTINENT_PATHS = [
  "M 40,58 L 295,48 L 310,72 L 285,115 L 258,160 L 232,180 L 212,176 L 175,167 L 150,138 L 142,108 L 84,80 Z",
  "M 272,34 L 402,34 L 402,72 L 318,72 Z",
  "M 265,195 L 362,232 L 360,278 L 305,306 L 285,356 L 260,342 L 252,220 Z",
  "M 432,130 L 445,95 L 465,68 L 490,52 L 525,62 L 525,90 L 515,120 L 515,132 L 440,132 Z",
  "M 435,132 L 515,145 L 578,192 L 538,282 L 498,306 L 478,258 L 462,208 L 408,188 L 435,158 Z",
  "M 525,62 L 605,55 L 680,46 L 762,50 L 838,58 L 870,76 L 870,96 L 842,106 L 815,110 L 790,116 L 758,148 L 728,172 L 710,218 L 660,165 L 605,155 L 545,162 L 515,145 L 525,90 Z",
  "M 730,280 L 800,268 L 852,283 L 860,310 L 847,335 L 822,345 L 796,348 L 768,338 L 748,318 L 738,295 Z",
];

export default function WorldMap({
  ports,
  routes,
  highlightRouteIds = [],
  onPortClick,
  selectedPortId,
  showAllRoutes = false,
  compact = false,
}: Props) {
  const [hoveredPort, setHoveredPort] = useState<string | null>(null);
  const routeIds = useMemo(() => new Set(highlightRouteIds), [highlightRouteIds]);
  const visibleRoutes = useMemo(
    () => routes.filter((route) => showAllRoutes || routeIds.has(route.id)),
    [routes, routeIds, showAllRoutes],
  );
  const portById = useMemo(() => new Map(ports.map((port) => [port.id, port])), [ports]);
  const visiblePortIds = useMemo(() => {
    const ids = new Set<string>();
    visibleRoutes.forEach((route) => {
      ids.add(route.originId);
      ids.add(route.destinationId);
    });
    return ids;
  }, [visibleRoutes]);

  if (routes.length === 0 || ports.length === 0) {
    return (
      <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#64748B", fontSize: 12 }}>
        No real route coordinates are available from the backend.
      </div>
    );
  }

  return (
    <svg viewBox="0 0 900 440" width="100%" height="100%" style={{ display: "block" }} role="img" aria-label="Optimization routes plotted from backend latitude and longitude data">
      <rect width="900" height="440" fill="#C8DCF0" />
      {CONTINENT_PATHS.map((path, index) => <path key={index} d={path} fill="#C4D4B0" stroke="#AABF96" strokeWidth="0.8" />)}

      {visibleRoutes.map((route) => {
        const from = portById.get(route.originId);
        const to = portById.get(route.destinationId);
        if (!from || !to) return null;
        const highlighted = routeIds.has(route.id);
        return (
          <path
            key={route.id}
            d={`M ${from.x} ${from.y} Q ${route.controlX} ${route.controlY} ${to.x} ${to.y}`}
            fill="none"
            stroke={highlighted ? "#1D4ED8" : "#7295B0"}
            strokeWidth={highlighted ? 2.4 : 1}
            strokeDasharray={highlighted ? undefined : "4 5"}
            opacity={highlighted ? 0.9 : 0.45}
          />
        );
      })}

      {ports.filter((port) => visiblePortIds.has(port.id)).map((port) => {
        const selected = port.id === selectedPortId;
        const hovered = port.id === hoveredPort;
        return (
          <g
            key={port.id}
            style={{ cursor: onPortClick ? "pointer" : "default" }}
            onClick={() => onPortClick?.(port.id)}
            onMouseEnter={() => setHoveredPort(port.id)}
            onMouseLeave={() => setHoveredPort(null)}
          >
            {(selected || hovered) ? <circle cx={port.x} cy={port.y} r="10" fill="#1D4ED8" opacity="0.18" /> : null}
            <circle cx={port.x} cy={port.y} r={selected ? 6 : 4.5} fill="#1D4ED8" stroke="white" strokeWidth="1.5" />
            <text x={port.x} y={port.y - 9} textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#1E3A52">
              {port.name}
            </text>
          </g>
        );
      })}

      {hoveredPort ? (() => {
        const port = portById.get(hoveredPort);
        if (!port) return null;
        const x = Math.min(Math.max(port.x, 85), 815);
        const y = Math.max(port.y - 42, 25);
        return (
          <g pointerEvents="none">
            <rect x={x - 78} y={y - 16} width="156" height="34" rx="4" fill="#0F172A" opacity="0.92" />
            <text x={x} y={y - 3} textAnchor="middle" fontSize="8" fontWeight="600" fill="white">{port.name}</text>
            <text x={x} y={y + 10} textAnchor="middle" fontSize="7" fill="#CBD5E1">
              {port.latitude.toFixed(3)}, {port.longitude.toFixed(3)}{port.country ? ` · ${port.country}` : ""}
            </text>
          </g>
        );
      })() : null}

      {!compact ? (
        <g transform="translate(14, 14)">
          <rect width="150" height="48" rx="4" fill="white" opacity="0.88" />
          <text x="10" y="17" fontSize="8" fontWeight="700" fill="#334155">REAL / DERIVED DATA</text>
          <circle cx="18" cy="32" r="4" fill="#1D4ED8" stroke="white" strokeWidth="1.5" />
          <text x="28" y="35" fontSize="8" fill="#475569">Port coordinates</text>
        </g>
      ) : null}
    </svg>
  );
}
