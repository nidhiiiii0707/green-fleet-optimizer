import type { AlgorithmComparisonResult } from "../api/types";

interface Props {
  comparison: AlgorithmComparisonResult | null;
  error: string | null;
}

const C = {
  border: "var(--gf-line)",
  text: "var(--gf-ink)",
  muted: "var(--gf-muted)",
  surface: "var(--gf-card)",
  alt: "var(--gf-row-alt)",
  teal: "#2DD4BF",
  red: "#EF4444",
};

function number(value: number | null | undefined, digits = 2) {
  return value == null ? "N/A" : value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function runtime(value: number | null) {
  return value == null ? "N/A" : `${number(value, 1)} ms`;
}

function percent(value: number | null | undefined) {
  return value == null ? "N/A" : `${value >= 0 ? "+" : ""}${number(value, 2)}%`;
}

export default function AlgorithmComparisonPanel({ comparison, error }: Props) {
  if (!comparison && !error) return null;

  if (!comparison) {
    return (
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, color: C.red, fontSize: 12 }}>
        Algorithm comparison failed: {error}
      </div>
    );
  }

  const mo = comparison.mo_qiga;
  const nsga = comparison.nsga2;
  const milp = comparison.milp;
  const milpFuel = milp.references.minimum_fuel;
  const milpCost = milp.references.minimum_cost;
  const milpGhg = milp.references.minimum_ghg;

  const rows = [
    { label: "Status", mo: mo.status === "complete" ? "Complete" : "Failed", nsga: nsga.status === "complete" ? "Complete" : "Failed", milp: milp.status === "complete" ? "Complete" : "Failed" },
    { label: "Feasible?", mo: mo.feasible ? "Yes" : "No", nsga: nsga.feasible ? "Yes" : "No", milp: milp.feasible ? "Yes" : "No" },
    { label: "Minimum Fuel", mo: number(mo.objective_minima?.fuel), nsga: number(nsga.objective_minima?.fuel), milp: number(milpFuel?.fuel) },
    { label: "Fuel gap vs MILP", mo: percent(comparison.comparison.gaps_percent.mo_qiga?.fuel), nsga: percent(comparison.comparison.gaps_percent.nsga2?.fuel), milp: "Reference" },
    { label: "Minimum Cost (USD)", mo: `$${number(mo.objective_minima?.cost)}`, nsga: `$${number(nsga.objective_minima?.cost)}`, milp: milpCost ? `$${number(milpCost.cost_usd)}` : "N/A" },
    { label: "Cost gap vs MILP", mo: percent(comparison.comparison.gaps_percent.mo_qiga?.cost), nsga: percent(comparison.comparison.gaps_percent.nsga2?.cost), milp: "Reference" },
    { label: "Minimum GHG (kgCO₂)", mo: number(mo.objective_minima?.ghg), nsga: number(nsga.objective_minima?.ghg), milp: number(milpGhg?.ghg) },
    { label: "GHG gap vs MILP", mo: percent(comparison.comparison.gaps_percent.mo_qiga?.ghg), nsga: percent(comparison.comparison.gaps_percent.nsga2?.ghg), milp: "Reference" },
    { label: "Runtime", mo: runtime(mo.runtime_ms), nsga: runtime(nsga.runtime_ms), milp: runtime(milp.runtime_ms) },
    { label: "Pareto Plans", mo: String(mo.pareto_count), nsga: String(nsga.pareto_count), milp: "N/A" },
    { label: "Hypervolume", mo: number(mo.hypervolume, 4), nsga: number(nsga.hypervolume, 4), milp: "N/A" },
    { label: "Spread", mo: number(mo.spread, 4), nsga: number(nsga.spread, 4), milp: "N/A" },
  ];

  const failures = [
    mo.error ? `MO-QIGA: ${mo.error}` : null,
    nsga.error ? `NSGA-II: ${nsga.error}` : null,
    milp.error ? `MILP Reference: ${milp.error}` : null,
  ].filter(Boolean);

  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.08)", marginBottom: 16 }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>Algorithm Comparison</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>MO-QIGA vs NSGA-II · MILP objective-specific reference minima</div>
        </div>
        <div style={{ fontSize: 10, color: C.muted, fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>
          {comparison.input_audit.feasible_candidate_count}/{comparison.input_audit.candidate_count} feasible candidates<br />
          {comparison.input_audit.verification_status === "verified"
            ? `verified shared input ${comparison.input_audit.candidate_fingerprint.slice(0, 10)}`
            : `archived input ${comparison.input_audit.candidate_fingerprint.slice(0, 10)} · cross-algorithm verification unavailable`}
        </div>
      </div>
      {failures.length > 0 && (
        <div style={{ padding: "9px 18px", color: C.red, fontSize: 11, borderBottom: `1px solid ${C.border}` }}>
          {failures.join(" · ")}
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
          <thead>
            <tr style={{ background: C.alt }}>
              {["Metric", "MO-QIGA", "NSGA-II", "MILP Reference"].map(label => (
                <th key={label} style={{ padding: "9px 14px", textAlign: label === "Metric" ? "left" : "center", fontSize: 10, color: C.muted, borderBottom: `1px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} style={{ background: index % 2 ? C.alt : C.surface }}>
                <td style={{ padding: "8px 14px", fontSize: 10.5, color: C.muted, borderBottom: `1px solid ${C.border}` }}>{row.label}</td>
                {[row.mo, row.nsga, row.milp].map((value, cell) => (
                  <td key={cell} style={{ padding: "8px 14px", textAlign: "center", fontSize: 11, color: C.text, borderBottom: `1px solid ${C.border}`, fontFamily: "'JetBrains Mono', monospace" }}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "9px 18px", fontSize: 10, color: C.muted }}>
        Hypervolume uses one shared normalization domain and reference point for MO-QIGA and NSGA-II ({comparison.metric_context.hypervolume_samples.toLocaleString()} deterministic samples).
      </div>
    </section>
  );
}
