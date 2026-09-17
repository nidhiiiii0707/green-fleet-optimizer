// GreenFleet AI — Mock Data

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
  constraints: { label: string; satisfied: boolean; note?: string }[];
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

// ─── PORTS ────────────────────────────────────────────────────────────────────
// SVG coordinates for 900×440 equirectangular world map
export const PORTS: Port[] = [
  { id: "RTM", name: "Rotterdam",    country: "Netherlands",   x: 461, y: 93,  shorepower: true,  capacity: "high"   },
  { id: "SGP", name: "Singapore",    country: "Singapore",     x: 709, y: 217, shorepower: true,  capacity: "high"   },
  { id: "SHA", name: "Shanghai",     country: "China",         x: 755, y: 144, shorepower: true,  capacity: "high"   },
  { id: "LAX", name: "Los Angeles",  country: "USA",           x: 154, y: 137, shorepower: true,  capacity: "high"   },
  { id: "HOU", name: "Houston",      country: "USA",           x: 210, y: 148, shorepower: false, capacity: "medium" },
  { id: "DXB", name: "Dubai",        country: "UAE",           x: 586, y: 158, shorepower: false, capacity: "medium" },
  { id: "YKH", name: "Yokohama",     country: "Japan",         x: 800, y: 133, shorepower: true,  capacity: "high"   },
  { id: "SYD", name: "Sydney",       country: "Australia",     x: 825, y: 303, shorepower: true,  capacity: "medium" },
  { id: "CPT", name: "Cape Town",    country: "South Africa",  x: 496, y: 303, shorepower: false, capacity: "medium" },
  { id: "STS", name: "Santos",       country: "Brazil",        x: 332, y: 278, shorepower: false, capacity: "medium" },
  { id: "BOM", name: "Mumbai",       country: "India",         x: 630, y: 173, shorepower: false, capacity: "medium" },
  { id: "PUS", name: "Busan",        country: "South Korea",   x: 772, y: 120, shorepower: true,  capacity: "high"   },
];

// ─── VESSELS ──────────────────────────────────────────────────────────────────
export const VESSELS: Vessel[] = [
  { id: "V01", name: "MV Ocean Star",       type: "Bulk Carrier",     capacity: 75000,  capacityUnit: "MT",  fuelCompatibility: ["LNG", "Conv"],           speed: 15, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: true,  currentPort: "RTM" },
  { id: "V02", name: "MV Pacific Horizon",  type: "Container Ship",   capacity: 8500,   capacityUnit: "TEU", fuelCompatibility: ["Methanol", "LNG"],        speed: 18, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: true,  currentPort: "SHA" },
  { id: "V03", name: "MV Green Voyager",    type: "LNG Carrier",      capacity: 150000, capacityUnit: "m³",  fuelCompatibility: ["LNG"],                    speed: 16, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: true,  currentPort: "RTM" },
  { id: "V04", name: "MV Atlantic Pioneer", type: "Bulk Carrier",     capacity: 82000,  capacityUnit: "MT",  fuelCompatibility: ["Conv", "LNG"],            speed: 14, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: false, currentPort: "HOU" },
  { id: "V05", name: "MV Meridian Express", type: "Container Ship",   capacity: 12000,  capacityUnit: "TEU", fuelCompatibility: ["Methanol"],               speed: 20, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: true,  currentPort: "LAX" },
  { id: "V06", name: "MV Nordic Tide",      type: "RoRo",             capacity: 4500,   capacityUnit: "CEU", fuelCompatibility: ["LNG", "Conv"],            speed: 16, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: false, currentPort: "SGP" },
  { id: "V07", name: "MV Cape Navigator",   type: "Bulk Carrier",     capacity: 65000,  capacityUnit: "MT",  fuelCompatibility: ["Conv"],                   speed: 14, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: false, currentPort: "CPT" },
  { id: "V08", name: "MV Eastern Star",     type: "Container Ship",   capacity: 9500,   capacityUnit: "TEU", fuelCompatibility: ["LNG"],                    speed: 18, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: true,  currentPort: "LAX" },
  { id: "V09", name: "MV Gulf Trader",      type: "Tanker",           capacity: 95000,  capacityUnit: "DWT", fuelCompatibility: ["Conv", "Methanol"],       speed: 15, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: false, currentPort: "DXB" },
  { id: "V10", name: "MV Solar Winds",      type: "Container Ship",   capacity: 14000,  capacityUnit: "TEU", fuelCompatibility: ["Ammonia", "LNG"],         speed: 19, availability: "available",    maintenanceStatus: "Normal",    shorepower: true,  currentPort: "SGP" },
  { id: "V11", name: "MV Coral Reef",       type: "Bulk Carrier",     capacity: 55000,  capacityUnit: "MT",  fuelCompatibility: ["Conv"],                   speed: 14, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: false, currentPort: "STS" },
  { id: "V12", name: "MV Blue Horizon",     type: "Container Ship",   capacity: 7200,   capacityUnit: "TEU", fuelCompatibility: ["LNG", "Methanol"],        speed: 17, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: true,  currentPort: "RTM" },
  { id: "V13", name: "MV Sea Falcon",       type: "Tanker",           capacity: 80000,  capacityUnit: "DWT", fuelCompatibility: ["Conv"],                   speed: 15, availability: "available",    maintenanceStatus: "Normal",    shorepower: false, currentPort: "DXB" },
  { id: "V14", name: "MV Arctic Wind",      type: "LNG Carrier",      capacity: 174000, capacityUnit: "m³",  fuelCompatibility: ["LNG"],                    speed: 17, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: true,  currentPort: "RTM" },
  { id: "V15", name: "MV Endeavour",        type: "Bulk Carrier",     capacity: 90000,  capacityUnit: "MT",  fuelCompatibility: ["Conv", "LNG"],            speed: 14, availability: "available",    maintenanceStatus: "Normal",    shorepower: false, currentPort: "CPT" },
  { id: "V16", name: "MV Pacific Star",     type: "Container Ship",   capacity: 11500,  capacityUnit: "TEU", fuelCompatibility: ["Methanol", "LNG"],        speed: 20, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: true,  currentPort: "SHA" },
  { id: "V17", name: "MV Ocean Pearl",      type: "RoRo",             capacity: 5200,   capacityUnit: "CEU", fuelCompatibility: ["Conv"],                   speed: 16, availability: "available",    maintenanceStatus: "Due in 14d", shorepower: false, currentPort: "SYD" },
  { id: "V18", name: "MV Asian Spirit",     type: "Container Ship",   capacity: 8800,   capacityUnit: "TEU", fuelCompatibility: ["LNG"],                    speed: 18, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: true,  currentPort: "SGP" },
  { id: "V19", name: "MV Maritime Crown",   type: "Bulk Carrier",     capacity: 72000,  capacityUnit: "MT",  fuelCompatibility: ["Conv", "LNG"],            speed: 14, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: false, currentPort: "RTM" },
  { id: "V20", name: "MV Equator",          type: "Tanker",           capacity: 95000,  capacityUnit: "DWT", fuelCompatibility: ["Methanol"],               speed: 16, availability: "available",    maintenanceStatus: "Normal",    shorepower: false, currentPort: "HOU" },
  { id: "V21", name: "MV Southern Cross",   type: "Container Ship",   capacity: 13500,  capacityUnit: "TEU", fuelCompatibility: ["LNG", "Ammonia"],         speed: 19, availability: "available",    maintenanceStatus: "Normal",    shorepower: true,  currentPort: "SYD" },
  { id: "V22", name: "MV North Star",       type: "Bulk Carrier",     capacity: 68000,  capacityUnit: "MT",  fuelCompatibility: ["Conv"],                   speed: 14, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: false, currentPort: "RTM" },
  { id: "V23", name: "MV Eagle Bay",        type: "Container Ship",   capacity: 10200,  capacityUnit: "TEU", fuelCompatibility: ["Methanol", "LNG"],        speed: 18, availability: "in-transit",  maintenanceStatus: "Normal",    shorepower: true,  currentPort: "PUS" },
  { id: "V24", name: "MV Deep Blue",        type: "LNG Carrier",      capacity: 138000, capacityUnit: "m³",  fuelCompatibility: ["LNG"],                    speed: 17, availability: "maintenance",  maintenanceStatus: "In Service", shorepower: true,  currentPort: "SGP" },
];

// ─── ROUTES ───────────────────────────────────────────────────────────────────
// controlX/controlY = bezier curve control point for rendering
export const ROUTES: Route[] = [
  { id: "R01", name: "Europe–Asia (Suez)",       originId: "RTM", destinationId: "SGP", distanceNm: 10847, controlX: 575, controlY: 155 },
  { id: "R02", name: "Europe–China (Suez)",       originId: "RTM", destinationId: "SHA", distanceNm: 11430, controlX: 618, controlY: 118 },
  { id: "R03", name: "Trans-Pacific W→E",         originId: "LAX", destinationId: "YKH", distanceNm: 5248,  controlX: 477, controlY: 58  },
  { id: "R04", name: "Trans-Pacific W→E (Korea)", originId: "LAX", destinationId: "PUS", distanceNm: 5750,  controlX: 465, controlY: 60  },
  { id: "R05", name: "Trans-Atlantic E",          originId: "HOU", destinationId: "RTM", distanceNm: 5180,  controlX: 335, controlY: 88  },
  { id: "R06", name: "Americas North–South",      originId: "HOU", destinationId: "STS", distanceNm: 4820,  controlX: 268, controlY: 248 },
  { id: "R07", name: "SE Asia–Oceania",           originId: "SGP", destinationId: "SYD", distanceNm: 3920,  controlX: 790, controlY: 252 },
  { id: "R08", name: "Africa–Europe Atlantic",    originId: "CPT", destinationId: "RTM", distanceNm: 6380,  controlX: 415, controlY: 198 },
  { id: "R09", name: "Arabian Sea Short",         originId: "DXB", destinationId: "BOM", distanceNm: 1230,  controlX: 608, controlY: 162 },
  { id: "R10", name: "Indian Ocean–SE Asia",      originId: "BOM", destinationId: "SGP", distanceNm: 2520,  controlX: 678, controlY: 192 },
  { id: "R11", name: "Trans-Pacific E→W (China)", originId: "SHA", destinationId: "LAX", distanceNm: 6020,  controlX: 455, controlY: 52  },
  { id: "R12", name: "Trans-Pacific E→W (Japan)", originId: "YKH", destinationId: "LAX", distanceNm: 5248,  controlX: 477, controlY: 56  },
  { id: "R13", name: "S Atlantic North",          originId: "STS", destinationId: "RTM", distanceNm: 5940,  controlX: 395, controlY: 172 },
  { id: "R14", name: "India–Europe (Suez)",       originId: "BOM", destinationId: "RTM", distanceNm: 6050,  controlX: 545, controlY: 115 },
  { id: "R15", name: "Oceania–SE Asia",           originId: "SYD", destinationId: "SGP", distanceNm: 3920,  controlX: 788, controlY: 248 },
  { id: "R16", name: "SE Asia–China",             originId: "SGP", destinationId: "SHA", distanceNm: 2220,  controlX: 745, controlY: 178 },
  { id: "R17", name: "Trans-Pacific E→W (Korea)", originId: "PUS", destinationId: "LAX", distanceNm: 5750,  controlX: 463, controlY: 60  },
  { id: "R18", name: "Africa–Asia (Indian Ocean)",originId: "CPT", destinationId: "SGP", distanceNm: 7120,  controlX: 618, controlY: 258 },
];

// ─── CONSTRAINTS ──────────────────────────────────────────────────────────────
export const PLAN_CONSTRAINTS = [
  { label: "Cargo Demand",         satisfied: true,  note: "" },
  { label: "Vessel Capacity",      satisfied: true,  note: "" },
  { label: "Vessel Availability",  satisfied: true,  note: "" },
  { label: "Fuel Compatibility",   satisfied: true,  note: "" },
  { label: "Port Capacity",        satisfied: true,  note: "" },
  { label: "Delivery Deadline",    satisfied: true,  note: "" },
  { label: "Fuel Availability",    satisfied: true,  note: "" },
  { label: "GHG Limit",            satisfied: true,  note: "Approaching configured threshold — 4.1% headroom" },
  { label: "Shore Power Rules",    satisfied: true,  note: "" },
  { label: "Speed Limits",         satisfied: true,  note: "" },
  { label: "Operational Rules",    satisfied: true,  note: "" },
  { label: "Regulatory Compliance",satisfied: true,  note: "" },
];

// ─── SOLUTION #07 ASSIGNMENTS ─────────────────────────────────────────────────
const S07_ASSIGNMENTS: Assignment[] = [
  { id: "A01", vesselId: "V01", cargo: "Grain",           cargoTEU: 45000, originId: "RTM", destinationId: "SGP", routeId: "R01", speed: 15, fuelType: "LNG",      shorepower: true,  eta: "12 Feb 2025", fuelConsumption: 820,  cost: 185, ghg: 2240, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A02", vesselId: "V02", cargo: "Electronics",     cargoTEU: 6200,  originId: "SHA", destinationId: "LAX", routeId: "R11", speed: 18, fuelType: "Methanol", shorepower: true,  eta: "10 Feb 2025", fuelConsumption: 960,  cost: 218, ghg: 1640, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A03", vesselId: "V03", cargo: "LNG Cargo",       cargoTEU: 92000, originId: "RTM", destinationId: "SHA", routeId: "R02", speed: 16, fuelType: "LNG",      shorepower: true,  eta: "20 Feb 2025", fuelConsumption: 1150, cost: 262, ghg: 2850, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A04", vesselId: "V04", cargo: "Iron Ore",        cargoTEU: 78000, originId: "HOU", destinationId: "RTM", routeId: "R05", speed: 14, fuelType: "Conv",     shorepower: false, eta: "18 Feb 2025", fuelConsumption: 1020, cost: 196, ghg: 3180, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A05", vesselId: "V05", cargo: "Consumer Goods",  cargoTEU: 10800, originId: "LAX", destinationId: "YKH", routeId: "R03", speed: 20, fuelType: "Methanol", shorepower: true,  eta: "08 Feb 2025", fuelConsumption: 1280, cost: 305, ghg: 2190, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A06", vesselId: "V06", cargo: "Vehicles",        cargoTEU: 4200,  originId: "SGP", destinationId: "SYD", routeId: "R07", speed: 16, fuelType: "LNG",      shorepower: true,  eta: "22 Feb 2025", fuelConsumption: 540,  cost: 128, ghg: 1380, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A07", vesselId: "V07", cargo: "Coal",            cargoTEU: 62000, originId: "CPT", destinationId: "RTM", routeId: "R08", speed: 14, fuelType: "Conv",     shorepower: false, eta: "25 Feb 2025", fuelConsumption: 780,  cost: 148, ghg: 2430, status: "warning",     constraints: PLAN_CONSTRAINTS },
  { id: "A08", vesselId: "V08", cargo: "Machinery",       cargoTEU: 8200,  originId: "LAX", destinationId: "PUS", routeId: "R04", speed: 18, fuelType: "LNG",      shorepower: true,  eta: "14 Feb 2025", fuelConsumption: 920,  cost: 212, ghg: 2280, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A09", vesselId: "V09", cargo: "Crude Oil",       cargoTEU: 88000, originId: "DXB", destinationId: "BOM", routeId: "R09", speed: 15, fuelType: "Conv",     shorepower: false, eta: "05 Feb 2025", fuelConsumption: 280,  cost: 64,  ghg: 870,  status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A10", vesselId: "V10", cargo: "Mixed Cargo",     cargoTEU: 11200, originId: "BOM", destinationId: "SGP", routeId: "R10", speed: 19, fuelType: "Ammonia",  shorepower: false, eta: "07 Feb 2025", fuelConsumption: 420,  cost: 148, ghg: 520,  status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A11", vesselId: "V11", cargo: "Phosphates",      cargoTEU: 52000, originId: "STS", destinationId: "RTM", routeId: "R13", speed: 14, fuelType: "Conv",     shorepower: false, eta: "28 Feb 2025", fuelConsumption: 740,  cost: 142, ghg: 2305, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A12", vesselId: "V12", cargo: "General Cargo",   cargoTEU: 6800,  originId: "RTM", destinationId: "SGP", routeId: "R01", speed: 17, fuelType: "Methanol", shorepower: true,  eta: "15 Feb 2025", fuelConsumption: 880,  cost: 198, ghg: 1510, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A13", vesselId: "V13", cargo: "Refined Products",cargoTEU: 72000, originId: "DXB", destinationId: "BOM", routeId: "R09", speed: 15, fuelType: "Conv",     shorepower: false, eta: "06 Feb 2025", fuelConsumption: 290,  cost: 66,  ghg: 902,  status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A14", vesselId: "V14", cargo: "LNG Cargo",       cargoTEU: 138000,originId: "RTM", destinationId: "SHA", routeId: "R02", speed: 17, fuelType: "LNG",      shorepower: true,  eta: "22 Feb 2025", fuelConsumption: 1180, cost: 268, ghg: 2920, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A15", vesselId: "V15", cargo: "Iron Ore",        cargoTEU: 85000, originId: "CPT", destinationId: "RTM", routeId: "R08", speed: 14, fuelType: "Conv",     shorepower: false, eta: "26 Feb 2025", fuelConsumption: 800,  cost: 153, ghg: 2490, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A16", vesselId: "V16", cargo: "Consumer Goods",  cargoTEU: 10500, originId: "SHA", destinationId: "LAX", routeId: "R11", speed: 20, fuelType: "Methanol", shorepower: true,  eta: "09 Feb 2025", fuelConsumption: 1200, cost: 272, ghg: 2056, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A17", vesselId: "V17", cargo: "Vehicles",        cargoTEU: 4800,  originId: "SYD", destinationId: "SGP", routeId: "R15", speed: 16, fuelType: "Conv",     shorepower: false, eta: "18 Feb 2025", fuelConsumption: 510,  cost: 119, ghg: 1588, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A18", vesselId: "V18", cargo: "Electronics",     cargoTEU: 8000,  originId: "SGP", destinationId: "SHA", routeId: "R16", speed: 18, fuelType: "LNG",      shorepower: true,  eta: "11 Feb 2025", fuelConsumption: 460,  cost: 104, ghg: 1140, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A19", vesselId: "V19", cargo: "Steel",           cargoTEU: 68000, originId: "HOU", destinationId: "RTM", routeId: "R05", speed: 14, fuelType: "LNG",      shorepower: false, eta: "18 Feb 2025", fuelConsumption: 980,  cost: 222, ghg: 2428, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A20", vesselId: "V20", cargo: "Chemicals",       cargoTEU: 82000, originId: "HOU", destinationId: "STS", routeId: "R06", speed: 16, fuelType: "Methanol", shorepower: false, eta: "10 Feb 2025", fuelConsumption: 580,  cost: 142, ghg: 994,  status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A21", vesselId: "V21", cargo: "Mixed Cargo",     cargoTEU: 12000, originId: "SYD", destinationId: "SGP", routeId: "R15", speed: 19, fuelType: "LNG",      shorepower: true,  eta: "17 Feb 2025", fuelConsumption: 490,  cost: 118, ghg: 1215, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A22", vesselId: "V22", cargo: "Coal",            cargoTEU: 65000, originId: "RTM", destinationId: "SGP", routeId: "R01", speed: 14, fuelType: "Conv",     shorepower: false, eta: "20 Feb 2025", fuelConsumption: 850,  cost: 162, ghg: 2648, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A23", vesselId: "V23", cargo: "Machinery",       cargoTEU: 9200,  originId: "PUS", destinationId: "LAX", routeId: "R17", speed: 18, fuelType: "Methanol", shorepower: true,  eta: "12 Feb 2025", fuelConsumption: 920,  cost: 210, ghg: 1576, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
  { id: "A24", vesselId: "V24", cargo: "LNG Cargo",       cargoTEU: 110000,originId: "BOM", destinationId: "RTM", routeId: "R14", speed: 17, fuelType: "LNG",      shorepower: true,  eta: "24 Feb 2025", fuelConsumption: 940,  cost: 212, ghg: 2330, status: "on-schedule", constraints: PLAN_CONSTRAINTS },
];

// ─── PARETO SOLUTIONS ─────────────────────────────────────────────────────────
// 18 Pareto-optimal + 24 dominated = 42 feasible total
// Trade-off: lower GHG → higher cost; lower cost → higher GHG
export const PARETO_SOLUTIONS: ParetoSolution[] = [
  // Pareto-optimal (cost vs GHG trade-off front)
  { id: "S01", label: "Solution #01", fuel: 20500, cost: 5.40, ghg: 50200, cargoFulfillment: 98.2, vessels: 24, routes: 18, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S02", label: "Solution #02", fuel: 20100, cost: 5.22, ghg: 51500, cargoFulfillment: 98.0, vessels: 24, routes: 18, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S03", label: "Solution #03", fuel: 19500, cost: 5.08, ghg: 52400, cargoFulfillment: 97.8, vessels: 23, routes: 17, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S04", label: "Solution #04", fuel: 19100, cost: 4.97, ghg: 53200, cargoFulfillment: 97.5, vessels: 24, routes: 17, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S05", label: "Solution #05", fuel: 18800, cost: 4.90, ghg: 53800, cargoFulfillment: 97.6, vessels: 23, routes: 18, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S06", label: "Solution #06", fuel: 18600, cost: 4.85, ghg: 54350, cargoFulfillment: 97.7, vessels: 24, routes: 18, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S07", label: "Solution #07", fuel: 18420, cost: 4.82, ghg: 54820, cargoFulfillment: 97.8, vessels: 24, routes: 18, constraintsSatisfied: 12, totalConstraints: 12, pareto: true, assignments: S07_ASSIGNMENTS },
  { id: "S08", label: "Solution #08", fuel: 18200, cost: 4.78, ghg: 55800, cargoFulfillment: 97.4, vessels: 23, routes: 18, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S09", label: "Solution #09", fuel: 17900, cost: 4.72, ghg: 56800, cargoFulfillment: 97.2, vessels: 23, routes: 17, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S10", label: "Solution #10", fuel: 17600, cost: 4.65, ghg: 57800, cargoFulfillment: 97.0, vessels: 22, routes: 17, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S11", label: "Solution #11", fuel: 17400, cost: 4.58, ghg: 58900, cargoFulfillment: 96.8, vessels: 22, routes: 16, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S12", label: "Solution #12", fuel: 17200, cost: 4.52, ghg: 60100, cargoFulfillment: 96.5, vessels: 22, routes: 16, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S13", label: "Solution #13", fuel: 17100, cost: 4.48, ghg: 61200, cargoFulfillment: 96.2, vessels: 21, routes: 16, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S14", label: "Solution #14", fuel: 17000, cost: 4.44, ghg: 62000, cargoFulfillment: 96.0, vessels: 21, routes: 15, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S15", label: "Solution #15", fuel: 16900, cost: 4.41, ghg: 62800, cargoFulfillment: 95.8, vessels: 21, routes: 15, constraintsSatisfied: 12, totalConstraints: 12, pareto: true },
  { id: "S16", label: "Solution #16", fuel: 16800, cost: 4.39, ghg: 63600, cargoFulfillment: 95.5, vessels: 20, routes: 15, constraintsSatisfied: 11, totalConstraints: 12, pareto: true },
  { id: "S17", label: "Solution #17", fuel: 16700, cost: 4.37, ghg: 64200, cargoFulfillment: 95.2, vessels: 20, routes: 14, constraintsSatisfied: 11, totalConstraints: 12, pareto: true },
  { id: "S18", label: "Solution #18", fuel: 16600, cost: 4.34, ghg: 65000, cargoFulfillment: 94.8, vessels: 20, routes: 14, constraintsSatisfied: 11, totalConstraints: 12, pareto: true },
  // Dominated (feasible but not Pareto-optimal)
  { id: "F01", label: "Feasible #01", fuel: 21200, cost: 5.10, ghg: 56400, cargoFulfillment: 96.5, vessels: 22, routes: 16, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F02", label: "Feasible #02", fuel: 20800, cost: 4.98, ghg: 57200, cargoFulfillment: 96.2, vessels: 23, routes: 17, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F03", label: "Feasible #03", fuel: 19900, cost: 5.35, ghg: 53800, cargoFulfillment: 97.0, vessels: 24, routes: 18, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F04", label: "Feasible #04", fuel: 20200, cost: 5.18, ghg: 55200, cargoFulfillment: 96.8, vessels: 22, routes: 17, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F05", label: "Feasible #05", fuel: 19200, cost: 5.00, ghg: 55900, cargoFulfillment: 96.5, vessels: 23, routes: 16, constraintsSatisfied: 11, totalConstraints: 12, pareto: false },
  { id: "F06", label: "Feasible #06", fuel: 18900, cost: 4.96, ghg: 56800, cargoFulfillment: 97.1, vessels: 22, routes: 17, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F07", label: "Feasible #07", fuel: 19600, cost: 5.08, ghg: 54800, cargoFulfillment: 96.4, vessels: 23, routes: 17, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F08", label: "Feasible #08", fuel: 18100, cost: 4.82, ghg: 58200, cargoFulfillment: 96.9, vessels: 22, routes: 16, constraintsSatisfied: 11, totalConstraints: 12, pareto: false },
  { id: "F09", label: "Feasible #09", fuel: 17500, cost: 4.62, ghg: 60400, cargoFulfillment: 96.3, vessels: 21, routes: 16, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F10", label: "Feasible #10", fuel: 17800, cost: 4.72, ghg: 59100, cargoFulfillment: 95.8, vessels: 22, routes: 17, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F11", label: "Feasible #11", fuel: 20600, cost: 5.28, ghg: 53200, cargoFulfillment: 97.2, vessels: 24, routes: 18, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F12", label: "Feasible #12", fuel: 19800, cost: 5.14, ghg: 54100, cargoFulfillment: 97.4, vessels: 23, routes: 18, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F13", label: "Feasible #13", fuel: 18500, cost: 4.88, ghg: 57500, cargoFulfillment: 96.6, vessels: 22, routes: 17, constraintsSatisfied: 11, totalConstraints: 12, pareto: false },
  { id: "F14", label: "Feasible #14", fuel: 17300, cost: 4.60, ghg: 61500, cargoFulfillment: 95.5, vessels: 21, routes: 15, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F15", label: "Feasible #15", fuel: 19400, cost: 5.05, ghg: 56100, cargoFulfillment: 96.8, vessels: 23, routes: 17, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F16", label: "Feasible #16", fuel: 20000, cost: 5.20, ghg: 54600, cargoFulfillment: 97.0, vessels: 24, routes: 18, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F17", label: "Feasible #17", fuel: 18700, cost: 4.92, ghg: 56300, cargoFulfillment: 96.5, vessels: 23, routes: 17, constraintsSatisfied: 11, totalConstraints: 12, pareto: false },
  { id: "F18", label: "Feasible #18", fuel: 16900, cost: 4.52, ghg: 63800, cargoFulfillment: 95.0, vessels: 20, routes: 15, constraintsSatisfied: 11, totalConstraints: 12, pareto: false },
  { id: "F19", label: "Feasible #19", fuel: 21000, cost: 5.32, ghg: 52800, cargoFulfillment: 97.6, vessels: 24, routes: 18, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F20", label: "Feasible #20", fuel: 19000, cost: 5.00, ghg: 56000, cargoFulfillment: 96.5, vessels: 22, routes: 16, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F21", label: "Feasible #21", fuel: 17600, cost: 4.68, ghg: 59800, cargoFulfillment: 96.0, vessels: 21, routes: 16, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F22", label: "Feasible #22", fuel: 18300, cost: 4.84, ghg: 58000, cargoFulfillment: 96.4, vessels: 22, routes: 17, constraintsSatisfied: 11, totalConstraints: 12, pareto: false },
  { id: "F23", label: "Feasible #23", fuel: 20400, cost: 5.38, ghg: 51800, cargoFulfillment: 98.0, vessels: 24, routes: 18, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
  { id: "F24", label: "Feasible #24", fuel: 19300, cost: 5.02, ghg: 55600, cargoFulfillment: 96.7, vessels: 22, routes: 17, constraintsSatisfied: 12, totalConstraints: 12, pareto: false },
];

// ─── ALERTS ───────────────────────────────────────────────────────────────────
export const ALERTS: Alert[] = [
  { id: "AL01", severity: "high",   category: "GHG Compliance",       title: "GHG Threshold Risk",                  description: "MV Cape Navigator (V07) on route CPT→RTM is approaching the configured lifecycle GHG limit. Current headroom: 4.1%. Recommend reviewing speed or fuel mix.", affected: "MV Cape Navigator, Route R08", timestamp: "2025-02-04 09:12",  status: "active" },
  { id: "AL02", severity: "high",   category: "Delivery Deadline",     title: "Deadline Pressure: V05 ETA",          description: "MV Meridian Express must arrive Yokohama by 08 Feb 2025. Current ETA allows only 12-hour buffer. Weather window in North Pacific may reduce margin further.", affected: "MV Meridian Express, Route R03", timestamp: "2025-02-04 07:45",  status: "active" },
  { id: "AL03", severity: "high",   category: "Port Capacity",         title: "Rotterdam Berth Congestion",          description: "Rotterdam port is operating at 94% berth utilization. Three inbound vessels (V03, V04, V22) have overlapping ETA windows. Staggered arrival recommended.", affected: "Rotterdam Port, Vessels V03, V04, V22", timestamp: "2025-02-04 08:30",  status: "active" },
  { id: "AL04", severity: "high",   category: "Vessel Assignment",     title: "MV Deep Blue (V24) Maintenance Hold", description: "MV Deep Blue is currently in scheduled maintenance and excluded from the active fleet plan. This reduces LNG Carrier availability to 2 of 3 vessels.", affected: "MV Deep Blue (V24)", timestamp: "2025-02-03 14:00",  status: "acknowledged" },
  { id: "AL05", severity: "medium", category: "Fuel Availability",     title: "LNG Bunkering Delay – Singapore",     description: "LNG bunkering at Singapore port is delayed by approximately 6 hours due to scheduling conflicts. Vessels V06 and V18 may be affected on departure.", affected: "Singapore Port, V06, V18", timestamp: "2025-02-04 06:00",  status: "active" },
  { id: "AL06", severity: "medium", category: "Maintenance",           title: "MV Ocean Pearl – Maintenance Due",    description: "MV Ocean Pearl (V17) is due for periodic maintenance in 14 days. Plan accordingly to avoid mid-voyage scheduling conflicts.", affected: "MV Ocean Pearl (V17)", timestamp: "2025-02-03 18:00",  status: "active" },
  { id: "AL07", severity: "medium", category: "Route Warning",         title: "South Atlantic Weather Advisory",     description: "Weather advisory issued for South Atlantic region (routes R08, R13). Wave heights 4–6m forecast for 06–08 Feb. Speed adjustment may be required.", affected: "Routes R08, R13 (Cape Town–Rotterdam, Santos–Rotterdam)", timestamp: "2025-02-04 05:30",  status: "active" },
  { id: "AL08", severity: "medium", category: "Fuel Availability",     title: "Methanol Availability – Houston",     description: "Methanol bunkering availability at Houston port reduced for next 72 hours. Vessels V20 assigned to methanol must confirm alternative bunkering.", affected: "Houston Port, V20", timestamp: "2025-02-03 22:00",  status: "active" },
  { id: "AL09", severity: "info",   category: "Optimization",          title: "Optimization Run #024 Completed",     description: "MO-QIGA optimization run #024 completed successfully. 42 feasible solutions evaluated. 18 Pareto-optimal plans generated. Selected plan: Solution #07.", affected: "All",                      timestamp: "2025-02-04 04:00",  status: "active" },
  { id: "AL10", severity: "info",   category: "Optimization",          title: "18 Pareto-Optimal Plans Available",   description: "New Pareto-optimal fleet deployment plans are ready for review. Navigate to Optimization Results to compare and select a plan.", affected: "Fleet Optimization",       timestamp: "2025-02-04 04:02",  status: "active" },
  { id: "AL11", severity: "info",   category: "Scenario",              title: "Scenario Analysis Complete",          description: "Scenario \"Stricter GHG Limit\" completed. Results show +5.2% cost increase and -3.8% GHG reduction vs baseline plan.", affected: "Scenario Module",           timestamp: "2025-02-03 20:15",  status: "active" },
  { id: "AL12", severity: "info",   category: "Compliance",            title: "EU ETS Reporting Due – Mar 2025",     description: "EU ETS voyage compliance report submission deadline: 31 March 2025. Data export from Reports module is available.", affected: "Compliance Module",         timestamp: "2025-02-03 09:00",  status: "active" },
];

// ─── FUEL MIX FOR SELECTED PLAN ───────────────────────────────────────────────
export const FUEL_MIX = [
  { fuel: "LNG",        vessels: 10, share: 41.7, consumption: 7680, cost: 1.62, ghg: 20840, color: "#2563EB" },
  { fuel: "Methanol",   vessels:  8, share: 33.3, consumption: 5120, cost: 1.34, ghg:  8770, color: "#059669" },
  { fuel: "Ammonia",    vessels:  1, share:  4.2, consumption:  420, cost: 0.15, ghg:   520, color: "#7C3AED" },
  { fuel: "Conventional",vessels:  5, share: 20.8, consumption: 5200, cost: 1.71, ghg: 24690, color: "#94A3B8" },
];

// ─── BASELINE VS OPTIMIZED ────────────────────────────────────────────────────
export const BASELINE = {
  fuel: 20100,
  cost: 5.16,
  ghg: 61700,
  cargoFulfillment: 94.2,
};

export const OPTIMIZED = {
  fuel: 18420,
  cost: 4.82,
  ghg: 54820,
  cargoFulfillment: 97.8,
};
