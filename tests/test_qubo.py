import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np

from qubo_validation import validate_symmetry, validate_one_hot_penalty, energy
from scenario_setup import build_evaluated_legs
from qubo_model import QUBOModel


def test_one_hot_penalty_matrix_is_symmetric():
    Q = validate_one_hot_penalty(5, penalty=4.0)
    assert validate_symmetry(Q)


def test_one_hot_beats_zero_and_two_hot():
    n, penalty = 5, 4.0
    Q = validate_one_hot_penalty(n, penalty)
    one_hot = np.zeros(n); one_hot[2] = 1
    zero_hot = np.zeros(n)
    two_hot = np.zeros(n); two_hot[0] = two_hot[1] = 1
    assert energy(Q, one_hot) < energy(Q, zero_hot)
    assert energy(Q, one_hot) < energy(Q, two_hot)


def test_real_qubo_model_q_matrix_is_symmetric():
    legs, _ = build_evaluated_legs(seed=0, use_cache=True, verbose=False)
    model = QUBOModel(legs, weights=(1.0, 1.0, 1.0))
    assert validate_symmetry(model.Q)
    assert model.Q.shape[0] == len(model.variables)


def test_real_qubo_model_has_one_variable_block_per_leg():
    legs, _ = build_evaluated_legs(seed=0, use_cache=True, verbose=False)
    model = QUBOModel(legs)
    leg_indices = {li for li, _ in model.variables}
    # not every leg is guaranteed to have a feasible option, but at least one must
    assert len(leg_indices) > 0
    assert leg_indices.issubset(set(range(len(legs))))
