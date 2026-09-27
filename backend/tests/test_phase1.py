"""Phase 1 checks. These read the processed CPCB table and do not train a model."""

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import (
    DATA_STATUSES,
    FORECAST_API_STATUS,
    FORECAST_METHOD,
    HOTSPOT_CONCENTRATION_FLOOR,
    SOURCE_CATEGORIES,
    STATUS_DATA_UNAVAILABLE,
    STATUS_OBSERVED,
    STATUS_SCENARIO,
)
from app.domain.schemas import (
    ActivityEvidence,
    CitizenObservation,
    EnvironmentalObservation,
    EnvironmentalSituation,
    Forecast,
    Hotspot,
    ScenarioResult,
    SourceContribution,
)
from app.main import app
from app.providers.activity import activity_providers
from app.schemas import Forecast as ApiForecast

client = TestClient(app)


def test_status_vocabulary_is_exact():
    assert DATA_STATUSES == (
        "OBSERVED",
        "MODELED",
        "CITIZEN_REPORTED",
        "PROXY",
        "SCENARIO",
        "DATA_UNAVAILABLE",
    )
    assert "observed_baseline" not in DATA_STATUSES
    assert "WEATHER" not in SOURCE_CATEGORIES
    assert SOURCE_CATEGORIES == ("TRAFFIC", "INDUSTRIAL", "DUST_CONSTRUCTION")


def test_observation_schema_rejects_unknown_status():
    try:
        EnvironmentalObservation(
            value=10,
            unit="µg/m³",
            timestamp="2025-12-31T23:00:00Z",
            station_id="site_5404",
            source="test",
            status="observed_baseline",
            variable="pm25",
        )
    except ValidationError:
        return
    raise AssertionError("unknown status was accepted")


def test_activity_schema_rejects_weather_as_a_source():
    try:
        ActivityEvidence(category="WEATHER", status=STATUS_DATA_UNAVAILABLE)
    except ValidationError:
        return
    raise AssertionError("weather was accepted as a source category")


def test_domain_records_carry_metadata_and_do_not_invent_activity():
    observation = EnvironmentalObservation(
        value=12.5,
        unit="µg/m³",
        timestamp="2025-12-31T23:00:00Z",
        station_id="site_5404",
        latitude=18.57,
        longitude=73.92,
        source="OpenCity/CPCB",
        status=STATUS_OBSERVED,
        variable="pm25",
    )
    forecast = Forecast(
        value=observation.value,
        timestamp=observation.timestamp,
        valid_timestamp="2026-01-01T23:00:00Z",
        station_id="site_5404",
        source=observation.source,
        status="MODELED",
        method=FORECAST_METHOD,
        api_status=FORECAST_API_STATUS,
    )
    hotspot = Hotspot(
        station_id="site_5404",
        station_name="Mhada Colony, Pune - IITM",
        value=observation.value,
        timestamp=observation.timestamp,
        source=observation.source,
        status=STATUS_OBSERVED,
        hotspot=True,
    )
    citizen = CitizenObservation(
        timestamp=observation.timestamp,
        latitude=18.57,
        longitude=73.92,
        category="dust_construction",
        severity="low",
    )
    contribution = SourceContribution(
        category="TRAFFIC",
        value=None,
        source="not estimated",
        status=STATUS_DATA_UNAVAILABLE,
        note="This represents the contribution of model features to the prediction and is not direct causal source apportionment.",
    )
    scenario = ScenarioResult(
        scenario_id="none",
        baseline_value=observation.value,
        intervention_parameter={},
        source="design only",
        assumptions=["No response function is attached."],
    )
    situation = EnvironmentalSituation(
        timestamp=observation.timestamp,
        station_id="site_5404",
        observation=observation,
        forecast=forecast,
        hotspots=[hotspot],
        activity=[],
        citizen_observations=[citizen],
        source_contributions=[contribution],
        scenario_results=[scenario],
    )
    assert situation.forecast.value == situation.observation.value
    assert scenario.status == STATUS_SCENARIO
    assert citizen.status == "CITIZEN_REPORTED"
    assert contribution.value is None


def test_activity_providers_return_unavailable_without_a_value():
    providers = activity_providers()
    assert [item.category for item in providers] == list(SOURCE_CATEGORIES)
    for provider in providers:
        evidence = provider.get_activity(timestamp="2025-12-31T23:00:00Z", station_id="site_5404")
        assert evidence.value is None
        assert evidence.unit is None
        assert evidence.category == provider.category
        if provider.category == "INDUSTRIAL" and evidence.status != STATUS_DATA_UNAVAILABLE:
            assert evidence.status == "PROXY"
        else:
            assert evidence.status == STATUS_DATA_UNAVAILABLE


def test_existing_routes_stay_compatible():
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["production_forecast"] == FORECAST_METHOD
    assert health.json()["clock"] == "published_+0000"
    assert health.json()["pm25_hours"] > 0

    stations = client.get("/api/stations")
    assert stations.status_code == 200
    assert len(stations.json()["stations"]) == 12

    latest = client.get("/api/observations/latest")
    assert latest.status_code == 200
    body = latest.json()
    assert body["status"] == STATUS_OBSERVED
    assert len(body["observations"]) == 10
    assert body["observations"][0]["status"] == STATUS_OBSERVED

    history = client.get("/api/observations/history", params={"station_id": "site_5404", "limit": 2})
    assert history.status_code == 200
    assert history.json()["count"] == 2
    assert history.json()["status"] == STATUS_OBSERVED

    unknown = client.get("/api/observations/history", params={"station_id": "missing"})
    assert unknown.status_code == 404

    held_out = client.get("/api/observations/history", params={"station_id": "site_292", "limit": 5})
    assert held_out.status_code == 200
    assert held_out.json()["observations"] == []


def test_forecast_endpoint_remains_persistence():
    response = client.get("/api/forecast", params={"station_id": "site_5404"})
    assert response.status_code == 200
    payload = response.json()
    ApiForecast.model_validate(payload)
    assert payload["method"] == FORECAST_METHOD
    assert payload["status"] == FORECAST_API_STATUS
    assert payload["forecast_pm25_24h"] == payload["current_pm25"]
    assert payload["model_metadata"]["v2_promoted"] is False
    missing = client.get("/api/forecast", params={"station_id": "site_292"})
    assert missing.status_code == 404


def test_hotspot_endpoint_uses_the_documented_rule():
    response = client.get("/api/hotspots")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == STATUS_OBSERVED
    assert payload["interpolation"] is None
    assert payload["spatial_support"] == "station"
    assert payload["rule"]["concentration_floor_ugm3"] == HOTSPOT_CONCENTRATION_FLOOR
    assert payload["stations_scored"] == 10
    for row in payload["hotspots"]:
        assert row["status"] == STATUS_OBSERVED
        assert row["latest_pm25"] >= HOTSPOT_CONCENTRATION_FLOOR
        assert row["rolling_24h_mean"] >= HOTSPOT_CONCENTRATION_FLOOR
        assert row["percentile"] >= 0.75
