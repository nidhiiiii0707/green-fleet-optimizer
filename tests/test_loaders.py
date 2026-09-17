from pathlib import Path

import pandas as pd
import pytest

from src.data.loaders import DatasetLoader


def test_loader_reads_named_dataset_without_combining_sources() -> None:
    loader = DatasetLoader()

    cps = loader.load("cps_poseidon")
    wpi = loader.load("wpi")

    assert cps.shape == (105_422, 78)
    assert wpi.shape == (3_669, 82)
    assert "Consumer_Total_MomentaryFuel" in cps.columns
    assert "PORT_NAME" in wpi.columns
    assert cps is not loader.load("cps_poseidon")


def test_loader_registry_contains_every_repository_csv() -> None:
    loader = DatasetLoader()

    registered = {path.resolve() for path in loader.dataset_paths.values()}
    on_disk = {path.resolve() for path in loader.data_dir.rglob("*.csv")}

    assert registered == on_disk


def test_loader_rejects_unknown_dataset_name() -> None:
    with pytest.raises(KeyError, match="Unknown dataset"):
        DatasetLoader().load("not-a-dataset")
