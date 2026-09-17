import pytest

from src.main import smoke_candidate_flow, smoke_dataset_row


def test_smoke_dataset_row_predicts_existing_measurement() -> None:
    result = smoke_dataset_row(0)

    assert result["row_index"] == 0
    assert result["actual_fuel"] == pytest.approx(0.5710687663)
    assert result["predicted_fuel"] == pytest.approx(0.5999382138, abs=1e-7)


def test_smoke_candidate_checks_feasibility_before_prediction() -> None:
    result = smoke_candidate_flow(0)

    assert result["candidate"]["speed_knots"] == pytest.approx(6.7906665802)
    assert result["candidate"]["fuel_type"] is None
    assert set(result["constraint_statuses"].values()) == {"unavailable"}
    assert result["binding_statuses"] == {
        "scenario_speed_alignment": "passed",
        "scenario_fuel_alignment": "unavailable",
        "model_scenario_completeness": "passed",
    }
    assert result["usable"] is True
    assert result["predicted_fuel"] == pytest.approx(0.5999382138, abs=1e-7)
    assert result["model_limitation"] == (
        "Cargo, load, and vessel draft are not XGBoost training features."
    )
