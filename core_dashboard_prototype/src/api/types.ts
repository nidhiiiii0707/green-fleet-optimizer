// TypeScript types mirroring the backend API response shapes

export interface Port {
  id: string;
  name: string;
  country: string;
  x: number;
  y: number;
  shorepower: boolean;
  capacity: "high" | "medium" | "low";
}

export interface Vessel {
  id: string;
  name: string;
  type: string;
  capacity: number;
  capacityUnit: string;
  fuelCompatibility: string[];
  speed: number;
  availability: "available" | "in-transit" | "maintenance";
  maintenanceStatus: string;
  shorepower: boolean;
  currentPort: string;
}

export interface Route {
  id: string;
  name: string;
  originId: string;
  destinationId: string;
  distanceNm: number;
  controlX: number;
  controlY: number;
}

export interface Constraint {
  label: string;
  satisfied: boolean;
  note?: string;
}

export interface Assignment {
  id: string;
  vesselId: string;
  cargo: string;
  cargoTEU: number;
  originId: string;
  destinationId: string;
  routeId: string;
  speed: number;
  fuelType: string;
  shorepower: boolean;
  eta: string;
  fuelConsumption: number;
  cost: number;
  ghg: number;
  status: "on-schedule" | "warning" | "critical";
  constraints: Constraint[];
}

export interface ParetoSolution {
  id: string;
  label: string;
  fuel: number;
  cost: number;
  ghg: number;
  cargoFulfillment: number;
  vessels: number;
  routes: number;
  constraintsSatisfied: number;
  totalConstraints: number;
  pareto: boolean;
  assignments?: Assignment[];
}

export interface FuelMixEntry {
  fuel: string;
  vessels: number;
  share: number;
  consumption: number;
  cost: number;
  ghg: number;
  color: string;
}

export interface Alert {
  id: string;
  severity: "high" | "medium" | "info";
  category: string;
  title: string;
  description: string;
  affected: string;
  timestamp: string;
  status: "active" | "acknowledged";
}

export interface OptimizationResult {
  run_id: string;
  status: string;
  method: string;
  feasible_solutions: number;
  pareto_count: number;
  runtime_seconds: number;
  constraint_satisfaction: string;
  pareto_solutions: ParetoSolution[];
  baseline: { fuel: number; cost: number; ghg: number; cargoFulfillment: number };
  optimized: { fuel: number; cost: number; ghg: number; cargoFulfillment: number };
  fuel_mix: FuelMixEntry[];
  selected_solution_id: string;
  algorithm_comparison?: {
    mo_qiga_vs_nsga2: string[][];
    milp_comparison: string[][];
    scalability: string[][];
  };
}

export interface JobStatus {
  job_id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  message: string;
  created_at: string;
  completed_at?: string;
  error?: string;
}

export interface ScenarioControls {
  demand: number;
  fuel: number;
  ghg: number;
  deadline: number;
  vessels: number;
  fuelAvail: number;
  portCap: number;
}

export interface ScenarioResult {
  fuelChange: number;
  costChange: number;
  ghgChange: number;
  cargoFulfillment: number;
  scenarioFuel: number;
  scenarioCost: number;
  scenarioGhg: number;
  constraintChanges: string[];
  note: string;
}

export interface NLPResult {
  query: string;
  parsed: Record<string, unknown>;
  warnings: string[];
  recommended_solution_id: string | null;
  solutions: ParetoSolution[];
  nlp_used: boolean;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  date: string;
  run: string;
  type: "optimization" | "sustainability" | "tradeoff" | "compliance";
  ready: boolean;
}
