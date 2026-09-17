// API base URL — override with VITE_API_URL env variable
export const API_BASE = (import.meta as any).env?.VITE_API_URL ?? "http://127.0.0.1:8124";
export const WS_BASE  = API_BASE.replace(/^http/, "ws");

// Google Maps JavaScript API key — set VITE_GOOGLE_MAPS_API_KEY in .env.local.
// Never hardcode a real key here. Empty/undefined means the map falls back
// to an explicit "not configured" state rather than failing silently.
export const GOOGLE_MAPS_API_KEY: string = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ?? "";
