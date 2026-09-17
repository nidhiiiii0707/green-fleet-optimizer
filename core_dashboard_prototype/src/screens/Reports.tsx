import React, { useState } from "react";
import { useReports } from "../api/hooks";
import { reportsApi } from "../api/client";

const TYPE_CONFIG = {
  optimization:   { color: "#7C3AED", bg: "#F5F3FF", label: "Optimization",  icon: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" },
  sustainability: { color: "#059669", bg: "#F0FDF4", label: "Sustainability", icon: "M5 3l14 9-14 9V3z" },
  tradeoff:       { color: "#1D4ED8", bg: "#EFF6FF", label: "Trade-off",      icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
  compliance:     { color: "#D97706", bg: "#FFFBEB", label: "Compliance",     icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
};

interface Props {
  solutionId: string;
}

export default function Reports({ solutionId }: Props) {
  const { reports, loading } = useReports();
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleExport(reportId: string, format: "pdf" | "csv") {
    const key = reportId + format;
    setDownloading(key);
    try {
      if (format === "csv") {
        await reportsApi.exportReport(reportId, "csv", solutionId);
      } else {
        await reportsApi.exportReport(reportId, "json", solutionId);
      }
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setTimeout(() => setDownloading(null), 1500);
    }
  }

  async function handleBulkExport(type: "pareto" | "assignments" | "pdf") {
    const key = "bulk-" + type;
    setDownloading(key);
    try {
      if (type === "pareto")       await reportsApi.exportParetoSolutions();
      if (type === "assignments")  await reportsApi.exportFleetAssignments(solutionId);
      if (type === "pdf")          await reportsApi.exportReport("R01", "json", solutionId);
    } catch (e) {
      console.error("Bulk export failed:", e);
    } finally {
      setTimeout(() => setDownloading(null), 1500);
    }
  }

  return (
    <div style={{ padding: "24px 28px", overflowY: "auto", height: "100%" }}>

      {/* Download data section */}
      <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 10, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans', sans-serif" }}>Bulk Data Export</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Download raw optimization data, vessel assignments, and constraint logs for {solutionId || "the latest run"}.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { label: "Pareto Solutions (CSV)", key: "pareto" as const },
            { label: "Fleet Assignments (CSV)", key: "assignments" as const },
            { label: "Full Report (JSON)", key: "pdf" as const },
          ].map(btn => (
            <button
              key={btn.key}
              onClick={() => handleBulkExport(btn.key)}
              style={{
                background: downloading === "bulk-" + btn.key ? "#059669" : "white",
                color: downloading === "bulk-" + btn.key ? "white" : "#475569",
                border: "1px solid #E2E8F0", borderRadius: 7, padding: "7px 14px",
                fontSize: 12, cursor: "pointer", fontWeight: 500, transition: "all 0.2s",
              }}
            >
              {downloading === "bulk-" + btn.key ? "✓ Preparing..." : "↓ " + btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Report cards grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ border: "1px solid #E2E8F0", borderRadius: 12, height: 200,
              background: "linear-gradient(90deg, #F8FAFC 25%, #F1F5F9 50%, #F8FAFC 75%)",
              backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
          ))}
          <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {reports.map(report => {
            const tc = TYPE_CONFIG[report.type];
            return (
              <div key={report.id} style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
                {/* Card header */}
                <div style={{ background: tc.bg, padding: "18px 20px", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${tc.color}18`, border: `1px solid ${tc.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={tc.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={tc.icon} />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: tc.color, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>{tc.label}</div>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0F172A", fontFamily: "'DM Sans', sans-serif" }}>{report.title}</h3>
                    </div>
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: "16px 20px" }}>
                  <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: "0 0 14px" }}>{report.description}</p>
                  <div style={{ display: "flex", gap: 12, marginBottom: 16, fontSize: 11, color: "#94A3B8" }}>
                    <span>📅 {report.date}</span>
                    <span>⚡ {report.run}</span>
                    {report.ready && <span style={{ color: "#059669", fontWeight: 600 }}>✓ Ready</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handleExport(report.id, "csv")}
                      style={{ flex: 1, background: tc.color, color: "white", border: "none", borderRadius: 7, padding: "8px 0", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                    >
                      {downloading === report.id + "csv" ? "✓ Downloading..." : "↓ Export CSV"}
                    </button>
                    <button
                      onClick={() => handleExport(report.id, "pdf")}
                      style={{
                        background: downloading === report.id + "pdf" ? "#059669" : "white",
                        color: downloading === report.id + "pdf" ? "white" : "#475569",
                        border: "1px solid #E2E8F0", borderRadius: 7, padding: "8px 14px", fontSize: 13, cursor: "pointer", transition: "all 0.2s",
                      }}
                    >
                      {downloading === report.id + "pdf" ? "✓" : "↓ JSON"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
