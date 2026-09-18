import React, { useCallback, useEffect, useState } from "react";
import { useAlertSummary, useLatestOptimization } from "./api/hooks";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import Overview from "./screens/Overview";
import FleetRoutes from "./screens/FleetRoutes";
import Optimization from "./screens/Optimization";
import FleetPlan from "./screens/FleetPlan";
import ScenarioAnalysis from "./screens/ScenarioAnalysis";
import Alerts from "./screens/Alerts";
import Reports from "./screens/Reports";
import type { OptimizationResult } from "./api/types";

type Screen = "overview" | "fleet" | "optimization" | "fleetplan" | "scenarios" | "alerts" | "reports";

export default function App() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [darkMode, setDarkMode] = useState(() => window.localStorage.getItem("greenfleet-theme") === "dark");
  const [selectedSolutionId, setSelectedSolutionId] = useState<string | null>(null);
  const [requestResult, setRequestResult] = useState<OptimizationResult | null>(null);
  const { data: baselineResult, loading: optimizationLoading, error: optimizationError } = useLatestOptimization();
  const optimizationResult = requestResult ?? baselineResult;
  const activeSolutionId = selectedSolutionId ?? optimizationResult?.selected_solution_id ?? "";

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    window.localStorage.setItem("greenfleet-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (!optimizationResult?.pareto_solutions.length) return;
    const stillExists = optimizationResult.pareto_solutions.some((solution) => solution.id === selectedSolutionId);
    if (!stillExists) setSelectedSolutionId(optimizationResult.selected_solution_id);
  }, [optimizationResult, selectedSolutionId]);

  const { data: alertSummary } = useAlertSummary();
  const activeAlerts = alertSummary?.total_active ?? 0;

  function handleSelectSolution(id: string) {
    setSelectedSolutionId(id);
  }

  function handleViewPlan() {
    setScreen("fleetplan");
  }

  const handleRequestResult = useCallback((result: OptimizationResult) => {
    setRequestResult(result);
    setSelectedSolutionId(result.selected_solution_id);
  }, []);

  const handleReturnToBaseline = useCallback(() => {
    setRequestResult(null);
    setSelectedSolutionId(baselineResult?.selected_solution_id ?? null);
  }, [baselineResult]);

  function renderScreen() {
    switch (screen) {
      case "overview":
        return <Overview solutionId={activeSolutionId} result={optimizationResult} loading={optimizationLoading} error={optimizationError} onGoToOptimization={() => setScreen("optimization")} />;
      case "fleet":
        return <FleetRoutes solutionId={activeSolutionId} result={optimizationResult} loading={optimizationLoading} error={optimizationError} />;
      case "optimization":
        return (
          <Optimization
            selectedId={activeSolutionId}
            result={optimizationResult}
            loading={optimizationLoading}
            error={optimizationError}
            showingRequestResult={requestResult !== null}
            onSelect={handleSelectSolution}
            onViewPlan={handleViewPlan}
            onRequestResult={handleRequestResult}
            onReturnToBaseline={handleReturnToBaseline}
          />
        );
      case "fleetplan":
        return (
          <FleetPlan
            solutionId={activeSolutionId}
            result={optimizationResult}
            loading={optimizationLoading}
            error={optimizationError}
            onGoToScenario={() => setScreen("scenarios")}
            onGoToOptimization={() => setScreen("optimization")}
          />
        );
      case "scenarios":
        return <ScenarioAnalysis onGoToFleetPlan={() => setScreen("fleetplan")} />;
      case "alerts":
        return <Alerts />;
      case "reports":
        return <Reports solutionId={activeSolutionId} />;
      default:
        return null;
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden", background: "var(--gf-canvas)" }}>
      <Sidebar
        current={screen}
        onNav={s => setScreen(s)}
        alertCount={activeAlerts}
        runId={optimizationResult?.run_id}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: "100vh" }}>
        <Header
          screen={screen}
          onAlerts={() => setScreen("alerts")}
          alertCount={activeAlerts}
          selectedSolutionId={activeSolutionId}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode(value => !value)}
          runMeta={optimizationResult ? {
            method: Array.from(new Set(optimizationResult.pareto_solutions.map(solution => solution.algorithm).filter((algorithm): algorithm is string => Boolean(algorithm)))).join(" / ") || optimizationResult.method,
            runId: optimizationResult.run_id,
            feasibleSolutions: optimizationResult.feasible_solutions,
            paretoCount: optimizationResult.pareto_count,
          } : null}
        />
        <main style={{ flex: 1, overflowY: "auto", background: "var(--gf-canvas)", display: "flex", flexDirection: "column" }}>
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}
