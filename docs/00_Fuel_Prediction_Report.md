# Stage 1 — Classical Fuel-Consumption Prediction Model
**Dataset:** CPS_Poseidon_model_ready.csv (105,422 rows × 78 columns) · **Target:** `Consumer_Total_MomentaryFuel`

---

## 1. Data audit

The file has no missing values in any physical sensor column. The only column with gaps is `MISSING_FIELD_COUNT` (0–54, mode 0), which records how many fields were imputed for that row during upstream cleaning — a data-quality flag, not a sensor reading. `index` is a clean sequential row id (step size always 1) and is used only to preserve time order for the train/test split. No duplicate rows, no unit anomalies, target range is `0 – 2.39` with only 0.03% at zero.

## 2–3. Final feature set vs. excluded features

**31 raw features kept as-is** (ship motion + full weather/sea-state block): `Ship_SpeedOverGround`, `Ship_SpeedThroughWater`, `Ship_Heading`, `Ship_Bearing`, `Environment_SeaFloorDepth`, plus the full wind / wave / swell / current / atmospheric / solar-radiation block (30 `Weather_*` columns).

**19 fuel-type one-hot flags collapsed into 3 engineered features** (`Boiler_FuelType_RM380`, `GenEngine_RM380_Count`, `GenEngine_DM_Count`) — the per-engine detail (which of 5 generators is on which fuel) was redundant for predicting *total* fuel; a simple count of how many engines run on each fuel grade carries the same signal with far less sparsity.

**Excluded, with reasons:**

| Group | Columns | Why excluded |
|---|---|---|
| **Direct leakage (7)** | `Consumer_Boiler1/2_MomentaryFuel`, `Consumer_GeneratorEngine1‑5_MomentaryFuel` | These are the per-component fuel meters that literally sum to the target (reconstruction correlation = 0.999). Including them would let the model "look up" the answer instead of predicting it. |
| **Leakage-risk / propulsion telemetry (18)** | `Consumer_Total_ShaftPower`, all `GeneratorEngine*_ShaftPower/RotationSpeed`, all `Propeller_Port/Starboard/Total_ShaftPower/ShaftTorque/RotationSpeed` | Correlate 0.86–0.96 with the target because shaft power and fuel burn are mechanically co-generated at the same instant (near-deterministic engine curve), not independent causal evidence. They also aren't decision variables the optimization engine can set in advance — a hypothetical new voyage/speed scenario wouldn't have these values available before the fact. |
| **Identifier (1)** | `index` | Row sequence only; used to build the chronological split, not as a predictor. |
| **Diagnostic metadata (1)** | `MISSING_FIELD_COUNT` | Reflects the cleaning pipeline's imputation activity, not a physical driver of fuel use; wouldn't exist in the same form for a new scenario. |
| **Redundant (2)** | `Consumer_Boiler2_FuelType_DM/RM380` | Boiler 2 always mirrors Boiler 1's fuel choice in this fleet configuration — zero additional information once Boiler 1's flag is kept. |
| **Superseded (17)** | The 15 per-generator + 2 remaining boiler one-hot flags | Replaced by the 3 aggregated fuel-mix counts described above. |

## 4. EDA — fuel vs. operating factors (Pearson r with target)

| Factor | r | Interpretation |
|---|---|---|
| Speed through water | **0.892** | Dominant driver — consistent with the physical power ≈ k·V³ relationship |
| Speed over ground | 0.889 | Near-identical to STW; current has modest effect on this vessel |
| Wind speed | 0.406 | Moderate — added resistance from headwind/beam wind |
| Wave height | 0.394 | Moderate — added resistance from sea state |
| Relative humidity | 0.351 | Weak-moderate, likely a weather-regime proxy |
| Swell height | 0.359 | Moderate, similar mechanism to wave height |
| Sea floor depth | 0.265 | Meaningful — shallow-water resistance / coastal-transit effect |
| Ocean current velocity | 0.131 | Weak direct effect |
| Solar radiation variables | −0.09 to −0.25 | Weak and physically indirect (mostly a proxy for time-of-day/season, not a resistance mechanism) |
| Fuel type (RM380 vs DM count) | small but real | DM-fueled engines show a measurable mean-fuel-rate difference vs RM380 (see `03b`/dependence plots) — kept as a genuine operational input |

Full correlation table: `03_eda_summary.csv`. Dependence plots for speed, wind, wave, current, and fuel type are in `dep_*.png`.

## 5–6. Feature matrix & split

X = 34 columns (31 raw + 3 engineered fuel-mix features), y = `Consumer_Total_MomentaryFuel`. Split **chronologically** at row 84,337 (80%) / 21,085 (20%) using the `index` column, so the model is validated on data that comes strictly *after* everything it was trained on — no shuffling, no lookahead.

## 7–8. Model comparison (held-out chronological test set)

| Model | MAE | RMSE | R² |
|---|---|---|---|
| LinearRegression | 0.1526 | 0.1952 | 0.851 |
| RandomForestRegressor | 0.0534 | 0.0906 | 0.968 |
| **XGBRegressor** | **0.0522** | **0.0880** | **0.970** |

## 9–10. Feature importance, SHAP, and model selection

**XGBRegressor wins on all three metrics** — selected on test performance, not assumed in advance. Both the built-in gain importance and SHAP mean-|value| agree on the ranking:

1. `Ship_SpeedThroughWater` — overwhelmingly dominant (≈60% of total gain; SHAP mean|value| 0.35)
2. `Ship_SpeedOverGround` — second largest
3. `Weather_Temperature2M`, `Environment_SeaFloorDepth`, `Weather_WindSpeed10M` — meaningful secondary contributors
4. The full wave/swell/current/radiation block and fuel-mix counts each contribute small but non-zero effects

Full tables: `05_feature_importance.csv`, `06_shap_importance.csv`. Plot: `shap_summary.png`, `feature_importance_top20.png`.

## 11. Saved artifact — model **and** preprocessing bundled together

`fuel_xgb_pipeline.joblib` contains a single fitted **scikit-learn Pipeline**, not just the raw XGBoost model:

```
new scenario (raw columns)
        │
        ▼
FuelTypeEngineer  (collapses 19 fuel-type flags → 3 fuel-mix features;
                    selects/orders the 34 model columns)
        │
        ▼
XGBRegressor  (trained, tuned)
        │
        ▼
predicted Consumer_Total_MomentaryFuel
```

This means the exact same preprocessing that was fit on the training data is guaranteed to run again on any new scenario — no risk of the optimization engine one day preprocessing data differently than the model expects.

**To use it later (e.g. from the optimization engine):**
```python
import sys; sys.path.append('/path/to/this/folder')
import joblib
from fuel_pipeline_utils import FuelTypeEngineer   # required for unpickling — keep this file alongside the .joblib

artifact = joblib.load('fuel_xgb_pipeline.joblib')
predicted_fuel = artifact['pipeline'].predict(new_scenario_df)
```
`new_scenario_df` just needs the raw operating/weather columns (and the fuel-type flags, if simulating a specific fuel mix) — the pipeline derives everything else itself. Verified end-to-end on held-out rows.

## 12. Remaining data issues to flag before optimization stage

- **No explicit timestamp** — `index` was used as a chronological proxy (uniform step size confirms strict ordering, but there's no wall-clock time or voyage/leg id to confirm whether the data is one continuous voyage or several).
- **Imputation footprint** — ~22% of rows had 1+ originally-missing fields imputed upstream (up to 54 of 78 fields for 27 rows); those rows are somewhat less trustworthy as ground truth and weren't down-weighted or excluded here.
- **Radiation features are weak/negative and likely confounded with time-of-day or season** rather than causally linked to fuel use — retained because they cause no harm to a tree model, but shouldn't be over-interpreted.
- **No draft/loading-condition column existed** in this dataset — `Environment_SeaFloorDepth` was used as the closest available proxy for coastal/shallow-water resistance effects; true draft data would likely improve the model further.

---

### File index
| File | Contents |
|---|---|
| `fuel_xgb_pipeline.joblib` + `fuel_pipeline_utils.py` | **The trained model + preprocessing, bundled** — ready for the optimization engine |
| `01_data_audit.csv` | Full 78-column audit (dtype, missingness, ranges) |
| `02_feature_audit.csv` | Every column's role, keep/drop decision, and reason |
| `03_eda_summary.csv` | Correlation of every candidate factor with the target |
| `04_model_comparison_baseline.csv` | LR vs RF vs XGB metrics + timing |
| `05_feature_importance.csv`, `06_shap_importance.csv` | Importance rankings for the final model |
| `dep_speed.png`, `dep_wind.png`, `dep_wave.png`, `dep_current.png`, `dep_fueltype.png` | Relationship plots |
| `shap_summary.png`, `feature_importance_top20.png` | Importance visualizations |
