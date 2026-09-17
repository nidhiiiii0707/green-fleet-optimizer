"""STAGE 5 -- Loads the existing, un-retrained fuel_xgb_pipeline.joblib and
exposes a single `predict(scenario_df)` call.

Ground rule: never pass cargo/load/draft into the model -- verified against
models/fuel_pipeline_utils.py and the artifact's own `raw_input_columns` /
`engineered_features` lists, neither of which include any cargo/load/draft
field.
"""
from __future__ import annotations

import sys
import warnings
from pathlib import Path
from functools import lru_cache

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parent
MODELS_DIR = ROOT / "models"
if str(MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(MODELS_DIR))

from fuel_pipeline_utils import FuelTypeEngineer  # noqa: E402,F401  needed for unpickling


FORBIDDEN_INPUT_SUBSTRINGS = ("cargo", "load", "draft")


@lru_cache(maxsize=1)
def _load_artifact() -> dict:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        artifact = joblib.load(MODELS_DIR / "fuel_xgb_pipeline.joblib")
    raw_cols = [c.lower() for c in artifact["raw_input_columns"]]
    eng_cols = [c.lower() for c in artifact["engineered_features"]]
    for forbidden in FORBIDDEN_INPUT_SUBSTRINGS:
        assert not any(forbidden in c for c in raw_cols), f"unexpected '{forbidden}' in raw_input_columns"
        assert not any(forbidden in c for c in eng_cols), f"unexpected '{forbidden}' in engineered_features"
    return artifact


class FuelModelAdapter:
    """Boundary object around the trained XGB pipeline. No retraining, ever."""

    def __init__(self) -> None:
        self.artifact = _load_artifact()
        self.pipeline = self.artifact["pipeline"]
        self.raw_required_columns: list[str] = list(self.artifact["raw_input_columns"])
        self.target_name: str = self.artifact["target"]
        self.test_metrics: dict = self.artifact.get("test_metrics", {})

    def predict(self, scenario: pd.DataFrame) -> pd.Series:
        missing = [c for c in self.raw_required_columns if c not in scenario.columns]
        if missing:
            raise ValueError(f"scenario is missing required raw columns: {missing}")
        X = scenario[self.raw_required_columns]
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            preds = self.pipeline.predict(X)
        return pd.Series(preds, index=scenario.index, name=self.target_name)
