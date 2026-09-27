"""Phase 6 fusion. Each existing service keeps its own status."""

from fastapi.testclient import TestClient

from app.config import (
    FORECAST_API_STATUS,
    FORECAST_METHOD,
    STATUS_DATA_UNAVAILABLE,
    STATUS_MODELED,
    STATUS_OBSERVED,
    STATUS_SCENARIO,
    ZONE_RADIUS_M,
)
from app.main import app
from app.services.forecast_service import forecast_station
from app.services.hotspot_service import station_diagnostics
from app.services.source_contribution import contribution_payload
from app.stations import STATIONS

client = TestClient(app)


def test_environment_chain_matches_the_existing_services():
    before = forecast_station("site_5404")
    response = client.get("/api/environment/site_5404")
    assert response.status_code == 200
    body = response.json()
    forecast = client.get("/api/forecast", params={"station_id": "site_5404"}).json()
    assert forecast_station("site_5404") == before

    assert body["station"]["station_id"] == "site_5404"
    assert body["station"]["status"] == STATUS_OBSERVED
    assert body["current_observation"]["status"] == STATUS_OBSERVED
    assert body["current_observation"]["pm25"] == forecast["current_pm25"]
    assert body["forecast"]["pm25"] == forecast["forecast_pm25_24h"] == forecast["current_pm25"]
    assert body["forecast"]["method"] == FORECAST_METHOD
    assert body["forecast"]["status"] == STATUS_MODELED
    assert body["forecast"]["forecast_status"] == FORECAST_API_STATUS
    assert body["interpolation"] is None

    scored = next(row for row in station_diagnostics() if row["station_id"] == "site_5404")
    assert body["hotspot"]["status"] == STATUS_OBSERVED
    assert body["hotspot"]["hotspot"] == scored["hotspot"]
    assert body["hotspot"]["interpolation"] is None

    assert body["activity"]["traffic"]["volume"] is None
    assert body["activity"]["traffic"]["volume_status"] == STATUS_DATA_UNAVAILABLE
    assert body["activity"]["traffic"]["context_layer"]["measures_traffic"] is False
    assert body["activity"]["dust_construction"]["status"] == STATUS_DATA_UNAVAILABLE

    contributions = contribution_payload("site_5404")
    assert body["source_contributions"]["categories"] == contributions["categories"]
    assert body["source_contributions"]["pm25"] == body["current_observation"]["pm25"]

    quality = body["data_quality"]
    coverage = quality["pm25_coverage"]
    assert coverage["status"] == STATUS_OBSERVED
    assert 0 < coverage["hours_with_pm25"] <= coverage["hours_in_table"]
    assert coverage["coverage_fraction"] == round(coverage["hours_with_pm25"] / coverage["hours_in_table"], 4)
    assert quality["coordinate_availability"]["available"] is True
    assert quality["coordinate_availability"]["status"] == STATUS_OBSERVED
    assert quality["citizen_report_availability"]["count"] == 0
    assert quality["citizen_report_availability"]["status"] == STATUS_DATA_UNAVAILABLE
    assert body["citizen_reports"]["reports"] == []
    assert body["citizen_reports"]["status"] == STATUS_DATA_UNAVAILABLE

    weather = body["weather"]
    present = [name for name, field in weather["fields"].items() if field["value"] is not None]
    assert weather["fields_present"] == len(present)
    assert weather["status"] == (STATUS_OBSERVED if present else STATUS_DATA_UNAVAILABLE)
    for field in weather["fields"].values():
        assert field["status"] == (STATUS_OBSERVED if field["value"] is not None else STATUS_DATA_UNAVAILABLE)

    assert body["scenario_availability"]["status"] == STATUS_SCENARIO
    assert body["scenario_availability"]["results_included"] is False
    assert body["scenario_availability"]["results"] is None
    assert body["scenario_availability"]["production_forecast_modified"] is False

    simulated = client.post(
        "/api/scenarios/simulate",
        json={"station_id": "site_5404", "intervention": "traffic_restriction", "intensity": "LOW"},
    )
    assert simulated.status_code == 200
    scenario = simulated.json()
    assert scenario["baseline"]["pm25"] == body["current_observation"]["pm25"]
    assert scenario["scenario"]["status"] == STATUS_SCENARIO
    assert scenario["scenario"]["modeled_pm25"] is None
    assert forecast_station("site_5404") == before
    assert client.get("/api/forecast", params={"station_id": "site_5404"}).json()["status"] == FORECAST_API_STATUS


def test_included_scenarios_stay_labeled_scenario():
    before = forecast_station("site_5404")
    response = client.get(
        "/api/environment/site_5404",
        params={"include_scenarios": True, "scenario_intensity": "HIGH"},
    )
    assert response.status_code == 200
    body = response.json()
    availability = body["scenario_availability"]
    assert availability["results_included"] is True
    assert availability["results_status"] == STATUS_SCENARIO
    scenarios = availability["results"]["scenarios"]
    assert [row["intervention_type"] for row in scenarios] == [
        "traffic_restriction",
        "industrial_control",
        "dust_construction_control",
    ]
    assert all(row["status"] == STATUS_SCENARIO for row in scenarios)
    assert all(row["intervention_intensity"] == "HIGH" for row in scenarios)
    assert body["current_observation"]["status"] == STATUS_OBSERVED
    assert forecast_station("site_5404") == before


def test_incomplete_station_data_stays_unavailable():
    missing_point = client.get("/api/environment/site_6012")
    assert missing_point.status_code == 200
    body = missing_point.json()
    assert body["current_observation"]["status"] == STATUS_OBSERVED
    assert body["forecast"]["status"] == STATUS_MODELED
    assert body["forecast"]["pm25"] == body["current_observation"]["pm25"]
    assert body["data_quality"]["coordinate_availability"]["status"] == STATUS_DATA_UNAVAILABLE
    assert body["zone"]["status"] == STATUS_DATA_UNAVAILABLE
    assert body["zone"]["official_administrative_zone"] is False
    assert all(row["score"] is None for row in body["source_contributions"]["categories"])
    assert body["activity"]["traffic"]["score"] is None

    outside = client.get("/api/environment/site_292")
    assert outside.status_code == 200
    historical = outside.json()
    assert historical["current_observation"]["status"] == STATUS_DATA_UNAVAILABLE
    assert historical["current_observation"]["pm25"] is None
    assert historical["forecast"]["status"] == STATUS_DATA_UNAVAILABLE
    assert historical["forecast"]["pm25"] is None
    assert historical["hotspot"]["status"] == STATUS_DATA_UNAVAILABLE
    assert historical["hotspot"]["hotspot"] is None
    assert historical["data_quality"]["pm25_coverage"]["status"] == STATUS_DATA_UNAVAILABLE
    assert historical["data_quality"]["coordinate_availability"]["status"] == STATUS_DATA_UNAVAILABLE

    assert client.get("/api/environment/missing").status_code == 404


def test_zones_are_station_buffers():
    response = client.get("/api/zones")
    assert response.status_code == 200
    body = response.json()
    assert body["official_administrative_zones"] is False
    assert body["boundary_dataset"] is None
    assert body["radius_m"] == ZONE_RADIUS_M
    assert "1000" in body["basis"]
    assert len(body["zones"]) == len(STATIONS)
    by_station = {zone["station_id"]: zone for zone in body["zones"]}
    mhada = by_station["site_5404"]
    assert mhada["status"] == STATUS_MODELED
    assert mhada["official_administrative_zone"] is False
    ring = mhada["geometry"]["coordinates"][0]
    assert ring[0] == ring[-1]
    assert "administrative" not in mhada["name"].lower()
    dhankawadi = by_station["site_6012"]
    assert dhankawadi["geometry"] is None
    assert dhankawadi["status"] == STATUS_DATA_UNAVAILABLE


def test_map_layers_keep_the_catalog_and_do_not_paint_roads_with_pm25():
    response = client.get("/api/map/layers")
    assert response.status_code == 200
    body = response.json()
    layers = {item["id"]: item for item in body["layers"]}
    assert layers["dust_construction"]["status"] == STATUS_DATA_UNAVAILABLE
    assert layers["road_network"]["representation"] == "ROAD_NETWORK"
    assert body["interpolation"] is None
    current = body["collections"]["current_pm25"]
    assert current["status"] == STATUS_OBSERVED
    assert current["features"]
    assert all(feature["geometry"]["type"] == "Point" for feature in current["features"])
    assert "site_6012" not in {feature["properties"]["station_id"] for feature in current["features"]}
    forecast = body["collections"]["forecast"]
    assert forecast["status"] == STATUS_MODELED
    assert all(feature["properties"]["forecast_status"] == FORECAST_API_STATUS for feature in forecast["features"])
    assert all(feature["geometry"]["type"] == "Point" for feature in forecast["features"])
    roads = body["collections"]["road_context"]
    if roads["features"]:
        assert roads["status"] == STATUS_OBSERVED
        assert roads["measures_traffic"] is False
        assert roads["features"][0]["geometry"]["type"] == "LineString"
        assert "pm25" not in roads["features"][0]["properties"]
    assert body["collections"]["citizen_reports"]["features"] == []
    assert body["collections"]["citizen_reports"]["status"] == STATUS_DATA_UNAVAILABLE
    assert body["collections"]["scenario_results"]["features"] == []
    assert body["collections"]["hotspots"]["interpolation"] is None

    painted = client.get(
        "/api/map/layers",
        params={"scenario_intervention": "traffic_restriction", "scenario_intensity": "LOW"},
    )
    assert painted.status_code == 200
    scenarios = painted.json()["collections"]["scenario_results"]
    assert scenarios["status"] == STATUS_SCENARIO
    assert scenarios["features"]
    assert all(feature["geometry"]["type"] == "Point" for feature in scenarios["features"])
    assert all(feature["properties"]["status"] == STATUS_SCENARIO for feature in scenarios["features"])
    assert all(feature["properties"]["modeled_pm25"] is None for feature in scenarios["features"])
    assert "site_6012" not in {feature["properties"]["station_id"] for feature in scenarios["features"]}
