import pandas as pd

from src.data.parameter_builder import ParameterBuilder, ParameterView


EXPECTED_VIEWS = {
    "ports",
    "port_activity",
    "cargo_history",
    "vessel_observations",
    "fleet_statistics",
    "fuel_ghg_reference",
}

REQUIRED_PROVENANCE_COLUMNS = {
    "parameter",
    "source_dataset",
    "original_column",
    "unit",
    "transformation",
}


def test_builder_creates_six_independent_traceable_views() -> None:
    views = ParameterBuilder().build_all()

    assert set(views) == EXPECTED_VIEWS
    for name, view in views.items():
        assert isinstance(view, ParameterView)
        assert not view.data.empty, name
        assert REQUIRED_PROVENANCE_COLUMNS <= set(view.provenance.columns), name
        assert view.provenance["source_dataset"].notna().all(), name
        assert view.provenance["original_column"].notna().all(), name
        assert view.provenance["transformation"].notna().all(), name
        processed_parameters = set(view.data.columns) - {
            "source_dataset",
            "original_column",
        }
        assert processed_parameters <= set(view.provenance["parameter"]), name


def test_ports_preserve_coded_depth_and_do_not_claim_shore_power() -> None:
    ports = ParameterBuilder().build_ports()

    assert "cargo_depth_code" in ports.data.columns
    assert "port_depth_m" not in ports.data.columns
    assert "electrical_service_reported" in ports.data.columns
    assert "shore_power_available" not in ports.data.columns
    depth_meta = ports.provenance.set_index("parameter").loc["cargo_depth_code"]
    assert depth_meta["original_column"] == "CARGODEPTH"
    assert pd.isna(depth_meta["unit"])


def test_activity_and_fleet_views_do_not_derive_capacity_from_observations() -> None:
    builder = ParameterBuilder()

    port_activity = builder.build_port_activity()
    fleet = builder.build_fleet_statistics()

    forbidden = {"port_capacity", "vessel_capacity", "max_capacity"}
    assert forbidden.isdisjoint(port_activity.data.columns)
    assert forbidden.isdisjoint(fleet.data.columns)
    assert set(port_activity.data["source_dataset"].unique()) == {
        "india_port_traffic_combined.csv",
        "world_ports_master.csv",
    }
    assert set(fleet.data.loc[fleet.data["statistic"] == "DWT", "unit"]) == {
        "DWT (source scaling undocumented)"
    }
    assert set(fleet.data.loc[fleet.data["statistic"] == "GT", "unit"]) == {
        "GT (source scaling undocumented)"
    }
    assert set(
        fleet.data.loc[fleet.data["statistic"].str.lower() == "no. of vessels", "unit"]
    ) == {"vessels"}
    unit_meta = fleet.provenance.set_index("parameter").loc["unit"]
    assert unit_meta["original_column"] == "Item"


def test_vessel_observations_keep_cargo_and_draft_as_observations() -> None:
    view = ParameterBuilder().build_vessel_observations()

    assert {"cargo_weight_tons", "draft_m", "speed_over_ground_knots"} <= set(
        view.data.columns
    )
    assert "vessel_capacity_tons" not in view.data.columns
    assert view.provenance.set_index("parameter").loc["draft_m", "unit"] == "m"


def test_fuel_ghg_reference_keeps_units_and_source_identity() -> None:
    view = ParameterBuilder().build_fuel_ghg_reference()

    assert {
        "fuel",
        "metric",
        "value",
        "unit",
        "source_dataset",
        "original_column",
    } <= set(view.data.columns)
    assert "kgCO2eq/MJ" in set(view.data["unit"].dropna())
    assert "ratio relative to HFO" in set(view.data["unit"].dropna())
    assert view.data["source_dataset"].nunique() >= 5
