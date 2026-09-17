"""Shared, honestly-computed multi-objective metrics for Stages 8/10/12.

Hypervolume: exact via Monte-Carlo sampling against a shared reference point
(the worst objective vector observed across ALL algorithms in the comparison,
scaled by 1.1) -- deterministic given a fixed seed, reported with the sample
count so it is not confused with an exact geometric computation.

IGD: since the TRUE Pareto front of this problem is unknown (no closed-form
optimum), IGD is computed against the union of all fronts being compared
(the best known approximation), exactly as commonly done in benchmark
studies without ground truth. This is stated explicitly in every output that
uses it -- never presented as IGD against a verified true front.
"""
from __future__ import annotations

import numpy as np


def normalize(points: np.ndarray, lo: np.ndarray, hi: np.ndarray) -> np.ndarray:
    span = np.where((hi - lo) == 0, 1.0, hi - lo)
    return (points - lo) / span


def hypervolume_monte_carlo(points: np.ndarray, ref: np.ndarray, n_samples: int = 200_000, seed: int = 0) -> float:
    """Fraction-of-box-dominated x box volume, for 3 minimization objectives.
    `points` and `ref` must already be normalized so smaller=better and ref
    is the worst corner (all 1s if using normalize() against the same lo/hi).
    """
    if len(points) == 0:
        return 0.0
    rng = np.random.default_rng(seed)
    samples = rng.uniform(low=0.0, high=1.0, size=(n_samples, ref.shape[0])) * ref
    dominated = np.zeros(n_samples, dtype=bool)
    for p in points:
        dominated |= np.all(samples >= p, axis=1)
    box_volume = float(np.prod(ref))
    return float(dominated.mean()) * box_volume


def igd(approx: np.ndarray, reference: np.ndarray) -> float | None:
    if len(approx) == 0 or len(reference) == 0:
        return None
    dists = np.sqrt(((reference[:, None, :] - approx[None, :, :]) ** 2).sum(axis=2))
    return float(dists.min(axis=1).mean())


def spacing_diversity(points: np.ndarray) -> float | None:
    """Standard deviation of nearest-neighbour distances -- lower = more even spread."""
    if len(points) < 2:
        return None
    n = len(points)
    d = np.sqrt(((points[:, None, :] - points[None, :, :]) ** 2).sum(axis=2))
    np.fill_diagonal(d, np.inf)
    nn = d.min(axis=1)
    return float(nn.std())
