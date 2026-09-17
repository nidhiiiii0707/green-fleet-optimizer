// Deterministic vessel-movement simulation driven by real port coordinates
// and the optimizer's modeled speed/voyage time. This is a SIMULATION for
// visualization only — never live AIS tracking, and positions are never
// randomized: they are a pure function of the shared simulation clock `t`.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Assignment } from "../api/types";
import type { VesselMarker } from "../components/GoogleFleetMap";

export type SimSpeed = 1 | 5 | 10 | 50;

export interface SimVessel {
  assignment: Assignment;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  voyageHours: number;
  heading: number;
}

const HOURS_PER_SECOND_AT_1X = 4;
const TICK_MS = 200;

function toRad(deg: number) { return (deg * Math.PI) / 180; }
function toDeg(rad: number) { return (rad * 180) / Math.PI; }

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Builds the deterministic per-vessel voyage model from real assignment
 * data. Assignments missing real coordinates or a derivable voyage duration
 * are skipped (never fabricated). */
export function buildSimVessels(assignments: Assignment[]): SimVessel[] {
  const result: SimVessel[] = [];
  for (const a of assignments) {
    if (a.originLatitude == null || a.originLongitude == null || a.destinationLatitude == null || a.destinationLongitude == null) continue;
    let voyageHours = a.voyageTimeHours ?? null;
    if ((voyageHours == null || voyageHours <= 0) && a.distanceNm != null && a.speed > 0) {
      voyageHours = a.distanceNm / a.speed;
    }
    if (voyageHours == null || !Number.isFinite(voyageHours) || voyageHours <= 0) continue;
    result.push({
      assignment: a,
      originLat: a.originLatitude, originLng: a.originLongitude,
      destLat: a.destinationLatitude, destLng: a.destinationLongitude,
      voyageHours,
      heading: bearing(a.originLatitude, a.originLongitude, a.destinationLatitude, a.destinationLongitude),
    });
  }
  return result;
}

export interface VesselSimulationState {
  t: number;
  maxHours: number;
  playing: boolean;
  speed: SimSpeed;
  markers: VesselMarker[];
  play: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (s: SimSpeed) => void;
  seek: (hours: number) => void;
  progressOf: (vesselId: string) => number | null;
}

export function useVesselSimulation(simVessels: SimVessel[]): VesselSimulationState {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState<SimSpeed>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxHours = useMemo(
    () => simVessels.reduce((max, v) => Math.max(max, v.voyageHours), 0),
    [simVessels],
  );

  // Reset the clock whenever the underlying vessel set changes (new solution selected).
  useEffect(() => {
    setT(0);
    setPlaying(false);
  }, [simVessels]);

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    intervalRef.current = setInterval(() => {
      setT((prev) => {
        const next = prev + (HOURS_PER_SECOND_AT_1X * speed * TICK_MS) / 1000;
        if (next >= maxHours) {
          setPlaying(false);
          return maxHours;
        }
        return next;
      });
    }, TICK_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, maxHours]);

  const play = useCallback(() => { if (maxHours > 0 && t < maxHours) setPlaying(true); }, [maxHours, t]);
  const pause = useCallback(() => setPlaying(false), []);
  const reset = useCallback(() => { setPlaying(false); setT(0); }, []);
  const setSpeed = useCallback((s: SimSpeed) => setSpeedState(s), []);
  const seek = useCallback((hours: number) => setT(Math.min(Math.max(hours, 0), maxHours)), [maxHours]);

  const markers: VesselMarker[] = useMemo(() => simVessels.map((v) => {
    const fraction = v.voyageHours > 0 ? Math.min(1, t / v.voyageHours) : 1;
    return {
      id: v.assignment.id,
      lat: v.originLat + (v.destLat - v.originLat) * fraction,
      lng: v.originLng + (v.destLng - v.originLng) * fraction,
      heading: v.heading,
      status: fraction >= 1 ? "arrived" : "in-transit",
      label: v.assignment.vesselId,
    };
  }), [simVessels, t]);

  const progressOf = useCallback((vesselId: string) => {
    const v = simVessels.find((sv) => sv.assignment.id === vesselId);
    if (!v) return null;
    return Math.round(Math.min(1, t / v.voyageHours) * 1000) / 10;
  }, [simVessels, t]);

  return { t, maxHours, playing, speed, markers, play, pause, reset, setSpeed, seek, progressOf };
}
