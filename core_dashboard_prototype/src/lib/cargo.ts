// Shared cargo-demand/fulfillment helpers. Never fabricates a value: cargo
// demand comes only from the optimization request actually submitted, and
// fulfillment is only computed when both the requested cargo and the real
// assigned cargo (sum of assignments[].cargoTons) are present.
import type { Assignment } from "../api/types";

export function cargoDemandDisplay(requestedCargo: number | null | undefined): { value: string; sub: string } {
  if (requestedCargo != null) {
    return { value: `${requestedCargo.toLocaleString()} t`, sub: "From optimization request" };
  }
  return { value: "Unrestricted", sub: "No cargo constraint specified" };
}

export function totalAssignedCargo(assignments: Assignment[]): number | null {
  if (assignments.length === 0) return null;
  let total = 0;
  for (const a of assignments) {
    if (a.cargoTons == null || !Number.isFinite(a.cargoTons)) return null;
    total += a.cargoTons;
  }
  return total;
}

export function cargoFulfillmentPct(assignments: Assignment[], requestedCargo: number | null | undefined): number | null {
  if (requestedCargo == null || requestedCargo <= 0) return null;
  const assigned = totalAssignedCargo(assignments);
  if (assigned == null) return null;
  return Math.round((assigned / requestedCargo) * 1000) / 10;
}
