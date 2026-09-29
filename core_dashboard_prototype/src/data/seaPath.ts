import { isLand } from "./landMask";

export { isLand };

export interface SeaPoint { latitude: number; longitude: number }

export function bearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (v: number) => v * Math.PI / 180;
  const toDeg = (v: number) => v * 180 / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function controlPoint(from: SeaPoint, to: SeaPoint, side: number, magnitude: number) {
  let lngDelta = to.longitude - from.longitude;
  if (lngDelta > 180) lngDelta -= 360;
  if (lngDelta < -180) lngDelta += 360;
  const latDelta = to.latitude - from.latitude;
  const curve = Math.min(8, Math.max(0.7, Math.hypot(latDelta, lngDelta) * 0.08)) * magnitude;
  return {
    lat: (from.latitude + to.latitude) / 2 + side * Math.sign(lngDelta || 1) * curve,
    lng: from.longitude + lngDelta / 2 - side * Math.sign(latDelta || 1) * curve * 0.45,
  };
}

export function bezierPoint(from: SeaPoint, ctrl: { lat: number; lng: number }, to: SeaPoint, t: number): [number, number] {
  let lngDelta = to.longitude - from.longitude;
  if (lngDelta > 180) lngDelta -= 360;
  if (lngDelta < -180) lngDelta += 360;
  const inv = 1 - t;
  const lat = inv * inv * from.latitude + 2 * inv * t * ctrl.lat + t * t * to.latitude;
  let lng = inv * inv * from.longitude + 2 * inv * t * ctrl.lng + t * t * (from.longitude + lngDelta);
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  return [lat, lng];
}

/** Interior samples that fall on land (coarse mask). Endpoints are exempt — ports sit on the coast. */
function landSampleCount(from: SeaPoint, ctrl: { lat: number; lng: number }, to: SeaPoint): number {
  let count = 0;
  for (let i = 0; i <= 24; i += 1) {
    const t = 0.12 + (0.88 - 0.12) * (i / 24);
    const [lat, lng] = bezierPoint(from, ctrl, to, t);
    if (isLand(lat, lng)) count += 1;
  }
  return count;
}

/** Pick the curve bulge (sea side) with the fewest land samples. */
export function pickControl(from: SeaPoint, to: SeaPoint) {
  let best = controlPoint(from, to, 1, 1);
  let bestScore = landSampleCount(from, best, to);
  if (bestScore > 0) {
    const candidates: Array<[number, number]> = [[-1, 1], [1, 1.9], [-1, 1.9], [1, 0.45], [-1, 0.45]];
    for (const [side, magnitude] of candidates) {
      const ctrl = controlPoint(from, to, side, magnitude);
      const score = landSampleCount(from, ctrl, to);
      if (score < bestScore) {
        best = ctrl; bestScore = score;
        if (score === 0) break;
      }
    }
  }
  return best;
}

/** Sea-aware schematic path: same style as before, but the bulge is flipped to open water when it would cross land. */
export function seaPath(from: SeaPoint, to: SeaPoint): Array<[number, number]> {
  const ctrl = pickControl(from, to);
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= 28; i += 1) {
    points.push(bezierPoint(from, ctrl, to, i / 28));
  }
  return points;
}

/** Nearest sea point on the path to fraction t (searches ±0.18 along the path). */
export function seaPointOnPath(path: Array<[number, number]>, fraction: number): { index: number; heading: number } {
  const last = path.length - 1;
  let index = Math.min(last, Math.max(0, Math.round(fraction * last)));
  const pointIsLand = (k: number) => isLand(path[k][0], path[k][1]);
  if (pointIsLand(index)) {
    let found = -1;
    for (let d = 1; d <= Math.ceil(last * 0.18); d += 1) {
      for (const k of [index - d, index + d]) {
        if (k < 1 || k > last - 1) continue;
        if (!pointIsLand(k)) { found = k; break; }
      }
      if (found >= 0) break;
    }
    if (found >= 0) index = found;
  }
  const a = path[Math.max(0, index - 1)];
  const b = path[Math.min(last, index + 1)];
  return { index, heading: bearing(a[0], a[1], b[0], b[1]) };
}
