import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Assignment, Port, Route } from "../api/types";
import { routeSeaPath } from "../data/seaLanes";
import { seaPointOnPath } from "../data/seaPath";

export interface VesselMarker {
  id: string;
  lat: number;
  lng: number;
  heading: number;
  status: "in-transit" | "arrived";
  label: string;
}

interface Props {
  ports: Port[];
  routes: Route[];
  assignments?: Assignment[];
  highlightRouteIds?: string[];
  selectedRouteId?: string | null;
  onRouteClick?: (routeId: string) => void;
  onPortClick?: (portId: string) => void;
  selectedPortId?: string | null;
  showAllRoutes?: boolean;
  /** Max number of plain alternative routes drawn when showAllRoutes is on (ranked by usage). Defaults to 3. */
  maxAlternativeRoutes?: number;
  compact?: boolean;
  vessels?: VesselMarker[];
  onVesselClick?: (vesselId: string) => void;
  selectedVesselId?: string | null;
}

const ROUTE = { optimal: "#41d36f", alternative: "#d6b93e", warning: "#d97941" };

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
}

function shipIcon(heading: number, selected: boolean, status: string) {
  const color = status === "arrived" ? "#57d58a" : selected ? "#50f2df" : "#75dce0";
  const size = selected ? 34 : 28;
  return L.divIcon({
    className: "gf-vessel-marker",
    iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2],
    html: `<div class="gf-vessel-halo ${selected ? "is-selected" : ""}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 24 24" style="transform:rotate(${heading}deg);width:${size - 8}px;height:${size - 8}px" aria-hidden="true"><path d="M12 2.5 17.5 17 12 21.5 6.5 17 12 2.5Z" fill="${color}" stroke="#e8ffff" stroke-width="1.2"/><path d="M12 7v10M8.8 15.5h6.4" stroke="#07353b" stroke-width="1.15" stroke-linecap="round"/></svg></div>`,
  });
}

function portIcon(selected: boolean) {
  return L.divIcon({
    className: "gf-port-marker",
    iconSize: [selected ? 20 : 16, selected ? 20 : 16],
    iconAnchor: [selected ? 10 : 8, selected ? 10 : 8],
    html: `<span class="${selected ? "is-selected" : ""}"><i></i></span>`,
  });
}

export default function GoogleFleetMap({
  ports, routes, assignments = [], highlightRouteIds = [], selectedRouteId, onRouteClick,
  onPortClick, selectedPortId, showAllRoutes = false, maxAlternativeRoutes = 3, compact = false, vessels = [],
  onVesselClick, selectedVesselId,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dataLayerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const mapAvailable = routes.length > 0 && ports.length > 0;

  const routeIds = useMemo(() => new Set(highlightRouteIds), [highlightRouteIds]);
  const portById = useMemo(() => new Map(ports.map(port => [port.id, port])), [ports]);
  const assignmentById = useMemo(() => new Map(assignments.map(assignment => [assignment.id, assignment])), [assignments]);
  const assignmentByRoute = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    assignments.forEach(assignment => {
      if (!assignment.routeId) return;
      const list = map.get(assignment.routeId) ?? [];
      list.push(assignment); map.set(assignment.routeId, list);
    });
    return map;
  }, [assignments]);
  const usageByRoute = useMemo(() => {
    const map = new Map<string, number>();
    assignments.forEach(assignment => {
      if (!assignment.routeId) return;
      map.set(assignment.routeId, (map.get(assignment.routeId) ?? 0) + 1);
    });
    return map;
  }, [assignments]);
  const visibleRoutes = useMemo(() => {
    const highlighted = routes.filter(route => routeIds.has(route.id) || route.id === selectedRouteId);
    if (!showAllRoutes) return highlighted;
    const highlightedIds = new Set(highlighted.map(route => route.id));
    const rest = routes.filter(route => !highlightedIds.has(route.id));
    const isProblematic = (route: Route) => (assignmentByRoute.get(route.id) ?? [])
      .some(a => a.status === "warning" || a.status === "critical");
    // Congested routes are always kept; plain alternatives are capped to the most-used few.
    const warnings = rest.filter(isProblematic);
    const warningIds = new Set(warnings.map(route => route.id));
    const plain = rest.filter(route => !warningIds.has(route.id));
    plain.sort((a, b) =>
      (usageByRoute.get(b.id) ?? 0) - (usageByRoute.get(a.id) ?? 0) ||
      a.distanceNm - b.distanceNm,
    );
    return [...highlighted, ...warnings, ...plain.slice(0, Math.max(0, maxAlternativeRoutes))];
  }, [routes, routeIds, selectedRouteId, showAllRoutes, assignmentByRoute, usageByRoute, maxAlternativeRoutes]);

  const pathByRoute = useMemo(() => {
    const map = new Map<string, Array<[number, number]>>();
    routes.forEach(route => {
      const from = portById.get(route.originId);
      const to = portById.get(route.destinationId);
      if (from && to) map.set(route.id, routeSeaPath(from, to));
    });
    return map;
  }, [routes, portById]);

  const displayVessels = useMemo(() => {
    if (vessels.length) return vessels;
    return assignments.flatMap((assignment, index) => {
      const from = assignment.originLatitude != null && assignment.originLongitude != null
        ? { latitude: assignment.originLatitude, longitude: assignment.originLongitude }
        : portById.get(assignment.originId);
      const to = assignment.destinationLatitude != null && assignment.destinationLongitude != null
        ? { latitude: assignment.destinationLatitude, longitude: assignment.destinationLongitude }
        : portById.get(assignment.destinationId);
      if (!from || !to) return [];
      const fraction = 0.28 + (index % 4) * 0.13;
      // Sit the vessel ON its drawn route line (snapped to open water), never on the straight chord.
      const path = (assignment.routeId ? pathByRoute.get(assignment.routeId) : undefined) ?? routeSeaPath(from, to);
      const { index: pointIndex, heading } = seaPointOnPath(path, fraction);
      return [{
        id: assignment.id,
        lat: path[pointIndex][0],
        lng: path[pointIndex][1],
        heading,
        status: "in-transit" as const,
        label: assignment.vesselId,
      }];
    });
  }, [assignments, portById, vessels, pathByRoute]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true, minZoom: 2, worldCopyJump: true });
    map.setView([24, 105], 3);
    let fallbackAdded = false;
    // CARTO basemaps now require an API key (their tiles render an
    // "API KEY REQUIRED" watermark), so use Esri's key-free dark basemap.
    const darkTiles = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19,
      attribution: 'Esri, HERE, Garmin, OpenStreetMap contributors',
    }).addTo(map);
    darkTiles.on("tileerror", () => {
      if (fallbackAdded) return;
      fallbackAdded = true;
      console.warn("Dark maritime tiles failed; falling back to OpenStreetMap tiles.");
      darkTiles.remove();
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    });
    dataLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setMapReady(true);
    const resize = new ResizeObserver(() => map.invalidateSize(false));
    resize.observe(containerRef.current);
    return () => { resize.disconnect(); map.remove(); mapRef.current = null; dataLayerRef.current = null; fittedRef.current = false; setMapReady(false); };
  }, [mapAvailable]);

  useEffect(() => {
    const map = mapRef.current; const layer = dataLayerRef.current;
    if (!mapReady || !map || !layer) return;
    layer.clearLayers();
    const bounds = L.latLngBounds([]);
    const activePrimary = selectedRouteId ?? highlightRouteIds[0] ?? null;

    visibleRoutes.forEach(route => {
      const from = portById.get(route.originId); const to = portById.get(route.destinationId);
      if (!from || !to) return;
      const routeAssignments = assignmentByRoute.get(route.id) ?? [];
      const problematic = routeAssignments.some(a => a.status === "warning" || a.status === "critical");
      const selected = route.id === activePrimary;
      const color = problematic ? ROUTE.warning : selected ? ROUTE.optimal : ROUTE.alternative;
      const path = pathByRoute.get(route.id);
      if (!path || path.length < 2) return;
      if (selected) L.polyline(path, { color, weight: 10, opacity: 0.16, interactive: false, lineCap: "round" }).addTo(layer);
      const line = L.polyline(path, { color, weight: selected ? 4 : 2.25, opacity: selected ? 1 : 0.72, lineCap: "round", dashArray: problematic ? "8 6" : undefined }).addTo(layer);
      line.bindTooltip(`<b>${esc(route.name)}</b><br>${route.distanceNm.toLocaleString()} nm<br>${problematic ? "Operational warning" : selected ? "Optimal route" : "Alternative route"}`, { sticky: true, className: "gf-map-tooltip" });
      line.on("click", () => { onRouteClick?.(route.id); map.fitBounds(L.latLngBounds(path as L.LatLngExpression[]), { padding: [38, 38], maxZoom: 7 }); });
      path.forEach(point => bounds.extend(point));
    });

    const portIds = new Set(visibleRoutes.flatMap(route => [route.originId, route.destinationId]));
    ports.filter(port => portIds.has(port.id)).forEach(port => {
      const related = assignments.filter(a => a.originId === port.id || a.destinationId === port.id);
      const eta = related.find(a => a.destinationId === port.id && a.eta)?.eta ?? "Not available";
      const cargo = related.reduce((sum, a) => sum + (a.cargoTons ?? a.cargoTEU ?? 0), 0);
      const marker = L.marker([port.latitude, port.longitude], { icon: portIcon(port.id === selectedPortId), zIndexOffset: 500 }).addTo(layer);
      marker.bindPopup(`<div class="gf-map-popup"><strong>${esc(port.name)}</strong><small>${esc(port.country ?? "Port")}</small><dl><dt>Vessels</dt><dd>${related.length}</dd><dt>ETA</dt><dd>${esc(eta)}</dd><dt>Cargo/load</dt><dd>${cargo ? `${cargo.toLocaleString(undefined, { maximumFractionDigits: 1 })} t` : "Unavailable"}</dd><dt>Coordinates</dt><dd>${port.latitude.toFixed(3)}, ${port.longitude.toFixed(3)}</dd></dl></div>`, { className: "gf-leaflet-popup" });
      marker.on("click", () => onPortClick?.(port.id));
      bounds.extend([port.latitude, port.longitude]);
    });

    displayVessels.forEach(vessel => {
      const assignment = assignmentById.get(vessel.id);
      const route = assignment?.routeId ? routes.find(item => item.id === assignment.routeId) : undefined;
      const selected = vessel.id === selectedVesselId || (!!selectedRouteId && assignment?.routeId === selectedRouteId);
      const marker = L.marker([vessel.lat, vessel.lng], { icon: shipIcon(vessel.heading, selected, vessel.status), zIndexOffset: selected ? 1100 : 900 }).addTo(layer);
      marker.bindPopup(`<div class="gf-map-popup vessel"><strong>⚓ ${esc(vessel.label)}</strong><small>${esc(assignment?.vesselType ?? "Fleet vessel")}</small><dl><dt>Route</dt><dd>${esc(route?.name ?? assignment?.routeName ?? "Unavailable")}</dd><dt>Distance</dt><dd>${route?.distanceNm != null ? `${route.distanceNm.toLocaleString()} nm` : "Unavailable"}</dd><dt>Speed</dt><dd>${assignment?.speed != null ? `${assignment.speed} kn` : "Unavailable"}</dd><dt>Fuel</dt><dd>${assignment?.fuelConsumption != null ? `${assignment.fuelConsumption.toLocaleString()} t` : "Unavailable"}</dd><dt>ETA</dt><dd>${esc(assignment?.eta ?? "Unavailable")}</dd><dt>Status</dt><dd class="status">${esc(assignment?.status ?? vessel.status)}</dd></dl></div>`, { className: "gf-leaflet-popup" });
      marker.bindTooltip(esc(vessel.label), { direction: "top", offset: [0, -12], className: "gf-map-tooltip" });
      marker.on("click", () => onVesselClick?.(vessel.id));
    });

    if (selectedRouteId) {
      const selected = routes.find(route => route.id === selectedRouteId);
      const selectedPath = selected ? pathByRoute.get(selected.id) : undefined;
      if (selectedPath) map.fitBounds(L.latLngBounds(selectedPath as L.LatLngExpression[]), { padding: [35, 35], maxZoom: 7 });
    } else if (!fittedRef.current && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: compact ? 5 : 6 }); fittedRef.current = true;
    }
  }, [assignmentById, assignmentByRoute, assignments, compact, displayVessels, highlightRouteIds, mapReady, onPortClick, onRouteClick, onVesselClick, pathByRoute, portById, ports, routes, selectedPortId, selectedRouteId, selectedVesselId, visibleRoutes]);

  if (!mapAvailable) {
    return <div className="gf-map-empty">No real route coordinates are available from the backend.</div>;
  }

  return (
    <div className="gf-maritime-map-shell">
      <div ref={containerRef} className="gf-maritime-map" />
      <div className="gf-map-legend">
        <strong>Legend</strong><span><i style={{ background: ROUTE.optimal }} />Optimal route</span><span><i style={{ background: ROUTE.alternative }} />Alternative route</span><span><i style={{ background: ROUTE.warning }} />Congested route</span><span className="ship">◆ Vessel</span><span className="port">● Port</span>
      </div>
    </div>
  );
}
