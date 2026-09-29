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
  speedMin?: number | null;
  speedMax?: number | null;
  availability: "available" | "in-transit" | "maintenance" | null;
  maintenanceStatus: string | null;
  shorepower: boolean | null;
  currentPort: string | null;
  dataLevel?: string;
}

export interface Route {
  id: string;
  name: string;
  origin?: string;
  destination?: string;
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
  routeId: string | null;
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
  costUsd?: number;
  ghg: number;
  ghgUnit?: string;
  status: "on-schedule" | "warning" | "critical";
  constraints: Constraint[];
  originLatitude?: number | null;
  originLongitude?: number | null;
  destinationLatitude?: number | null;
  destinationLongitude?: number | null;
  distanceNm?: number | null;
  voyageTimeHours?: number | null;
  routeName?: string;
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

export interface AlgorithmComparisonSolution {
  id: string;
  algorithm: "MO-QIGA" | "NSGA-II" | "MILP Reference";
  fuel: number;
  cost: number;
  cost_usd: number;
  ghg: number;
  feasible: boolean;
}

export interface AlgorithmObjectiveMinima {
  fuel: number;
  cost: number;
  ghg: number;
}

export interface AlgorithmObjectiveGaps {
  fuel: number | null;
  cost: number | null;
  ghg: number | null;
}

export interface AlgorithmComparisonSummary {
  status: "complete" | "failed";
  error: string | null;
  runtime_ms: number | null;
  feasible: boolean;
  pareto_count: number;
  objective_minima: AlgorithmObjectiveMinima | null;
  hypervolume: number | null;
  spread: number | null;
  solutions: AlgorithmComparisonSolution[];
}

export interface AlgorithmComparisonResult {
  run_id: string;
  structured_request: StructuredRequest | null;
  input_audit: {
    candidate_count: number;
    feasible_candidate_count: number;
    candidate_ids: string[];
    feasible_candidate_ids: string[];
    candidate_fingerprint: string;
    evaluated_input_fingerprint: string;
    verification_status: "verified" | "unavailable_archived_run";
    algorithm_candidate_fingerprints: Record<string, string>;
  };
  metric_context: {
    normalization_min: number[] | null;
    normalization_max: number[] | null;
    hypervolume_reference_point: number[] | null;
    hypervolume_samples: number;
  };
  mo_qiga: AlgorithmComparisonSummary;
  nsga2: AlgorithmComparisonSummary;
  milp: {
    status: "complete" | "failed";
    error: string | null;
    runtime_ms: number | null;
    feasible: boolean;
    pareto_count: null;
    reference_strategy: "pure_objective_solve";
    references: Partial<Record<"minimum_fuel" | "minimum_cost" | "minimum_ghg", AlgorithmComparisonSolution>>;
  };
  comparison: {
    gaps_percent: {
      mo_qiga: AlgorithmObjectiveGaps | null;
      nsga2: AlgorithmObjectiveGaps | null;
    };
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

export type SeaState = "Calm" | "Slight" | "Moderate" | "Rough" | "Very rough";

export interface FuelPredictionRequest {
  vessel_type: string;
  origin: string;
  destination: string;
  speed_knots: number;
  draft_m: number | null;
  cargo_load_pct: number;
  wind_speed_knots: number;
  wave_height_m: number;
  current_speed_knots: number;
  sea_state: SeaState;
  fuel_type: "DM" | "RM380";
  hull_condition_pct: number;
}

export interface FuelPredictionResult {
  mode: "xgboost_with_planning_adjustments";
  route: { origin: string; destination: string; distance_nm: number };
  prediction: {
    consumption_tonnes_per_day: number;
    lower_tonnes_per_day: number;
    upper_tonnes_per_day: number;
    uncertainty_tonnes_per_day: number;
    confidence_pct: number;
  };
  voyage: {
    duration_days: number;
    fuel_tonnes: number;
    co2e_tonnes: number;
    cost_usd: number;
  };
  breakdown: Array<{
    key: "speed" | "weather" | "draft" | "cargo" | "current" | "hull";
    label: string;
    percent: number;
    source: "xgboost" | "planning_adjustment";
  }>;
  history: Array<{ sample: number; actual: number; predicted: number }>;
  model: {
    name: string;
    test_r2: number;
    test_mae: number;
    excluded_from_training: string[];
    speed_extrapolation_applied: boolean;
    model_speed_range_knots: [number, number];
    unit_assumption: string;
    history_note: string;
  };
}
