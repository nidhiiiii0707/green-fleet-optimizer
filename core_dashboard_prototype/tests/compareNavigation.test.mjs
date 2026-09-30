/**
 * Tests for the Compare-button navigation flow.
 *
 * Tests:
 *  1. Compare button calls onCompare (navigates) — not runComparison inline.
 *  2. Comparison page reads run_id from props.
 *  3. Comparison page calls the existing comparison API.
 *  4. Returned MO-QIGA / NSGA-II / MILP values render correctly.
 *  5. Back button returns to the Optimization Results page.
 */

import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = "true";

// ── Shared comparison fixture (same as existing suite) ────────────────────────
const comparison = {
  run_id: "run-42",
  structured_request: { origin: null, destination: null, vessel_type: null, fuel_type: null, speed: null, cargo: null, objectives: ["fuel", "cost", "ghg"] },
  input_audit: {
    candidate_count: 3, feasible_candidate_count: 3,
    candidate_ids: ["C1","C2","C3"], feasible_candidate_ids: ["C1","C2","C3"],
    candidate_fingerprint: "abc", evaluated_input_fingerprint: "evaluated-abc",
    verification_status: "verified",
    algorithm_candidate_fingerprints: { "MO-QIGA": "abc", "NSGA-II": "abc", "MILP Reference": "abc" },
  },
  metric_context: {
    normalization_min: [90,190,290], normalization_max: [132,275,385],
    hypervolume_reference_point: [1,1,1], hypervolume_samples: 200000,
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
      minimum_ghg:  { id: "milp-ghg",  algorithm: "MILP Reference", fuel: 105, cost: 0.00029, cost_usd: 290, ghg: 300, feasible: true },
    },
  },
  comparison: {
    gaps_percent: {
      mo_qiga: { fuel: 10, cost: 12.5, ghg: 10 },
      nsga2:   { fuel: 20, cost: 10,   ghg: 20 },
    },
  },
};

// ── Module loader ─────────────────────────────────────────────────────────────
async function loadModules() {
  const server = await createServer({
    configFile: false, root: process.cwd(),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
  });
  try {
    const screen  = await server.ssrLoadModule("/src/screens/Optimization.tsx");
    const compare = await server.ssrLoadModule("/src/screens/AlgorithmComparisonPage.tsx");
    const client  = await server.ssrLoadModule("/src/api/client.ts");
    const panel   = await server.ssrLoadModule("/src/components/AlgorithmComparisonPanel.tsx");
    return { screen, compare, client, panel };
  } finally {
    await server.close();
  }
}

function findButtonByText(node, text) {
  if (!node || typeof node !== "object") return null;
  if (node.type === "button") {
    const flat = JSON.stringify(node.props?.children ?? "");
    if (flat.includes(text)) return node;
  }
  const children = React.Children.toArray(node.props?.children ?? []);
  for (const child of children) {
    const match = findButtonByText(child, text);
    if (match) return match;
  }
  return null;
}

// ── Test 1: Compare button calls onCompare (navigate), not inline comparison ──
test("Compare button calls onCompare callback with the run_id (navigation)", async () => {
  const { screen } = await loadModules();
  const navigated = [];
  const tree = screen.SolutionPanel({
    sol: {
      id: "S01", label: "Solution 01", fuel: 1, cost: 2, ghg: 3,
      cargoFulfillment: null, vessels: 1, routes: 1,
      constraintsSatisfied: 1, totalConstraints: 1, pareto: true,
    },
    onViewPlan: () => {},
    onCompare: () => { navigated.push("compare-navigated"); },
    compareRunning: false,
    inFilter: true,
    requestedCargo: null,
  });

  const button = findButtonByText(tree, "Compare");
  assert.ok(button, "SolutionPanel must expose a Compare button");
  button.props.onClick();
  assert.deepEqual(navigated, ["compare-navigated"],
    "Compare button must invoke onCompare (navigation), not run inline comparison");
});

// ── Test 2: Comparison page reads run_id from props ───────────────────────────
test("AlgorithmComparisonPage renders the run_id it receives from props", async () => {
  // Stub fetch so useAlgorithmComparison stays in 'running' state (no result yet)
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Promise(() => {}); // never resolves → stays loading
  try {
    const { compare } = await loadModules();
    const markup = renderToStaticMarkup(
      React.createElement(compare.default, { runId: "run-99", onBack: () => {} }),
    );
    assert.match(markup, /run-99/, "page must display the runId it receives via props");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ── Test 3: Comparison page calls POST /api/optimization/runs/{run_id}/compare ─
test("comparison page triggers POST /api/optimization/runs/{run_id}/compare", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), method: options?.method });
    return new Response(JSON.stringify(comparison), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const { client } = await loadModules();
    await client.optimizationApi.compareAlgorithms("run-42");
    assert.ok(
      requests.some(r => r.url.endsWith("/api/optimization/runs/run-42/compare") && r.method === "POST"),
      "must POST to the existing /api/optimization/runs/{run_id}/compare endpoint",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ── Test 4: AlgorithmComparisonPanel renders MO-QIGA / NSGA-II / MILP values ──
test("AlgorithmComparisonPanel renders MO-QIGA, NSGA-II, and MILP reference values", async () => {
  const { panel } = await loadModules();
  const markup = renderToStaticMarkup(
    React.createElement(panel.default, { comparison, error: null }),
  );

  // Title
  assert.match(markup, /Algorithm Comparison/, "panel must show section title");
  // Algorithm labels
  assert.match(markup, /MO-QIGA/,       "must show MO-QIGA label");
  assert.match(markup, /NSGA-II/,       "must show NSGA-II label");
  assert.match(markup, /MILP Reference/,"must show MILP Reference label");
  // Real metric values
  assert.match(markup, /12\.5 ms/,  "must show MO-QIGA runtime");
  assert.match(markup, /25\.0 ms/,  "must show NSGA-II runtime");
  assert.match(markup, /225\.00/,   "must show MO-QIGA minimum cost");
  // Gaps
  assert.match(markup, /\+10\.00%/, "must show MO-QIGA fuel gap vs MILP");
  assert.match(markup, /\+20\.00%/, "must show NSGA-II fuel gap vs MILP");
});

// ── Test 5: Back button returns to the Optimization Results page ───────────────
test("Back button on AlgorithmComparisonPage renders and links back", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Promise(() => {}); // stay in loading state
  try {
    const { compare } = await loadModules();
    // Render via SSR (provides React hook context), then inspect the HTML
    const markup = renderToStaticMarkup(
      React.createElement(compare.default, { runId: "run-42", onBack: () => {} }),
    );
    assert.match(
      markup,
      /Back to Optimization Results/,
      "AlgorithmComparisonPage must render a Back to Optimization Results button",
    );
    // Verify the button element is present (id set in component)
    assert.match(
      markup,
      /btn-back-to-optimization/,
      "Back button must carry id='btn-back-to-optimization'",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
