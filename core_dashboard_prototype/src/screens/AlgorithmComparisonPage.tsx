import React, { useEffect } from "react";
import AlgorithmComparisonPanel from "../components/AlgorithmComparisonPanel";
import { useAlgorithmComparison } from "../api/hooks";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:      "var(--gf-canvas)",
  surface: "var(--gf-card)",
  border:  "var(--gf-line)",
  text:    "var(--gf-ink)",
  muted:   "var(--gf-muted)",
  faint:   "var(--gf-faint)",
  teal:    "#0D9488",
  tealSoft:"var(--gf-teal-soft)",
  red:     "#EF4444",
  redSoft: "var(--gf-red-soft)",
  amber:   "#D97706",
};

interface Props {
  runId: string;
  onBack: () => void;
}

export default function AlgorithmComparisonPage({ runId, onBack }: Props) {
  const { result, running, error, compare } = useAlgorithmComparison(runId);

  // Auto-fetch algorithm comparison on mount or when runId changes
  useEffect(() => {
    if (runId) {
      compare();
    }
  }, [runId, compare]);

  // ── Status badges (loading / partial-failure) ─────────────────────────────
  function statusBadge(label: string, status: string | undefined, err: string | null | undefined) {
    const ok = status === "complete";
    return (
      <div key={label} style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
        fontFamily: "'Instrument Sans', sans-serif",
        background: ok ? T.tealSoft : T.redSoft,
        border: `1px solid ${ok ? T.teal + "55" : T.red + "55"}`,
        color: ok ? T.teal : T.red,
      }}>
        {ok ? "✓" : "✗"} {label}: {ok ? "Complete" : (err ?? "Failed")}
      </div>
    );
  }

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "24px 28px" }}>

      {/* ── Back navigation ── */}
      <button
        id="btn-back-to-optimization"
        onClick={onBack}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: T.surface, color: T.muted,
          border: `1px solid ${T.border}`, borderRadius: 7,
          padding: "7px 14px", fontSize: 12, fontWeight: 600,
          cursor: "pointer", fontFamily: "'Instrument Sans', sans-serif",
          marginBottom: 20,
        }}
      >
        ← Back to Optimization Results
      </button>

      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 22, fontWeight: 800, color: T.text,
          fontFamily: "'Instrument Sans', sans-serif", letterSpacing: "-0.01em",
        }}>
          Algorithm Comparison
        </div>
        <div style={{
          fontSize: 13, color: T.muted, marginTop: 4,
          fontFamily: "'Instrument Sans', sans-serif",
        }}>
          MO-QIGA vs NSGA-II with MILP Reference
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <div style={{
            background: T.tealSoft, border: `1px solid ${T.teal}35`,
            borderRadius: 6, padding: "3px 10px",
            fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", color: T.teal,
          }}>
            run_id: {runId || "none"}
          </div>
          <button
            onClick={() => compare()}
            disabled={running || !runId}
            style={{
              background: T.surface, color: T.muted,
              border: `1px solid ${T.border}`, borderRadius: 6,
              padding: "3px 9px", fontSize: 11, fontWeight: 600,
              cursor: running || !runId ? "not-allowed" : "pointer",
              fontFamily: "'Instrument Sans', sans-serif",
              opacity: running || !runId ? 0.6 : 1,
            }}
          >
            {running ? "Comparing…" : "↻ Refresh Comparison"}
          </button>
        </div>
      </div>

      {/* ── Loading state ── */}
      {running && (
        <div style={{
          background: T.tealSoft, border: `1px solid ${T.teal}55`,
          borderRadius: 12, padding: "16px 20px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" stroke={T.teal} strokeWidth="3" opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke={T.teal} strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 13, color: T.teal, fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}>
            Loading algorithm comparison…
          </span>
        </div>
      )}

      {/* ── Top-level fetch error (no result at all) ── */}
      {!running && error && !result && (
        <div style={{
          background: T.redSoft, border: `1px solid ${T.red}55`,
          borderRadius: 12, padding: "14px 18px", marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 12, color: T.red, fontFamily: "'Instrument Sans', sans-serif",
        }}>
          <span>Algorithm comparison failed: {error}</span>
          <button
            onClick={() => compare()}
            style={{
              background: T.surface, color: T.text, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Per-algorithm status strip (shown once data arrives) ── */}
      {result && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {statusBadge("MO-QIGA",       result.mo_qiga.status, result.mo_qiga.error)}
          {statusBadge("NSGA-II",       result.nsga2.status,   result.nsga2.error)}
          {statusBadge("MILP Reference",result.milp.status,    result.milp.error)}
        </div>
      )}


      {/* ── MILP reference points detail ── */}
      {result && (
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 12, overflow: "hidden",
          boxShadow: "0 2px 10px rgba(0,0,0,0.08)", marginBottom: 20,
        }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, fontFamily: "'Instrument Sans', sans-serif" }}>
              MILP Reference Points
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2, fontFamily: "'Instrument Sans', sans-serif" }}>
              Objective-specific lower bounds — not combined into a single Pareto solution
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr style={{ background: "var(--gf-row-alt)" }}>
                  {["Reference", "Fuel (t)", "Cost (USD)", "GHG (kgCO2)"].map(h => (
                    <th key={h} style={{
                      padding: "9px 14px", textAlign: h === "Reference" ? "left" : "center",
                      fontSize: 10, color: T.muted, borderBottom: `1px solid ${T.border}`,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      fontFamily: "'Instrument Sans', sans-serif",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "MILP Minimum Fuel", sol: result.milp.references.minimum_fuel },
                  { label: "MILP Minimum Cost", sol: result.milp.references.minimum_cost },
                  { label: "MILP Minimum GHG",  sol: result.milp.references.minimum_ghg  },
                ].map(({ label, sol }, i) => (
                  <tr key={label} style={{ background: i % 2 ? "var(--gf-row-alt)" : T.surface }}>
                    <td style={{ padding: "9px 14px", fontSize: 11, fontWeight: 600, color: "#E11D48", fontFamily: "'Instrument Sans', sans-serif", borderBottom: `1px solid ${T.border}` }}>{label}</td>
                    <td style={{ padding: "9px 14px", textAlign: "center", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: T.text, borderBottom: `1px solid ${T.border}` }}>{sol ? sol.fuel.toLocaleString() : "N/A"}</td>
                    <td style={{ padding: "9px 14px", textAlign: "center", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: T.text, borderBottom: `1px solid ${T.border}` }}>{sol ? `$${sol.cost_usd?.toLocaleString() ?? "N/A"}` : "N/A"}</td>
                    <td style={{ padding: "9px 14px", textAlign: "center", fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: T.text, borderBottom: `1px solid ${T.border}` }}>{sol ? sol.ghg.toLocaleString() : "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Main comparison panel (summary table + gaps) ── */}
      <AlgorithmComparisonPanel comparison={result} error={error} />

      {/* Spinner keyframes */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
