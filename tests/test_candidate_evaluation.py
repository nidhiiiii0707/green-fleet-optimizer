import pytest

from src.data.loaders import DatasetLoader
from src.models.fuel_predictor import FuelPredictor
from src.optimization.candidate import Candidate
from src.optimization.evaluation import CandidateFuelEvaluator
from src.optimization.feasibility import ConstraintStatus, FeasibilityContext


def _scenario():
    return DatasetLoader().load("cps_poseidon").iloc[[0]]


def test_matching_candidate_and_complete_scenario_can_be_predicted() -> None:
    scenario = _scenario()
    candidate = Candidate(speed_knots=float(scenario["Ship_SpeedOverGround"].iloc[0]))

    result = CandidateFuelEvaluator(FuelPredictor()).evaluate(
        candidate, scenario, FeasibilityContext()
    )

    assert result.is_usable
    assert result.predicted_fuel == pytest.approx(0.5999382138, abs=1e-7)
    assert result.binding_by_name("scenario_speed_alignment").status is ConstraintStatus.PASSED
    assert result.binding_by_name("scenario_fuel_alignment").status is ConstraintStatus.UNAVAILABLE
    assert result.binding_by_name("model_scenario_completeness").status is ConstraintStatus.PASSED


def test_mismatched_candidate_speed_blocks_prediction() -> None:
    scenario = _scenario()
    candidate = Candidate(speed_knots=9.0)

    result = CandidateFuelEvaluator(FuelPredictor()).evaluate(
        candidate, scenario, FeasibilityContext()
    )

    assert not result.is_usable
    assert result.predicted_fuel is None
    assert result.binding_by_name("scenario_speed_alignment").status is ConstraintStatus.FAILED


def test_single_fuel_decision_that_does_not_match_mixed_scenario_blocks_prediction() -> None:
    scenario = _scenario()
    candidate = Candidate(
        speed_knots=float(scenario["Ship_SpeedOverGround"].iloc[0]), fuel_type="DM"
    )

    result = CandidateFuelEvaluator(FuelPredictor()).evaluate(
        candidate, scenario, FeasibilityContext()
    )

    assert result.predicted_fuel is None
    assert result.binding_by_name("scenario_fuel_alignment").status is ConstraintStatus.FAILED


def test_incomplete_model_scenario_returns_unavailable_without_prediction() -> None:
    scenario = _scenario().drop(columns=["Weather_WindSpeed10M"])
    candidate = Candidate(speed_knots=float(scenario["Ship_SpeedOverGround"].iloc[0]))

    result = CandidateFuelEvaluator(FuelPredictor()).evaluate(
        candidate, scenario, FeasibilityContext()
    )

    completeness = result.binding_by_name("model_scenario_completeness")
    assert completeness.status is ConstraintStatus.UNAVAILABLE
    assert "Weather_WindSpeed10M" in completeness.reason
    assert result.predicted_fuel is None


def test_failed_hard_feasibility_blocks_prediction_even_when_scenario_matches() -> None:
    scenario = _scenario()
    speed = float(scenario["Ship_SpeedOverGround"].iloc[0])
    candidate = Candidate(speed_knots=speed)
    context = FeasibilityContext(min_speed_knots=8.0, max_speed_knots=10.0)

    result = CandidateFuelEvaluator(FuelPredictor()).evaluate(candidate, scenario, context)

    assert not result.feasibility.is_usable
    assert result.predicted_fuel is None


@pytest.mark.parametrize("fuel_type", ["LNG", "RM 180", "HFO"])
def test_explicit_fuel_without_model_crosswalk_blocks_prediction(fuel_type) -> None:
    scenario = _scenario()
    candidate = Candidate(
        speed_knots=float(scenario["Ship_SpeedOverGround"].iloc[0]),
        fuel_type=fuel_type,
    )

    result = CandidateFuelEvaluator(FuelPredictor()).evaluate(
        candidate, scenario, FeasibilityContext()
    )

    assert result.binding_by_name("scenario_fuel_alignment").status is ConstraintStatus.UNAVAILABLE
    assert result.predicted_fuel is None
    assert not result.is_usable


def test_numeric_string_model_value_is_converted_before_prediction() -> None:
    scenario = _scenario().copy()
    scenario["Weather_WindSpeed10M"] = scenario["Weather_WindSpeed10M"].astype(str)
    candidate = Candidate(speed_knots=float(scenario["Ship_SpeedOverGround"].iloc[0]))

    result = CandidateFuelEvaluator(FuelPredictor()).evaluate(
        candidate, scenario, FeasibilityContext()
    )

    assert result.is_usable
    assert result.predicted_fuel == pytest.approx(0.5999382138, abs=1e-7)


def test_candidate_evaluator_requires_dataframe_scenario() -> None:
    with pytest.raises(TypeError, match="pandas DataFrame"):
        CandidateFuelEvaluator(FuelPredictor()).evaluate(
            Candidate(speed_knots=5.0), [object()], FeasibilityContext()
        )
