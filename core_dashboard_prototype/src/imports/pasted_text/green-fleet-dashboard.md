Design a high-fidelity desktop web dashboard for an AI-powered Green Fleet Deployment & Optimization platform.

IMPORTANT:
This is a decision-support dashboard for the SIH26138 green maritime fleet optimization problem.

Create ONE coherent product/dashboard design, not multiple design concepts.
Do not generate unnecessary duplicate screens.
Prioritize a polished, realistic and implementation-feasible prototype.
Design for a 1440px desktop viewport.

DO NOT INCLUDE THE NATURAL LANGUAGE CHAT/INTERFACE in this design.

============================================================
PRODUCT PURPOSE
============================================================

The platform helps a fleet operator evaluate and select optimized green fleet deployment plans.

The system pipeline behind the dashboard is:

Fleet + Vessel Data
+ Route & Port Data
+ Cargo & Demand Data
+ Environmental & Regulatory Data
        ↓
Natural Language constraints are converted into structured constraints
        ↓
Data preprocessing & feasible candidate generation
        ↓
XGBoost fuel-consumption prediction
        ↓
CQM generates feasible/high-quality initial solutions
        ↓
MO-QIGA performs multi-objective optimization
        ↓
Multiple Pareto-optimal fleet deployment plans
        ↓
Dashboard provides visualization, comparison, explanation,
scenario analysis, compliance monitoring and decision support.

The dashboard should NOT expose the internal technical pipeline everywhere.
Instead, present the resulting information in a way that a fleet operator,
planner or decision-maker can understand quickly.

============================================================
CORE OPTIMIZATION OBJECT
============================================================

The central object in the dashboard is an optimized FLEET PLAN.

A fleet plan should contain:

- Vessel assignment
- Cargo allocation
- Origin port
- Destination port
- Route
- Cruising speed
- Fuel type
- Shore-power usage
- ETA / delivery status
- Predicted fuel consumption
- Operating cost
- Lifecycle GHG emissions
- Constraint/compliance status

The three primary optimization objectives are:

1. Minimize total fuel consumption
2. Minimize total operating cost
3. Minimize total lifecycle GHG emissions

The optimization produces MULTIPLE Pareto-optimal solutions.

Do NOT label one solution as universally "best".

Instead, show the trade-offs between feasible Pareto solutions and let the
operator select a plan according to their priorities.

============================================================
VISUAL DESIGN SYSTEM
============================================================

Style:
- Modern enterprise SaaS
- Maritime technology + sustainability
- Professional, trustworthy and technical
- Clean light interface
- Deep navy/blue primary visual language
- Green sustainability accents
- Subtle purple/blue accents for optimization/AI
- Soft cards and borders
- Moderate corner radius
- Strong typography hierarchy
- Dense information without clutter
- High readability and accessibility
- Minimal unnecessary decoration
- No excessive gradients
- No excessive glassmorphism
- No futuristic sci-fi UI
- No 3D dashboard
- No excessive animations

Use a consistent component system:
- KPI cards
- status badges
- tabs
- dropdowns
- filters
- tables
- charts
- map markers
- drawers
- modals
- tooltips
- alerts
- buttons

Use realistic representative mock data.
Do not imply that the prototype has live GPS data or a real backend.

============================================================
GLOBAL NAVIGATION
============================================================

Create a left sidebar navigation:

Logo / Product name:
GREENFLEET AI

Navigation:

Overview
Fleet & Routes
Optimization
Scenarios
Reports

Bottom:
Alerts
Settings
User Profile

Top header:
- Page title
- Current optimization run
- Last updated
- notification bell
- profile

============================================================
SCREEN 1 — OVERVIEW
============================================================

Create the main fleet operations dashboard.

HEADER:
"Fleet Optimization Overview"

Subheader:
"Monitor fleet deployment, environmental performance and optimization results."

Add a compact optimization status indicator:

Optimization Run:
RUN #024
Status: Completed
Method: MO-QIGA
Solutions: 18 Pareto-optimal plans

------------------------------------------------------------
KPI SECTION
------------------------------------------------------------

Show the most important fleet and optimization KPIs:

Total Fuel Consumption
18,420 t
↓ 8.4% vs baseline

Operating Cost
$4.82M
↓ 6.6% vs baseline

Lifecycle GHG
54,820 tCO₂e
↓ 11.2% vs baseline

Cargo Fulfillment
97.8%

Active Vessels
24 / 31

Compliance
94% compliant

Use compact trend indicators.

------------------------------------------------------------
MAIN WORLD MAP
------------------------------------------------------------

Create a large interactive world map titled:

"Fleet & Route Overview"

Show representative:
- vessels
- ports
- routes
- origin/destination connections

The map should visualize:
- vessel locations/representative positions
- active routes
- origin ports
- destination ports
- selected vessel
- selected route
- port capacity status

Use restrained status markers:

Green = On schedule / feasible
Amber = Warning / approaching constraint
Red = Critical
Blue = Selected

Do NOT make this look like real-time GPS tracking.
Call it "Fleet & Route Visualization".

Clicking a vessel should open a right-side vessel detail drawer.

------------------------------------------------------------
VESSEL DETAIL DRAWER
------------------------------------------------------------

Example vessel:

MV OCEAN STAR

Show:

Vessel ID
Vessel Type
Capacity
Current Position
Availability
Maintenance Status

Assigned Cargo
Origin
Destination
Route
Speed
ETA

Fuel Type
Shore Power
Predicted Fuel Consumption
Operating Cost
Lifecycle GHG

Constraint Status

Add a section:

"Why this vessel was selected"

Show factual reasons:
✓ Capacity requirement satisfied
✓ Fuel compatibility satisfied
✓ Available within planning window
✓ Delivery deadline satisfied
✓ Port constraints satisfied
✓ GHG constraint satisfied

Do not make unsupported claims about AI reasoning.

------------------------------------------------------------
BASELINE VS OPTIMIZED
------------------------------------------------------------

Add a comparison component:

BASELINE vs OPTIMIZED PLAN

Fuel
20,100 t → 18,420 t

Cost
$5.16M → $4.82M

GHG
61,700 → 54,820 tCO₂e

Cargo Fulfillment
94.2% → 97.8%

Use a clean visual comparison.

============================================================
SCREEN 2 — FLEET & ROUTES
============================================================

Create a detailed operational fleet view.

LEFT FILTER PANEL:

- Vessel type
- Fuel type
- Vessel availability
- Route
- Vessel status
- Capacity
- Cargo priority
- Compliance status

MAIN AREA:

Large fleet/route map.

Show:
- ports
- vessels
- routes
- route direction
- selected route
- port capacity indicators

RIGHT SIDE:

Selected vessel / selected route information.

BOTTOM:

Fleet Assignment Table

Columns:

Vessel
Cargo
Origin
Destination
Route
Speed
Fuel
Shore Power
ETA
Predicted Fuel
Cost
GHG
Status

Make rows clickable.

When a row is selected:
- highlight vessel on map
- highlight route
- update right-side details

============================================================
SCREEN 3 — OPTIMIZATION RESULTS
============================================================

THIS IS THE MOST IMPORTANT SCREEN.

Title:

"Optimization Results"

Subtitle:

"Explore feasible Pareto-optimal fleet deployment plans."

------------------------------------------------------------
OPTIMIZATION SUMMARY
------------------------------------------------------------

Show:

Optimization Method:
MO-QIGA

Initialization:
CQM

Feasible Solutions:
42

Pareto-optimal Solutions:
18

Optimization Runtime:
representative value

Constraint Satisfaction:
100%

------------------------------------------------------------
PARETO FRONT
------------------------------------------------------------

Create a large interactive Pareto scatter plot.

Default:

X axis:
Total Operating Cost

Y axis:
Lifecycle GHG Emissions

Each point represents one feasible fleet deployment solution.

Highlight the Pareto frontier.

Allow the user to change axes between:

- Operating Cost
- Fuel Consumption
- Lifecycle GHG Emissions

Example:

Cost ↔ GHG
Fuel ↔ Cost
Fuel ↔ GHG

Clicking a point selects that solution.

------------------------------------------------------------
SELECTED PARETO SOLUTION
------------------------------------------------------------

When a point is selected, show:

Solution #07

Fuel Consumption
18,420 t

Operating Cost
$4.82M

Lifecycle GHG
54,820 tCO₂e

Cargo Fulfillment
97.8%

Vessels Used
24

Routes
18

Constraints
12 / 12 satisfied

Buttons:

View Fleet Plan
Compare Solution

------------------------------------------------------------
COMPARE SOLUTIONS
------------------------------------------------------------

Allow selection of up to 3 Pareto solutions.

Comparison table:

Metric
Solution A
Solution B
Solution C

Fuel
Cost
GHG
Cargo Fulfillment
Vessels Used
Routes
Compliance

Add a visual trade-off summary.

Example:

"Solution A has lower GHG emissions while Solution B has lower operating cost."

Use neutral factual language.

============================================================
SCREEN 4 — SELECTED OPTIMIZED FLEET PLAN
============================================================

Title:

"Optimized Fleet Plan — Solution #07"

TOP SUMMARY:

Total Fuel
Total Cost
Lifecycle GHG
Cargo Fulfillment
Vessels Deployed
Routes

------------------------------------------------------------
OPTIMIZED ROUTE MAP
------------------------------------------------------------

Large map showing the actual selected deployment plan.

Visualize:

Origin → Route → Destination

Highlight selected routes.

------------------------------------------------------------
FLEET ASSIGNMENT
------------------------------------------------------------

Table:

Vessel
Cargo
Origin
Destination
Speed
Fuel
Shore Power
ETA
Fuel
Cost
GHG
Status

------------------------------------------------------------
CONSTRAINT & COMPLIANCE PANEL
------------------------------------------------------------

Create a clearly visible section:

"Constraint Status"

Show:

Cargo Demand       ✓ Satisfied
Vessel Capacity    ✓ Satisfied
Vessel Availability ✓ Satisfied
Fuel Compatibility ✓ Satisfied
Port Capacity      ✓ Satisfied
Delivery Deadline  ✓ Satisfied
Fuel Availability  ✓ Satisfied
GHG Limit          ✓ Satisfied
Operational Rules  ✓ Satisfied

If a constraint is close to its limit, show:

WARNING
"GHG emissions approaching configured threshold."

Do not fabricate violations.

------------------------------------------------------------
PLAN EXPLANATION
------------------------------------------------------------

Create:

"Why this plan is feasible"

Show the major satisfied constraints and important deployment decisions.

Then:

"Trade-off Summary"

Example:
"Lower lifecycle GHG than Solution #04 with higher operating cost."

============================================================
FUEL & SUSTAINABILITY
============================================================

Within Overview or Optimization detail, include a compact sustainability section.

Show:

Fuel Mix

- LNG
- Methanol
- Hydrogen
- Ammonia
- Conventional fuel
- Other supported fuels

IMPORTANT:
Use only fuel types actually supported by the implementation/data.
Do not imply that every fuel is currently modeled if it is not.

Show:

Fuel Consumption
Lifecycle GHG
GHG per cargo unit
Fuel cost

For lifecycle emissions, allow an expandable breakdown:

Well-to-Tank
Tank-to-Wake
Well-to-Wake

Keep this compact rather than creating another full screen.

============================================================
SHORE POWER
============================================================

Shore power must be explicitly represented because it is part of the
fleet optimization decision.

Show:

Shore Power Available
Shore Power Selected

at relevant vessel/port details.

Include Shore Power as a column in the optimized fleet plan.

============================================================
SCREEN 5 — WHAT-IF SCENARIO ANALYSIS
============================================================

Title:

"What-If Scenario Analysis"

Purpose:
Allow the operator to understand how changes in operating conditions affect
fleet optimization.

Scenario controls:

Cargo Demand
Fuel Price
GHG Regulatory Limit
Delivery Deadline
Available Vessels
Fuel Availability
Port Capacity

Use:
- sliders
- dropdowns
- numeric inputs
- toggles

Include example presets:

Increased Cargo Demand
Reduced Vessel Availability
Stricter GHG Limit
Higher Fuel Price
Port Capacity Restriction

Button:

"Run Scenario"

------------------------------------------------------------
SCENARIO RESULT
------------------------------------------------------------

Show:

Baseline
vs
Scenario

Fuel Change
Cost Change
GHG Change
Cargo Fulfillment
Constraint Changes

Show a compact Pareto comparison.

Example:

Fuel
+8.2%

Cost
+4.7%

GHG
+3.1%

Cargo Fulfillment
96.4%

Make clear that these are scenario outputs, not live results.

============================================================
SCREEN 6 — ALERTS
============================================================

Create a notification/alerts panel accessible through the top-right bell.

Title:

"Operational Alerts"

Categories:

HIGH PRIORITY
- Delivery deadline approaching
- Port capacity constraint
- GHG threshold risk
- Vessel assignment constraint

MEDIUM
- Fuel availability issue
- Maintenance due
- Environmental/route warning

INFORMATIONAL
- Optimization completed
- New Pareto solutions generated
- Scenario analysis completed

Each alert should show:

Severity
Timestamp
Affected vessel/route/port
Description
Status

Do not make these generic productivity reminders.
They should be operational or optimization-related alerts.

============================================================
SCREEN 7 — REPORTS
============================================================

Create a simple reports page.

Do not make a complicated report editor.

Use report cards:

Optimization Report

Sustainability Report

Trade-off Analysis

Compliance Report

Each card contains:
- short description
- date/run
- View
- Export PDF

Include:

Download Data
Export Report

============================================================
OPTIONAL — TECHNICAL EVALUATION
============================================================

If space and generation limits allow, add a small Analytics/Evaluation
section rather than another major dashboard.

Show:

MO-QIGA vs NSGA-II

Metrics:
- Solution quality
- Computation time
- Diversity of solutions

Exact MILP comparison on small instances:
- MO-QIGA result
- MILP optimum
- optimality gap

Scalability:
- problem size
- computation time

This section is primarily for technical demonstration/judges,
not the primary operator workflow.

============================================================
INTERACTION / PROTOTYPE BEHAVIOR
============================================================

Make the prototype clickable.

Required interactions:

1. Clicking Overview → dashboard
2. Clicking Fleet & Routes → fleet map
3. Clicking vessel → vessel detail drawer
4. Clicking route → route details
5. Clicking Optimization → Pareto front
6. Clicking Pareto point → select solution
7. Clicking Compare → solution comparison
8. Clicking View Fleet Plan → optimized deployment
9. Clicking scenario controls → scenario summary
10. Clicking Alerts → operational alerts
11. Clicking Reports → report cards

Most importantly:

Pareto Solution selection should conceptually update:

Selected Solution
↓
Fleet Plan
↓
Map Routes
↓
Vessel Assignments
↓
Fuel
↓
Cost
↓
GHG
↓
Constraint Status

This connection is essential.

============================================================
REALISTIC MOCK DATA
============================================================

Use representative mock data for approximately:

20–30 vessels
10–20 ports
multiple routes
multiple cargo demands
multiple fuel types
multiple Pareto solutions

Example vessel attributes:

- Vessel name
- Type
- Capacity
- Fuel compatibility
- Availability
- Speed
- Route
- Cargo
- Fuel consumption
- Cost
- GHG
- Shore power availability

Do not use fake live-data indicators.

============================================================
VISUAL HIERARCHY
============================================================

The most visually important elements must be:

1. WORLD FLEET / ROUTE MAP
2. PARETO FRONT
3. OPTIMIZED FLEET PLAN
4. KPI SUMMARY
5. CONSTRAINT / COMPLIANCE STATUS
6. BASELINE VS OPTIMIZED
7. WHAT-IF SCENARIO ANALYSIS
8. ALERTS
9. REPORTS

Avoid excessive charts.

Prioritize:
- map
- Pareto scatter plot
- tables
- KPI cards
- comparison visuals
- status indicators
- route visualization

============================================================
IMPORTANT PRODUCT PRINCIPLES
============================================================

The dashboard should answer these questions immediately:

WHAT IS HAPPENING?
→ Fleet map + KPIs

WHAT CAN WE OPTIMIZE?
→ Fuel + Cost + Lifecycle GHG

WHAT SOLUTIONS EXIST?
→ Pareto front

WHAT ARE THE TRADE-OFFS?
→ Solution comparison

WHAT DOES THE SELECTED PLAN ACTUALLY DO?
→ Vessel + route + cargo + speed + fuel + shore power

IS THE PLAN FEASIBLE?
→ Constraint/compliance status

WHY IS THE PLAN FEASIBLE?
→ Plan explanation

WHAT IF CONDITIONS CHANGE?
→ Scenario analysis

WHAT NEEDS ATTENTION?
→ Operational alerts

WHAT CAN WE REPORT?
→ Reports/export

============================================================
DO NOT DO
============================================================

Do NOT:
- create a mobile application
- create an NLP chat interface
- create a generic CRM dashboard
- create a generic shipping tracking dashboard
- create a 3D globe
- create unnecessary admin dashboards
- create dozens of pages
- create multiple design themes
- add irrelevant charts
- imply real-time GPS tracking
- fabricate real optimization results
- claim that one Pareto solution is universally best
- make NLP itself look like the optimization algorithm
- overcrowd the interface

The final result should look like a realistic, technically credible,
professional GREEN FLEET OPTIMIZATION DECISION-SUPPORT PLATFORM.

Prioritize quality and coherence over the number of screens.
Use reusable components and maintain the same design system throughout.