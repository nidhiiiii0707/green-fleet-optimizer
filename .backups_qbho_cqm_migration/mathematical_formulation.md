# Mathematical Formulation — Green Fleet Optimization

## Decision space

For each of $L$ scenario "legs" (a leg = one required voyage instance, generated in Stage 6
from real routes x real fleet classes), choose:

- $v_\ell \in \{\text{Bulk Carrier, Container Ship, Fish Carrier, Tanker}\}$ — vessel class (REAL categories, `fleet_parameters.csv`)
- $r_\ell \in \text{route\_derived.csv rows}$ — route (DERIVED distance/time from REAL port coordinates)
- $s_\ell \in [\text{speed\_min\_kn}(v_\ell), \text{speed\_max\_kn}(v_\ell)]$ — speed, discretized to a grid (REAL bounds)
- $f_\ell \in \{\text{DM}, \text{RM380}\}$ — fuel type (REAL categories used by the trained XGB model)
- $c_\ell \in [0, \text{capacity\_tons}(v_\ell)]$ — cargo tons (capacity DERIVED; route demand target SCENARIO_INPUT)

`vessel_activation` and `shore_power` are explicitly **excluded** — see
`optimization_problem_definition.py` docstring for the data-availability justification.

## Objectives (all minimized)

$$\min \big[ \text{Fuel}(x),\ \text{Cost}(x),\ \text{GHG}(x) \big]$$

- $\text{Fuel}(x) = \sum_\ell \hat{y}_{XGB}(\text{scenario}_\ell) \times \Delta t_{\text{assumed}}$
  where $\hat{y}_{XGB}$ is the unmodified, un-retrained `fuel_xgb_pipeline.joblib` prediction of
  `Consumer_Total_MomentaryFuel` (an instantaneous rate, undocumented physical unit) and
  $\Delta t_{\text{assumed}}$ is a SCENARIO_INPUT sampling-interval assumption (see
  `optimization_unit_checks.py` and `unit_conversion.py`).
- $\text{Cost}(x) = \sum_\ell \text{Fuel}_\ell \times \text{price}_{\text{USD/t}}(f_\ell)$ — SCENARIO_INPUT price.
- $\text{GHG}(x) = \sum_\ell \text{Fuel}_\ell \times \text{EF}_{\text{kgCO2/t}}(f_\ell)$ — SCENARIO_INPUT emission factor.

**Caveat (repeated everywhere Cost/GHG are reported):** because the XGB target's physical
unit is undocumented and fuel price / emission factor / sampling interval are SCENARIO_INPUT,
absolute Cost and GHG values are NOT verified real-world accurate. They are internally
consistent for *relative* comparison between candidates under one fixed set of assumptions.

## Constraints

See `constraints.csv` for the full table with data source and REAL/DERIVED/SCENARIO_INPUT/
UNAVAILABLE status of each. Summary:

| Constraint | Status |
|---|---|
| cargo_demand_fulfillment | REAL demand reference / SCENARIO_INPUT route assignment |
| vessel_capacity_dwt | DERIVED |
| vessel_availability_eligibility | SCENARIO_INPUT |
| vessel_fuel_compatibility | SCENARIO_INPUT |
| speed_bounds | REAL |
| route_feasibility | DERIVED |
| voyage_deadline | DERIVED distance / SCENARIO_INPUT deadline multiplier |
| draft_vs_port_depth | UNAVAILABLE (no physical port depth in metres in processed data) |
| port_capacity | UNAVAILABLE (no rated port throughput capacity in processed data) |
| fuel_availability | SCENARIO_INPUT |

`feasibility_checker.py` never fabricates a pass/fail for an UNAVAILABLE constraint; it
reports the constraint status explicitly instead.

## Algorithms applied to this same problem

NSGA-II (Stage 8), QUBO + simulated annealing (Stage 9, **quantum-inspired mathematical
formulation solved classically — no quantum hardware involved**), MO-QIGA (Stage 10, **a
classical simulation of a quantum-inspired heuristic, not real quantum computation**), and
an exact MILP reference (Stage 11) all search over exactly this decision space, objective
set, and constraint set, so their outputs are directly comparable (Stage 12).
