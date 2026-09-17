import React, { useState } from "react";
import { ALERTS } from "./data/mock";
import { useAlertSummary } from "./api/hooks";
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
  const [selectedSolutionId, setSelectedSolutionId] = useState("S07");

  // Use live alert count from API, fall back to mock count
  const { data: alertSummary } = useAlertSummary();
  const activeAlerts = alertSummary?.total_active
    ?? ALERTS.filter(a => a.status === "active" && a.severity !== "info").length;

  function handleSelectSolution(id: string) {
    setSelectedSolutionId(id);
  }

  function handleViewPlan() {
    setScreen("fleetplan");
  }

  function renderScreen() {
    switch (screen) {
      case "overview":
        return <Overview onGoToOptimization={() => setScreen("optimization")} />;
      case "fleet":
        return <FleetRoutes />;
      case "optimization":
        return (
          <Optimization
            selectedId={selectedSolutionId}
            onSelect={handleSelectSolution}
            onViewPlan={handleViewPlan}
          />
        );
      case "fleetplan":
        return (
          <FleetPlan
            solutionId={selectedSolutionId}
            onGoToScenario={() => setScreen("scenarios")}
            onGoToOptimization={() => setScreen("optimization")}
          />
        );
      case "scenarios":
        return <ScenarioAnalysis onGoToFleetPlan={() => setScreen("fleetplan")} />;
      case "alerts":
        return <Alerts />;
      case "reports":
        return <Reports />;
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
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", height: "100vh" }}>
        <Header
          screen={screen}
          onAlerts={() => setScreen("alerts")}
          alertCount={activeAlerts}
        />
        <main style={{ flex: 1, overflowY: "auto", background: "#F4F3EF", display: "flex", flexDirection: "column" }}>
          {renderScreen()}
        </main>
      </div>
    </div>
  );
}
