"""STAGE 9 -- Validate the Q matrix construction (symmetry, one-hot penalty
correctness on a tiny hand-checkable instance). Run: python qubo_validation.py
(also imported by tests/test_qubo.py)
"""
from __future__ import annotations

import numpy as np


def validate_symmetry(Q: np.ndarray) -> bool:
    return np.allclose(Q, Q.T)


def validate_one_hot_penalty(n_options: int, penalty: float) -> np.ndarray:
    """Build the pure one-hot-penalty Q block for a single leg with
    `n_options` binary variables and verify that x with exactly one 1 scores
    lower energy than x with zero or two 1s, for ANY choice of which bit is 1.
    (sum x_i - 1)^2 = sum x_i^2 + 2*sum_{i<j} x_i x_j - 2*sum x_i + 1
                     = sum x_i (1 - 2*penalty... folded into diag) + off-diag 2*penalty
    Diagonal gets -penalty (from -2*penalty*x_i, using x_i^2=x_i), off-diagonal gets +penalty.
    """
    Q = np.zeros((n_options, n_options))
    for i in range(n_options):
        Q[i, i] = -penalty
    for i in range(n_options):
        for j in range(i + 1, n_options):
            Q[i, j] = Q[j, i] = penalty
    return Q


def energy(Q: np.ndarray, x: np.ndarray) -> float:
    return float(x @ Q @ x)


if __name__ == "__main__":
    n = 4
    penalty = 4.0
    Q = validate_one_hot_penalty(n, penalty)
    assert validate_symmetry(Q), "Q must be symmetric"

    one_hot_energies = []
    for i in range(n):
        x = np.zeros(n)
        x[i] = 1
        one_hot_energies.append(energy(Q, x))
    zero_energy = energy(Q, np.zeros(n))
    two_hot = np.zeros(n)
    two_hot[0] = two_hot[1] = 1
    two_hot_energy = energy(Q, two_hot)

    print("one-hot energies:", one_hot_energies)
    print("zero-hot energy:", zero_energy)
    print("two-hot energy:", two_hot_energy)
    assert all(e == one_hot_energies[0] for e in one_hot_energies), "one-hot energy must be symmetric across bit choice"
    assert one_hot_energies[0] < zero_energy, "one-hot must beat zero-hot"
    assert one_hot_energies[0] < two_hot_energy, "one-hot must beat two-hot"
    print("QUBO one-hot penalty validation PASSED")
