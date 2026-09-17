import pytest

from src.data.loaders import DatasetLoader
from src.models.fuel_predictor import FuelPredictor
from src.optimization.objectives import (
    EmissionFactor,
    FuelPrice,
    ObjectiveEvaluator,
    ObjectiveStatus,
)


def _scenario():
    return DatasetLoader().load("cps_poseidon").iloc[[0]]


def test_current_repository_supports_fuel_but_not_cost_or_ghg() -> None:
    evaluation = ObjectiveEvaluator(FuelPredictor()).evaluate(_scenario())

    assert evaluation.fuel.status is ObjectiveStatus.AVAILABLE
    assert evaluation.fuel.value == pytest.approx(0.5999382138, abs=1e-7)
    assert evaluation.cost.status is ObjectiveStatus.UNAVAILABLE
    assert evaluation.cost.value is None
    assert "absolute fuel price" in evaluation.cost.reason
    assert evaluation.ghg.status is ObjectiveStatus.UNAVAILABLE
    assert evaluation.ghg.value is None
    assert "fuel-to-energy" in evaluation.ghg.reason


def test_explicit_dimensionally_compatible_parameters_can_be_plugged_in() -> None:
    evaluator = ObjectiveEvaluator(
        FuelPredictor(),
        fuel_prediction_unit="kg/h",
        fuel_price=FuelPrice(value=2.0, currency="USD", per_fuel_unit="kg/h"),
        emission_factor=EmissionFactor(
            value=3.0, ghg_unit="kgCO2eq", per_fuel_unit="kg/h"
        ),
    )

    evaluation = evaluator.evaluate(_scenario())

    assert evaluation.cost.status is ObjectiveStatus.AVAILABLE
    assert evaluation.cost.value == pytest.approx(evaluation.fuel.value * 2.0)
    assert evaluation.cost.unit == "USD"
    assert evaluation.ghg.status is ObjectiveStatus.AVAILABLE
    assert evaluation.ghg.value == pytest.approx(evaluation.fuel.value * 3.0)
    assert evaluation.ghg.unit == "kgCO2eq"


def test_unit_mismatch_is_unavailable_instead_of_implicitly_converted() -> None:
    evaluator = ObjectiveEvaluator(
        FuelPredictor(),
        fuel_prediction_unit="kg/h",
        fuel_price=FuelPrice(value=2.0, currency="USD", per_fuel_unit="tonnes/day"),
        emission_factor=EmissionFactor(
            value=3.0, ghg_unit="kgCO2eq", per_fuel_unit="MJ"
        ),
    )

    evaluation = evaluator.evaluate(_scenario())

    assert evaluation.cost.status is ObjectiveStatus.UNAVAILABLE
    assert "does not match" in evaluation.cost.reason
    assert evaluation.ghg.status is ObjectiveStatus.UNAVAILABLE
    assert "does not match" in evaluation.ghg.reason


def test_objective_evaluator_requires_one_candidate_scenario() -> None:
    scenarios = DatasetLoader().load("cps_poseidon").iloc[[0, 1]]

    with pytest.raises(ValueError, match="exactly one scenario row"):
        ObjectiveEvaluator(FuelPredictor()).evaluate(scenarios)
