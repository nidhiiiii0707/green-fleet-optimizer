import React, { useEffect, useState } from "react";
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

type Screen = "overview" | "fleet" | "optimization" | "fleetplan" | "scenarios" | "alerts" | "reports";

export default function App() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [selectedSolutionId, setSelectedSolutionId] = useState<string | null>(null);
  const { data: optimizationResult } = useLatestOptimization();
  const activeSolutionId = selectedSolutionId ?? optimizationResult?.selected_solution_id ?? "";

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

  function renderScreen() {
    switch (screen) {
      case "overview":
        return <Overview solutionId={activeSolutionId} onGoToOptimization={() => setScreen("optimization")} />;
      case "fleet":
        return <FleetRoutes solutionId={activeSolutionId} />;
      case "optimization":
        return (
          <Optimization
            selectedId={activeSolutionId}
            onSelect={handleSelectSolution}
            onViewPlan={handleViewPlan}
          />
        );
      case "fleetplan":
        return (
          <FleetPlan
            solutionId={activeSolutionId}
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
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden", background: "#F4F3EF" }}>
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
          runMeta={optimizationResult ? {
            method: optimizationResult.method,
            runId: optimizationResult.run_id,
            feasibleSolutions: optimizationResult.feasible_solutions,
            paretoCount: optimizationResult.pareto_count,
          } : null}
        />
        <main style={{ flex: 1, overflowY: "auto", background: "#F4F3EF", display: "flex", flexDirection: "column" }}>
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}
