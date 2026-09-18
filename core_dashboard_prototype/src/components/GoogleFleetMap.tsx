import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Port, Route } from "../api/types";
import { isGoogleMapsConfigured, loadGoogleMaps } from "../lib/googleMapsLoader";

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
  highlightRouteIds?: string[];
  onPortClick?: (portId: string) => void;
  selectedPortId?: string | null;
  showAllRoutes?: boolean;
  compact?: boolean;
  vessels?: VesselMarker[];
  onVesselClick?: (vesselId: string) => void;
  selectedVesselId?: string | null;
}

const OCEAN_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#e7e4db" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#595c55" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f4f1e9" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a4050" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#b8b8ae" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export default function GoogleFleetMap({
  ports, routes, highlightRouteIds = [], onPortClick, selectedPortId,
  showAllRoutes = false, compact = false, vessels = [], onVesselClick, selectedVesselId,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const portMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const polylinesRef = useRef<Map<string, google.maps.Polyline>>(new Map());
  const vesselMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "unconfigured" | "error">(
    isGoogleMapsConfigured() ? "loading" : "unconfigured",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const routeIds = useMemo(() => new Set(highlightRouteIds), [highlightRouteIds]);
  const visibleRoutes = useMemo(
    () => routes.filter((route) => showAllRoutes || routeIds.has(route.id)),
    [routes, routeIds, showAllRoutes],
  );
  const portById = useMemo(() => new Map(ports.map((p) => [p.id, p])), [ports]);
  const visiblePortIds = useMemo(() => {
    const ids = new Set<string>();
    visibleRoutes.forEach((r) => { ids.add(r.originId); ids.add(r.destinationId); });
    return ids;
  }, [visibleRoutes]);

  // Load the Maps script and create the map instance once.
  useEffect(() => {
    if (!isGoogleMapsConfigured()) {
      setStatus("unconfigured");
      return;
    }
    // Vite Fast Refresh can preserve refs while resetting component state.
    // Restore the ready state when the live Google map instance survived HMR.
    if (mapRef.current && window.google?.maps) {
      setStatus("ready");
      return;
    }
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        if (mapRef.current) {
          setStatus("ready");
          return;
        }
        mapRef.current = new g.maps.Map(containerRef.current, {
          center: { lat: 20, lng: 60 },
          zoom: 2,
          minZoom: 1,
          disableDefaultUI: compact,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: !compact,
          styles: OCEAN_MAP_STYLE,
        });
        infoWindowRef.current = new g.maps.InfoWindow();
        setStatus("ready");
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setErrorMsg(e.message);
        setStatus("error");
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw ports + routes; fit bounds to what's currently visible.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !window.google) return;
    const g = window.google;
    const map = mapRef.current;

    for (const poly of polylinesRef.current.values()) poly.setMap(null);
    polylinesRef.current.clear();
    for (const marker of portMarkersRef.current.values()) marker.setMap(null);
    portMarkersRef.current.clear();

    const bounds = new g.maps.LatLngBounds();
    let hasBounds = false;

    for (const route of visibleRoutes) {
      const from = portById.get(route.originId);
      const to = portById.get(route.destinationId);
      if (!from || !to) continue;
      const highlighted = routeIds.has(route.id);
      const path = [
        { lat: from.latitude, lng: from.longitude },
        { lat: to.latitude, lng: to.longitude },
      ];
      const polyline = new g.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: highlighted ? "#4ea965" : "#c9b640",
        strokeOpacity: highlighted ? 0.95 : 0.58,
        strokeWeight: highlighted ? 3 : 1.5,
        map,
      });
      polylinesRef.current.set(route.id, polyline);
      bounds.extend(path[0]); bounds.extend(path[1]); hasBounds = true;
    }

    for (const port of ports) {
      if (!visiblePortIds.has(port.id)) continue;
      const selected = port.id === selectedPortId;
      const marker = new g.maps.Marker({
        position: { lat: port.latitude, lng: port.longitude },
        map,
        title: port.name,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: selected ? 8 : 6,
          fillColor: selected ? "#d3a52f" : "#218a63",
          fillOpacity: 1,
          strokeColor: "white",
          strokeWeight: 2,
        },
        zIndex: selected ? 999 : 1,
      });
      marker.addListener("click", () => {
        onPortClick?.(port.id);
        infoWindowRef.current?.setContent(
          `<div style="font:600 12px sans-serif;color:#0F172A">${port.name}</div>` +
          `<div style="font:11px monospace;color:#64748B;margin-top:2px">${port.latitude.toFixed(3)}, ${port.longitude.toFixed(3)}${port.country ? " · " + port.country : ""}</div>` +
          `<div style="font:10px sans-serif;color:#94A3B8;margin-top:2px">${port.coordinateStatus ?? "coordinate status unavailable"}</div>`,
        );
        infoWindowRef.current?.open({ map, anchor: marker });
      });
      portMarkersRef.current.set(port.id, marker);
    }

    if (hasBounds) {
      map.fitBounds(bounds, 40);
    }
  }, [status, visibleRoutes, ports, visiblePortIds, portById, selectedPortId, routeIds, onPortClick]);

  // Vessel markers — repositioned on every simulation tick without
  // recreating the whole map or refitting bounds.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !window.google) return;
    const g = window.google;
    const map = mapRef.current;
    const seen = new Set<string>();

    for (const v of vessels) {
      seen.add(v.id);
      const isSelected = v.id === selectedVesselId;
      const color = v.status === "arrived" ? "#15803D" : "#B45309";
      let marker = vesselMarkersRef.current.get(v.id);
      if (!marker) {
        marker = new g.maps.Marker({
          map,
          icon: {
            path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 4.5,
            rotation: v.heading,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "white",
            strokeWeight: 1.5,
          },
        });
        marker.addListener("click", () => onVesselClick?.(v.id));
        vesselMarkersRef.current.set(v.id, marker);
      }
      marker.setPosition({ lat: v.lat, lng: v.lng });
      marker.setIcon({
        path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: isSelected ? 6.5 : 4.5,
        rotation: v.heading,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: "white",
        strokeWeight: isSelected ? 2.5 : 1.5,
      });
      marker.setZIndex(isSelected ? 1000 : 500);
      marker.setTitle(v.label);
    }

    for (const [id, marker] of vesselMarkersRef.current.entries()) {
      if (!seen.has(id)) {
        marker.setMap(null);
        vesselMarkersRef.current.delete(id);
      }
    }
  }, [status, vessels, selectedVesselId, onVesselClick]);

  // Cleanup markers/polylines on unmount.
  useEffect(() => () => {
    for (const m of portMarkersRef.current.values()) m.setMap(null);
    for (const p of polylinesRef.current.values()) p.setMap(null);
    for (const v of vesselMarkersRef.current.values()) v.setMap(null);
  }, []);

  if (status === "unconfigured") {
    return (
      <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#64748B", fontSize: 12, padding: 16, textAlign: "center" }}>
        Google Maps is not configured. Set VITE_GOOGLE_MAPS_API_KEY in .env.local to enable the map.
      </div>
    );
  }
  if (status === "error") {
    return (
      <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#B91C1C", fontSize: 12, padding: 16, textAlign: "center" }}>
        Could not load Google Maps: {errorMsg}
      </div>
    );
  }
  if (routes.length === 0 || ports.length === 0) {
    return (
      <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#64748B", fontSize: 12 }}>
        No real route coordinates are available from the backend.
      </div>
    );
  }

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      {status === "loading" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.7)", fontSize: 12, color: "#64748B" }}>
          Loading Google Maps…
        </div>
      )}
    </div>
  );
}
