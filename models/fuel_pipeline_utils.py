"""
Companion module for fuel_xgb_pipeline.joblib.

Keep this file next to the .joblib file and importable (e.g. on sys.path,
or in the same working directory) whenever you load the pipeline with
joblib.load(...), because the pipeline's first step is an instance of
FuelTypeEngineer defined here.

Usage in the optimization engine / any new scenario:

    import sys; sys.path.append('/path/to/this/folder')
    import joblib
    from fuel_pipeline_utils import FuelTypeEngineer  # noqa: F401 (needed for unpickling)

    artifact = joblib.load('fuel_xgb_pipeline.joblib')
    pipe = artifact['pipeline']
    predicted_fuel = pipe.predict(new_scenario_df)   # same preprocessing, same model
"""
from sklearn.base import BaseEstimator, TransformerMixin


class FuelTypeEngineer(BaseEstimator, TransformerMixin):
    """Collapses the raw per-consumer fuel-type one-hot flags into 3
    engineered fuel-type summary features, then selects and orders the
    final feature matrix. Accepts a dataframe with the ORIGINAL
    CPS_Poseidon_model_ready.csv column names (or the already-engineered
    summary columns, for scenario dataframes built directly by the
    optimization engine).
    """

    def __init__(self, core_features, weather_features):
        self.core_features = core_features
        self.weather_features = weather_features

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X = X.copy()

        if 'Consumer_Boiler1_FuelType_RM 380' in X.columns:
            X['Boiler_FuelType_RM380'] = X['Consumer_Boiler1_FuelType_RM 380']
        elif 'Boiler_FuelType_RM380' not in X.columns:
            raise ValueError(
                "Need either the raw boiler fuel-type flag "
                "'Consumer_Boiler1_FuelType_RM 380' or a precomputed "
                "'Boiler_FuelType_RM380' column.")

        gen380_cols = [f'Consumer_GeneratorEngine{i}_FuelType_RM 380' for i in range(1, 6)]
        gendm_cols = [f'Consumer_GeneratorEngine{i}_FuelType_DM' for i in range(1, 6)]

        if all(c in X.columns for c in gen380_cols):
            X['GenEngine_RM380_Count'] = X[gen380_cols].sum(axis=1)
        elif 'GenEngine_RM380_Count' not in X.columns:
            raise ValueError(
                "Need the 5 raw generator-engine RM380 flags or a "
                "precomputed 'GenEngine_RM380_Count' column.")

        if all(c in X.columns for c in gendm_cols):
            X['GenEngine_DM_Count'] = X[gendm_cols].sum(axis=1)
        elif 'GenEngine_DM_Count' not in X.columns:
            raise ValueError(
                "Need the 5 raw generator-engine DM flags or a "
                "precomputed 'GenEngine_DM_Count' column.")

        final_cols = self.core_features + self.weather_features + \
            ['Boiler_FuelType_RM380', 'GenEngine_RM380_Count', 'GenEngine_DM_Count']
        return X[final_cols]
