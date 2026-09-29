import { isLand } from "./landMask";
import { seaPath, type SeaPoint } from "./seaPath";

export { isLand };

/**
 * Canonical open-water waypoints for the corridors this dashboard serves
 * (East Asia <-> Singapore <-> Malacca <-> Indian Ocean <-> Suez <-> Med
 * <-> Gibraltar <-> Channel <-> North Sea). Every waypoint sits in open
 * water; narrow strait/canal transits are flagged and exempt from the
 * land check (they are real shipping lanes through narrow water).
 */
const WAYPOINTS: Record<string, [number, number]> = {
  SING: [1.35, 104.3],
  SING_W: [1.15, 103.75],
  SCS_S: [3.0, 110.0],
  SCS_C: [12.5, 113.5],
  HK_S: [21.0, 114.5],
  LUZON: [21.3, 122.5],
  TAIWAN_E: [23.8, 124.5],
  OKINAWA_E: [25.8, 129.8],
  ECS_N: [31.5, 126.5],
  KOREA_S: [32.5, 127.0],
  OSUMI: [28.8, 131.8],
  ISE_S: [33.5, 137.5],
  IZU_S: [32.9, 139.7],
  JP_OFF: [33.0, 142.5],
  MALACCA_M: [2.3, 100.8],
  MALACCA_C: [3.2, 100.3],
  MALACCA_W: [6.3, 93.8],
  SRI_S: [4.9, 80.9],
  ARABIAN: [11.0, 60.0],
  ADEN: [12.6, 46.5],
  BAB: [12.2, 44.5],
  MID_RED: [15.5, 41.5],
  RED_S: [19.0, 39.5],
  RED_M: [23.5, 37.5],
  RED_N: [27.0, 35.0],
  SUEZ: [29.4, 32.7],
  PORTSAID: [31.9, 32.1],
  MED_E: [33.6, 28.0],
  MED_C: [35.8, 17.5],
  S_SICILY: [36.3, 13.5],
  SICILY_CH: [37.55, 11.6],
  BALEAR_S: [38.3, 3.5],
  GIB_E: [35.9, -3.0],
  GIB_W: [35.9, -7.6],
  ST_VINCENT: [36.8, -9.5],
  FINISTERRE: [43.5, -9.8],
  OUESSANT: [48.4, -5.8],
  CHAN_S: [49.3, -4.5],
  DOVER: [51.05, 1.7],
  NSEA: [54.2, 3.2],
};

// [from, to, straitTransit]
const EDGES: Array<[string, string, boolean]> = [
  ["JP_OFF", "IZU_S", false],
  ["IZU_S", "ISE_S", false],
  ["IZU_S", "OSUMI", false],
  ["OSUMI", "ECS_N", false],
  ["OSUMI", "OKINAWA_E", false],
  ["OKINAWA_E", "TAIWAN_E", false],
  ["ECS_N", "KOREA_S", false],
  ["ECS_N", "TAIWAN_E", false],
  ["TAIWAN_E", "LUZON", false],
  ["LUZON", "HK_S", false],
  ["HK_S", "SCS_C", false],
  ["LUZON", "SCS_C", false],
  ["SCS_C", "SCS_S", false],
  ["SCS_S", "SING", false],
  ["SING", "SING_W", false],
  ["SING_W", "MALACCA_M", false],
  ["MALACCA_M", "MALACCA_C", false],
  ["MALACCA_C", "MALACCA_W", true],
  ["MALACCA_W", "SRI_S", false],
  ["SRI_S", "ARABIAN", false],
  ["ARABIAN", "ADEN", false],
  ["ADEN", "BAB", false],
  ["BAB", "MID_RED", true],
  ["MID_RED", "RED_S", false],
  ["RED_S", "RED_M", false],
  ["RED_M", "RED_N", false],
  ["RED_N", "SUEZ", true],
  ["SUEZ", "PORTSAID", true],
  ["PORTSAID", "MED_E", false],
  ["MED_E", "MED_C", false],
  ["MED_C", "S_SICILY", false],
  ["S_SICILY", "SICILY_CH", false],
  ["SICILY_CH", "BALEAR_S", false],
  ["BALEAR_S", "GIB_E", false],
  ["GIB_E", "GIB_W", true],
  ["GIB_W", "ST_VINCENT", false],
  ["ST_VINCENT", "FINISTERRE", false],
  ["FINISTERRE", "OUESSANT", false],
  ["OUESSANT", "CHAN_S", false],
  ["CHAN_S", "DOVER", true],
  ["DOVER", "NSEA", false],
];

function wrapLng(lng: number): number {
  if (lng > 180) return lng - 360;
  if (lng < -180) return lng + 360;
  return lng;
}

function unwrapNear(lng: number, ref: number): number {
  while (lng - ref > 180) lng -= 360;
  while (lng - ref < -180) lng += 360;
  return lng;
}

export function haversineNm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (v: number) => v * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  let dLng = Math.abs(bLng - aLng);
  if (dLng > 180) dLng = 360 - dLng;
  dLng = toRad(dLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(s)));
}

const ADJACENCY: Map<string, Array<{ to: string; cost: number; strait: boolean }>> = (() => {
  const map = new Map<string, Array<{ to: string; cost: number; strait: boolean }>>();
  for (const [a, b, strait] of EDGES) {
    const [aLat, aLng] = WAYPOINTS[a];
    const [bLat, bLng] = WAYPOINTS[b];
    const cost = haversineNm(aLat, aLng, bLat, bLng);
    if (!map.has(a)) map.set(a, []);
    if (!map.has(b)) map.set(b, []);
    map.get(a)!.push({ to: b, cost, strait });
    map.get(b)!.push({ to: a, cost, strait });
  }
  return map;
})();

function shortestWaypointPath(start: string, goal: string): string[] | null {
  const dist = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  for (;;) {
    let current: string | null = null;
    let best = Infinity;
    for (const [node, d] of dist) {
      if (!visited.has(node) && d < best) { best = d; current = node; }
    }
    if (current === null) return null;
    if (current === goal) break;
    visited.add(current);
    for (const edge of ADJACENCY.get(current) ?? []) {
      const alt = (dist.get(current) ?? Infinity) + edge.cost;
      if (alt < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, current);
      }
    }
  }
  const path = [goal];
  let node = goal;
  while (node !== start) {
    const p = prev.get(node);
    if (!p) return null;
    node = p;
    path.unshift(node);
  }
  return path;
}

/** Land samples on a straight leg, ignoring the first/last `margin` (port approaches sit on the coast). */
function legLandCount(aLat: number, aLng: number, bLat: number, bLng: number, margin: number): number {
  const bLngU = unwrapNear(bLng, aLng);
  let count = 0;
  const steps = 24;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (t < margin || t > 1 - margin) continue;
    const lat = aLat + (bLat - aLat) * t;
    const lng = wrapLng(aLng + (bLngU - aLng) * t);
    if (isLand(lat, lng)) count += 1;
  }
  return count;
}

/** Nearest waypoint whose open-water leg from the port is cleanest (fewest land samples past the coastal margin). */
function attachWaypoint(point: SeaPoint): { node: string; legLand: number } {
  return attachCandidates(point, 1)[0];
}

function attachCandidates(point: SeaPoint, k: number): Array<{ node: string; legLand: number; dist: number }> {
  const ranked = Object.keys(WAYPOINTS)
    .map(node => {
      const [wLat, wLng] = WAYPOINTS[node];
      return { node, dist: haversineNm(point.latitude, point.longitude, wLat, wLng) };
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 6);
  const scored = ranked.map(candidate => {
    const [wLat, wLng] = WAYPOINTS[candidate.node];
    return { ...candidate, legLand: legLandCount(point.latitude, point.longitude, wLat, wLng, 0.2) };
  });
  scored.sort((a, b) => a.legLand - b.legLand || a.dist - b.dist);
  return scored.slice(0, Math.max(1, k));
}

/** Midpoint-quadratic smoothing through lane nodes (falls back to straight segments if smoothing clips land). */
function smoothLane(nodes: Array<[number, number]>): Array<[number, number]> {
  const straight: Array<[number, number]> = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const [aLat, aLngRaw] = nodes[i];
    const [bLat, bLngRaw] = nodes[i + 1];
    const bLng = unwrapNear(bLngRaw, aLngRaw);
    for (let k = 0; k < 10; k += 1) {
      const t = k / 10;
      straight.push([aLat + (bLat - aLat) * t, wrapLng(aLngRaw + (bLng - aLngRaw) * t)]);
    }
  }
  straight.push([nodes[nodes.length - 1][0], wrapLng(nodes[nodes.length - 1][1])]);
  if (nodes.length <= 2) return straight;

  // midpoint-quadratic: curve from midpoint to midpoint, controlled by each lane node
  const mids: Array<[number, number]> = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const [aLat, aLngRaw] = nodes[i];
    const [bLat, bLngRaw] = nodes[i + 1];
    const bLng = unwrapNear(bLngRaw, aLngRaw);
    mids.push([(aLat + bLat) / 2, wrapLng((aLngRaw + bLng) / 2)]);
  }
  const smoothed: Array<[number, number]> = [[nodes[0][0], wrapLng(nodes[0][1])]];
  for (let i = 1; i < nodes.length - 1; i += 1) {
    const [cLat, cLngRaw] = nodes[i];
    const [pLat, pLngRaw] = smoothed[smoothed.length - 1];
    const cLng = unwrapNear(cLngRaw, pLngRaw);
    const [mLat, mLngRaw] = mids[i];
    const mLng = unwrapNear(mLngRaw, cLng);
    for (let k = 1; k <= 8; k += 1) {
      const t = k / 8;
      const inv = 1 - t;
      smoothed.push([
        inv * inv * pLat + 2 * inv * t * cLat + t * t * mLat,
        wrapLng(inv * inv * pLngRaw + 2 * inv * t * cLng + t * t * mLng),
      ]);
    }
  }
  smoothed.push([nodes[nodes.length - 1][0], wrapLng(nodes[nodes.length - 1][1])]);

  // accept smoothing only if it stays as clean as the straight lane
  return countRealLand(smoothed, 0.08, 0.92) <= countRealLand(straight, 0.08, 0.92) ? smoothed : straight;
}

/**
 * Full sea-lane path between two points: direct schematic arc when it is
 * clean open water, otherwise port -> waypoint lane graph -> port.
 */
export function routeSeaPath(from: SeaPoint, to: SeaPoint): Array<[number, number]> {
  const direct = seaPath(from, to);
  const directLen = Math.max(1, haversineNm(from.latitude, from.longitude, to.latitude, to.longitude));
  let best = direct;
  let bestLand = countRealLand(direct);
  let bestLen = directLen;
  if (bestLand === 0) return best;
  const consider = (pts: Array<[number, number]>) => {
    if (polyLengthNm(pts) > 4 * directLen) return; // absurd detour: skip
    const land = countRealLand(pts);
    if (land < bestLand || (land === bestLand && polyLengthNm(pts) < bestLen)) {
      best = pts; bestLand = land; bestLen = polyLengthNm(pts);
    }
  };
  const fromPt: [number, number] = [from.latitude, from.longitude];
  const toPt: [number, number] = [to.latitude, to.longitude];
  // single-waypoint detours via the cleanest nearby waypoints of either end
  const viaNodes = new Set<string>();
  attachCandidates(from, 2).forEach(c => viaNodes.add(c.node));
  attachCandidates(to, 2).forEach(c => viaNodes.add(c.node));
  for (const node of viaNodes) {
    consider(smoothLane([fromPt, WAYPOINTS[node], toPt]));
  }
  // full lane-graph path between the two best attach nodes
  const attachA = attachWaypoint(from);
  const attachB = attachWaypoint(to);
  if (attachA.node !== attachB.node) {
    const lane = shortestWaypointPath(attachA.node, attachB.node);
    if (lane) {
      consider(smoothLane([fromPt, ...lane.map(id => WAYPOINTS[id]), toPt]));
    }
  }
  return best;
}

const STRAIT_SEGMENTS: Array<[[number, number], [number, number]]> = EDGES
  .filter(([, , strait]) => strait)
  .map(([a, b]) => [WAYPOINTS[a], WAYPOINTS[b]]);

function distToSegNm(lat: number, lng: number, aLat: number, aLng: number, bLat: number, bLng: number): number {
  // equirectangular approximation (adequate for a 30nm proximity test)
  const kx = 60 * Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
  const ax = 0, ay = 0;
  const bx = (unwrapNear(bLng, aLng) - aLng) * kx, by = (bLat - aLat) * 60;
  const px = (lng - aLng) * kx, py = (lat - aLat) * 60;
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * bx + (py - ay) * by) / len2));
  const dx = px - (ax + t * bx), dy = py - (ay + t * by);
  return Math.hypot(dx, dy);
}

/** True within ~30nm of a strait/canal transit lane (genuine narrow-water passages). */
export function nearStrait(lat: number, lng: number, maxNm = 30): boolean {
  for (const [a, b] of STRAIT_SEGMENTS) {
    if (distToSegNm(lat, lng, a[0], a[1], b[0], b[1]) <= maxNm) return true;
  }
  return false;
}

/** Interior land samples excluding port approaches and strait transits. */
export function countRealLand(pts: Array<[number, number]>, lo = 0.12, hi = 0.88): number {
  let count = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const t = i / (pts.length - 1);
    if (t < lo || t > hi) continue;
    if (nearStrait(pts[i][0], pts[i][1])) continue;
    if (isLand(pts[i][0], pts[i][1])) count += 1;
  }
  return count;
}

function polyLengthNm(pts: Array<[number, number]>): number {
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) {
    total += haversineNm(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  }
  return total;
}

/** Test hooks (not used by the UI). */
export const __seaLanesForTests = { WAYPOINTS, EDGES, attachWaypoint, legLandCount, shortestWaypointPath };
