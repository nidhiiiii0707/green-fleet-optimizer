// TypeScript types mirroring the backend API response shapes

export interface Port {
  id: string;
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
  x: number;
  y: number;
  shorepower: boolean | null;
  capacity: "high" | "medium" | "low" | null;
  coordinateStatus?: string | null;
}

export interface Vessel {
  id: string;
  name: string;
  type: string;
  capacity: number;
  capacityUnit: string;
  fuelCompatibility: string[];
  speed: number;
  availability: "available" | "in-transit" | "maintenance" | null;
  maintenanceStatus: string | null;
  shorepower: boolean | null;
  currentPort: string | null;
  dataLevel?: string;
}

export interface Route {
  id: string;
  name: string;
  originId: string;
  destinationId: string;
  distanceNm: number;
  voyageTimeHours?: number | null;
  speedKnots?: number | null;
  originLatitude: number;
  originLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  controlX: number;
  controlY: number;
}

export interface Constraint {
  label: string;
  satisfied: boolean;
  note?: string;
  status?: "passed" | "failed" | "unavailable";
}

export interface Assignment {
  id: string;
  vesselId: string;
  cargo: string;
  cargoTEU: number;
  originId: string;
  destinationId: string;
  routeId: string;
  vesselType?: string;
  origin?: string;
  destination?: string;
  cargoTons?: number;
  speed: number;
  fuelType: string;
  shorepower: boolean | null;
  eta: string | null;
  fuelConsumption: number;
  cost: number;
  ghg: number;
  ghgUnit?: string;
  status: "on-schedule" | "warning" | "critical";
  constraints: Constraint[];
}

export interface ParetoSolution {
  id: string;
  label: string;
  fuel: number;
  cost: number;
  ghg: number;
  cargoFulfillment: number | null;
  vessels: number;
  routes: number;
  constraintsSatisfied: number;
  totalConstraints: number;
  pareto: boolean;
  assignments?: Assignment[];
  algorithm?: string;
  optimizerSolutionId?: string;
  emptyStateReason?: string | null;
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
  runtime_seconds: number | null;
  constraint_satisfaction: string;
  pareto_solutions: ParetoSolution[];
  baseline: { fuel: number; cost: number; ghg: number; cargoFulfillment: number | null } | null;
  optimized: { fuel: number; cost: number; ghg: number; cargoFulfillment: number | null };
  fuel_mix: FuelMixEntry[];
  selected_solution_id: string;
  data_mode: "real_precomputed" | "real_runtime" | "mock_offline";
  source?: string;
  structured_request?: StructuredRequest;
  request_warnings?: string[];
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
  fuelChange: number | null;
  costChange: number | null;
  ghgChange: number | null;
  cargoFulfillment: number | null;
  scenarioFuel: number;
  scenarioCost: number;
  scenarioGhg: number;
  baselineFuel: number;
  baselineCost: number;
  baselineGhg: number;
  scenarioSolutionId: string;
  constraintChanges: string[];
  note: string;
}

export type Objective = "fuel" | "cost" | "ghg";

/** The structured request shape shared by the manual form, NLP parsing, and
 * POST /api/optimization/run. Unspecified fields are null/empty — never invented. */
export interface StructuredRequest {
  origin: string | null;
  destination: string | null;
  vessel_type: string | null;
  fuel_type: string | null;
  speed: number | null;
  cargo: number | null;
  objectives: Objective[];
}

export interface ParsedQuery extends StructuredRequest {
  origin_valid?: boolean;
  origin_suggestion?: string | null;
  destination_valid?: boolean;
  destination_suggestion?: string | null;
}

export interface NLPParseResult {
  query: string;
  normalized_query: string | null;
  gemini_used: boolean;
  gemini_error: string | null;
  parsed: ParsedQuery;
  request: StructuredRequest;
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
