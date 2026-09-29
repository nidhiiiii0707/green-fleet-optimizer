import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = "true";

async function loadModules() {
  const server = await createServer({ configFile: false, root: process.cwd(), server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom" });
  try {
    const screen = await server.ssrLoadModule("/src/screens/Optimization.tsx");
    const client = await server.ssrLoadModule("/src/api/client.ts");
    const panel = await server.ssrLoadModule("/src/components/AlgorithmComparisonPanel.tsx");
    const request = await server.ssrLoadModule("/src/lib/comparisonRequest.ts");
    const chart = await server.ssrLoadModule("/src/components/ParetoChart.tsx");
    return { screen, client, panel, request, chart };
  } finally {
    await server.close();
  }
}


function findButtonByText(node, text) {
  if (!node || typeof node !== "object") return null;
  if (node.type === "button" && node.props?.children === text) return node;
  const children = React.Children.toArray(node.props?.children);
  for (const child of children) {
    const match = findButtonByText(child, text);
    if (match) return match;
  }
  return null;
}


const comparison = {
  run_id: "run-42",
  structured_request: { origin: null, destination: null, vessel_type: null, fuel_type: null, speed: null, cargo: null, objectives: ["fuel", "cost", "ghg"] },
  input_audit: {
    candidate_count: 3,
    feasible_candidate_count: 3,
    candidate_ids: ["C1", "C2", "C3"],
    feasible_candidate_ids: ["C1", "C2", "C3"],
    candidate_fingerprint: "abc",
    evaluated_input_fingerprint: "evaluated-abc",
    verification_status: "verified",
    algorithm_candidate_fingerprints: {
      "MO-QIGA": "abc",
      "NSGA-II": "abc",
      "MILP Reference": "abc",
    },
  },
  metric_context: {
    normalization_min: [90, 190, 290],
    normalization_max: [132, 275, 385],
    hypervolume_reference_point: [1, 1, 1],
    hypervolume_samples: 200000,
  },
  mo_qiga: {
    status: "complete", error: null, runtime_ms: 12.5, feasible: true,
    pareto_count: 2, objective_minima: { fuel: 110, cost: 225, ghg: 330 },
    hypervolume: 0.42, spread: 0.15,
    solutions: [{ id: "mo-1", algorithm: "MO-QIGA", fuel: 110, cost: 0.000225, cost_usd: 225, ghg: 330, feasible: true }],
  },
  nsga2: {
    status: "complete", error: null, runtime_ms: 25, feasible: true,
    pareto_count: 1, objective_minima: { fuel: 120, cost: 220, ghg: 360 },
    hypervolume: 0.31, spread: null,
    solutions: [{ id: "nsga-1", algorithm: "NSGA-II", fuel: 120, cost: 0.00022, cost_usd: 220, ghg: 360, feasible: true }],
  },
  milp: {
    status: "complete", error: null, runtime_ms: 5, feasible: true, pareto_count: null,
    reference_strategy: "pure_objective_solve",
    references: {
      minimum_fuel: { id: "milp-fuel", algorithm: "MILP Reference", fuel: 100, cost: 0.00028, cost_usd: 280, ghg: 310, feasible: true },
      minimum_cost: { id: "milp-cost", algorithm: "MILP Reference", fuel: 130, cost: 0.0002, cost_usd: 200, ghg: 350, feasible: true },
      minimum_ghg: { id: "milp-ghg", algorithm: "MILP Reference", fuel: 105, cost: 0.00029, cost_usd: 290, ghg: 300, feasible: true },
    },
  },
  comparison: {
    gaps_percent: {
      mo_qiga: { fuel: 10, cost: 12.5, ghg: 10 },
      nsga2: { fuel: 20, cost: 10, ghg: 20 },
    },
  },
};


test("Compare button invokes the supplied algorithm-comparison action", async () => {
  const { screen } = await loadModules();
  let calls = 0;
  const tree = screen.SolutionPanel({
    sol: { id: "S01", label: "Solution 01", fuel: 1, cost: 2, ghg: 3, cargoFulfillment: null, vessels: 1, routes: 1, constraintsSatisfied: 1, totalConstraints: 1, pareto: true },
    onViewPlan: () => {},
    onCompare: () => { calls += 1; },
    compareRunning: false,
    inFilter: true,
    requestedCargo: null,
  });
  const button = findButtonByText(tree, "Compare");

  assert.ok(button, "the selected-solution panel should expose the Compare button");
  button.props.onClick();
  assert.equal(calls, 1);
});


test("Compare button shows a disabled loading state while the request runs", async () => {
  const { screen } = await loadModules();
  const tree = screen.SolutionPanel({
    sol: { id: "S01", label: "Solution 01", fuel: 1, cost: 2, ghg: 3, cargoFulfillment: null, vessels: 1, routes: 1, constraintsSatisfied: 1, totalConstraints: 1, pareto: true },
    onViewPlan: () => {},
    onCompare: () => {},
    compareRunning: true,
    inFilter: true,
    requestedCargo: null,
  });
  const button = findButtonByText(tree, "Running algorithm comparison...");

  assert.ok(button);
  assert.equal(button.props.disabled, true);
});


test("comparison API posts the current public run id", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify(comparison), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const { client } = await loadModules();
    const result = await client.optimizationApi.compareAlgorithms("run-42");
    assert.equal(request.url.endsWith("/api/optimization/runs/run-42/compare"), true);
    assert.equal(request.options.method, "POST");
    assert.equal(result.run_id, "run-42");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("algorithm comparison panel renders returned metrics and MILP reference label", async () => {
  const { panel } = await loadModules();
  const markup = renderToStaticMarkup(
    React.createElement(panel.default, { comparison, error: null }),
  );

  assert.match(markup, /Algorithm Comparison/);
  assert.match(markup, /MO-QIGA/);
  assert.match(markup, /NSGA-II/);
  assert.match(markup, /MILP Reference/);
  assert.match(markup, /12\.5 ms/);
  assert.match(markup, /25\.0 ms/);
  assert.match(markup, /225\.00/);
});


test("algorithm comparison panel keeps MO-QIGA visible when NSGA-II fails", async () => {
  const { panel } = await loadModules();
  const partial = {
    ...comparison,
    nsga2: {
      ...comparison.nsga2,
      status: "failed",
      error: "population initialization failed",
      feasible: false,
      pareto_count: 0,
      objective_minima: null,
      hypervolume: null,
      spread: null,
      solutions: [],
    },
    comparison: {
      gaps_percent: { ...comparison.comparison.gaps_percent, nsga2: null },
    },
  };
  const markup = renderToStaticMarkup(
    React.createElement(panel.default, { comparison: partial, error: null }),
  );

  assert.match(markup, /MO-QIGA/);
  assert.match(markup, /NSGA-II: population initialization failed/);
  assert.match(markup, /12\.5 ms/);
});


test("Pareto chart renders MO-QIGA, NSGA-II, and MILP comparison overlays", async () => {
  const { chart } = await loadModules();
  const primary = {
    id: "S01", label: "Solution 01", fuel: 115, cost: 0.00023, ghg: 340,
    cargoFulfillment: null, vessels: 1, routes: 1,
    constraintsSatisfied: 1, totalConstraints: 1, pareto: true,
  };
  const comparisonSeries = [
    { name: "MO-QIGA", color: "#14B8A6", solutions: comparison.mo_qiga.solutions },
    { name: "NSGA-II", color: "#8B5CF6", solutions: comparison.nsga2.solutions },
    { name: "MILP Reference", color: "#F59E0B", solutions: Object.values(comparison.milp.references) },
  ];
  const markup = renderToStaticMarkup(React.createElement(chart.default, {
    solutions: [primary],
    selectedId: "S01",
    onSelect: () => {},
    filteredIds: new Set(["S01"]),
    liveFront: [primary],
    axisIdx: 0,
    onAxisChange: () => {},
    comparisonSeries,
  }));

  assert.match(markup, /MO-QIGA/);
  assert.match(markup, /NSGA-II/);
  assert.match(markup, /MILP Reference/);
});


test("a late response from an old run cannot overwrite the current run", async () => {
  const { request } = await loadModules();
  const gate = new request.ComparisonRequestGate();
  const events = [];
  let resolveOld;
  const oldResponse = new Promise(resolve => { resolveOld = resolve; });

  const oldRun = request.runLatestComparisonRequest({
    gate,
    request: () => oldResponse,
    onResult: value => events.push(`old:${value.run_id}`),
    onError: error => events.push(`old-error:${error}`),
    onSettled: () => events.push("old-settled"),
  });
  gate.invalidate();
  await request.runLatestComparisonRequest({
    gate,
    request: async () => ({ run_id: "run-B" }),
    onResult: value => events.push(`new:${value.run_id}`),
    onError: error => events.push(`new-error:${error}`),
    onSettled: () => events.push("new-settled"),
  });
  resolveOld({ run_id: "run-A" });
  await oldRun;

  assert.deepEqual(events, ["new:run-B", "new-settled"]);
});
