// Loads the Google Maps JavaScript API exactly once per page, using the key
// from VITE_GOOGLE_MAPS_API_KEY (never hardcoded). Used purely as a
// visualization layer — no Directions/Routes/Distance Matrix API calls.
import { GOOGLE_MAPS_API_KEY } from "../api/config";

declare global {
  interface Window {
    google?: typeof google;
    __gmapsLoaderCallback__?: () => void;
  }
}

let loaderPromise: Promise<typeof google> | null = null;

export function isGoogleMapsConfigured(): boolean {
  return GOOGLE_MAPS_API_KEY.trim().length > 0;
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (!isGoogleMapsConfigured()) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not set."));
  }
  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const callbackName = "__gmapsLoaderCallback__";
    window[callbackName] = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps failed to initialize."));
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&callback=${callbackName}&loading=async`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load the Google Maps script."));
    document.head.appendChild(script);
  });

  return loaderPromise;
}
