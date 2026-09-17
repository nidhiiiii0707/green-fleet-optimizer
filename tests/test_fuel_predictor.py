import sys

import pandas as pd
import pytest

from src.data.loaders import DatasetLoader
from src.models.fuel_predictor import FuelPredictor


def _engineered_frame(predictor: FuelPredictor, raw: pd.DataFrame) -> pd.DataFrame:
    frame = raw[list(predictor.core_weather_columns)].copy()
    frame["Boiler_FuelType_RM380"] = raw["Consumer_Boiler1_FuelType_RM 380"]
    frame["GenEngine_RM380_Count"] = raw[
        [f"Consumer_GeneratorEngine{i}_FuelType_RM 380" for i in range(1, 6)]
    ].sum(axis=1)
    frame["GenEngine_DM_Count"] = raw[
        [f"Consumer_GeneratorEngine{i}_FuelType_DM" for i in range(1, 6)]
    ].sum(axis=1)
    return frame


def test_loads_existing_artifact_and_exposes_exact_model_contract() -> None:
    predictor = FuelPredictor()

    assert "fuel_pipeline_utils" in sys.modules
    assert predictor.target == "Consumer_Total_MomentaryFuel"
    assert predictor.model_type == "XGBRegressor"
    assert len(predictor.model_input_columns) == 34
    assert len(predictor.raw_required_columns) == 42
    assert predictor.engineered_columns == (
        "Boiler_FuelType_RM380",
        "GenEngine_RM380_Count",
        "GenEngine_DM_Count",
    )
    assert "cargo" not in " ".join(predictor.model_input_columns).lower()
    assert "draft" not in " ".join(predictor.model_input_columns).lower()


def test_predicts_known_existing_dataset_rows_from_minimal_raw_input() -> None:
    predictor = FuelPredictor()
    raw = DatasetLoader().load("cps_poseidon").iloc[[0, 52_711, 105_421]]

    predictions = predictor.predict(raw)

    assert predictions.tolist() == pytest.approx(
        [0.5999382138, 0.9519100189, 1.3688148260], abs=1e-7
    )
    assert predictions.index.tolist() == [0, 52_711, 105_421]
    assert predictions.name == "predicted_Consumer_Total_MomentaryFuel"


def test_predicts_from_already_engineered_input() -> None:
    predictor = FuelPredictor()
    raw = DatasetLoader().load("cps_poseidon").iloc[[0]]
    engineered = _engineered_frame(predictor, raw)

    predictions = predictor.predict(engineered)

    assert predictions.tolist() == pytest.approx([0.5999382138], abs=1e-7)


def test_safe_input_drops_cargo_load_and_vessel_draft_extras() -> None:
    predictor = FuelPredictor()
    raw = DatasetLoader().load("cps_poseidon").iloc[[0]].copy()
    raw["cargo_tons"] = 999_999.0
    raw["load_percentage"] = 100.0
    raw["vessel_draft_m"] = 14.0

    safe = predictor.prepare_input(raw)

    assert list(safe.columns) == list(predictor.raw_required_columns)
    assert not {"cargo_tons", "load_percentage", "vessel_draft_m"} & set(safe.columns)


def test_missing_model_inputs_are_reported_without_guessing_values() -> None:
    predictor = FuelPredictor()
    raw = DatasetLoader().load("cps_poseidon").iloc[[0]].drop(
        columns=["Weather_WindSpeed10M"]
    )

    with pytest.raises(ValueError, match="Weather_WindSpeed10M"):
        predictor.predict(raw)


def test_raw_fuel_flags_must_be_binary_and_mutually_exclusive() -> None:
    predictor = FuelPredictor()
    raw = DatasetLoader().load("cps_poseidon").iloc[[0]].copy()
    raw["Consumer_GeneratorEngine1_FuelType_DM"] = 7

    with pytest.raises(ValueError, match="binary"):
        predictor.predict(raw)

    raw["Consumer_GeneratorEngine1_FuelType_DM"] = 1
    raw["Consumer_GeneratorEngine1_FuelType_RM 380"] = 1
    with pytest.raises(ValueError, match="mutually exclusive"):
        predictor.predict(raw)


def test_engineered_fuel_counts_must_be_integral_and_within_engine_count() -> None:
    predictor = FuelPredictor()
    raw = DatasetLoader().load("cps_poseidon").iloc[[0]]
    engineered = _engineered_frame(predictor, raw)
    engineered["GenEngine_DM_Count"] = 6

    with pytest.raises(ValueError, match="between 0 and 5"):
        predictor.predict(engineered)

    engineered["GenEngine_DM_Count"] = 1.5
    with pytest.raises(ValueError, match="whole number"):
        predictor.predict(engineered)


def test_all_model_values_must_be_numeric_and_finite() -> None:
    predictor = FuelPredictor()
    raw = DatasetLoader().load("cps_poseidon").iloc[[0]].copy()
    raw["Weather_WindSpeed10M"] = float("nan")

    with pytest.raises(ValueError, match="finite numeric"):
        predictor.predict(raw)


def test_duplicate_scenario_columns_are_rejected() -> None:
    predictor = FuelPredictor()
    raw = DatasetLoader().load("cps_poseidon").iloc[[0]].copy()
    duplicate = pd.concat([raw, raw[["Ship_SpeedOverGround"]]], axis=1)

    with pytest.raises(ValueError, match="duplicate column"):
        predictor.predict(duplicate)


def test_numeric_strings_are_converted_to_the_validated_numeric_frame() -> None:
    predictor = FuelPredictor()
    raw = DatasetLoader().load("cps_poseidon").iloc[[0]].copy()
    raw["Weather_WindSpeed10M"] = raw["Weather_WindSpeed10M"].astype(str)

    safe = predictor.prepare_input(raw)
    prediction = predictor.predict(raw)

    assert safe["Weather_WindSpeed10M"].dtype.kind in "fiu"
    assert prediction.iloc[0] == pytest.approx(0.5999382138, abs=1e-7)


def test_complete_source_fuel_one_hot_evidence_must_be_consistent() -> None:
    predictor = FuelPredictor()
    raw = DatasetLoader().load("cps_poseidon").iloc[[0]].copy()
    raw["Consumer_Boiler1_FuelType_DM"] = 0

    with pytest.raises(ValueError, match="complete one-hot"):
        predictor.predict(raw)
