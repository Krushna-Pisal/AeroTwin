"""Phase 4 scenarios. Assumptions stay labeled, and PM2.5 is not rescaled."""

from fastapi.testclient import TestClient

from app.config import FORECAST_API_STATUS, FORECAST_METHOD, SCENARIO_SCORE_REDUCTION, STATUS_SCENARIO
from app.main import app
from app.services.forecast_service import forecast_station
from app.services.scenario_service import apply_score_reduction, pm25_changes
from app.services.source_contribution import contribution_payload

client = TestClient(app)


def _simulate(station_id: str, intervention: str, intensity: str, timestamp: str | None = None) -> dict:
    response = client.post(
        "/api/scenarios/simulate",
        json={
            "station_id": station_id,
            "timestamp": timestamp,
            "intervention": intervention,
            "intensity": intensity,
        },
    )
    assert response.status_code == 200
    return response.json()


def test_score_reduction_arithmetic_does_not_treat_missing_as_zero():
    removed, modeled = apply_score_reduction(0.8, 0.25)
    assert removed == 0.2
    assert modeled == 0.6
    assert apply_score_reduction(None, 0.25) == (None, None)
    assert pm25_changes(100.0, None) == (None, None)
    assert pm25_changes(100.0, 90.0) == (-10.0, -0.1)


def test_all_three_interventions_and_intensities():
    before = forecast_station("site_5404")
    body = client.post(
        "/api/scenarios/compare",
        json={
            "station_id": "site_5404",
            "interventions": [
                {"intervention": "traffic_restriction", "intensity": "LOW"},
                {"intervention": "industrial_control", "intensity": "MEDIUM"},
                {"intervention": "dust_construction_control", "intensity": "HIGH"},
            ],
        },
    )
    assert body.status_code == 200
    payload = body.json()
    assert forecast_station("site_5404") == before
    names = [row["intervention_type"] for row in payload["scenarios"]]
    assert names == [
        "traffic_restriction",
        "industrial_control",
        "dust_construction_control",
    ]
    assert [row["intervention_intensity"] for row in payload["scenarios"]] == ["LOW", "MEDIUM", "HIGH"]
    assert "rank" not in payload
    assert "best" not in payload
    assert payload["limitations"][-2] == "Scenarios are listed in the requested order and are not ranked."
    traffic, industrial, dust = payload["scenarios"]
    score = contribution_payload("site_5404")["categories"][0]["score"]
    assert traffic["baseline_contribution"] == score
    assert traffic["reduction_assumption"] == SCENARIO_SCORE_REDUCTION["LOW"]
    assert traffic["reduction_assumption_label"] == "SCENARIO_ASSUMPTION"
    assert traffic["modeled_contribution"] == round(score * (1.0 - SCENARIO_SCORE_REDUCTION["LOW"]), 4)
    assert industrial["baseline_contribution"] is None
    assert industrial["modeled_contribution"] is None
    assert dust["baseline_contribution"] is None
    assert dust["modeled_contribution"] is None
    assert all(row["modeled_pm25"] is None for row in payload["scenarios"])
    assert all(row["status"] == STATUS_SCENARIO for row in payload["scenarios"])


def test_intensity_changes_only_the_assumption_scale():
    score = contribution_payload("site_5404")["categories"][0]["score"]
    seen = []
    for intensity, reduction in SCENARIO_SCORE_REDUCTION.items():
        body = _simulate("site_5404", "traffic_restriction", intensity)
        scenario = body["scenario"]
        assert scenario["baseline_contribution"] == score
        assert scenario["reduction_assumption"] == reduction
        assert scenario["modeled_contribution"] == round(score * (1.0 - reduction), 4)
        assert scenario["confidence"] == "LOW"
        assert body["assumptions"][0]["label"] == "SCENARIO_ASSUMPTION"
        seen.append(scenario["modeled_contribution"])
    assert seen[0] != seen[1] != seen[2]


def test_missing_source_evidence_does_not_invent_a_share_or_a_concentration():
    body = _simulate("site_5404", "dust_construction_control", "HIGH")
    scenario = body["scenario"]
    assert scenario["source_evidence_status"] == "DATA_UNAVAILABLE"
    assert scenario["baseline_contribution"] is None
    assert scenario["modeled_contribution"] is None
    assert scenario["modeled_pm25"] is None
    assert scenario["absolute_change"] is None
    assert scenario["percentage_change"] is None
    assert scenario["confidence"] is None
    assert scenario["status"] == STATUS_SCENARIO
    assert body["delta"]["contribution_absolute_change"] is None

    unavailable = _simulate("site_6012", "traffic_restriction", "LOW")
    assert unavailable["scenario"]["baseline_contribution"] is None
    assert unavailable["scenario"]["modeled_contribution"] is None
    assert unavailable["scenario"]["modeled_pm25"] is None
    assert unavailable["baseline"]["pm25_status"] == "OBSERVED"


def test_baseline_is_preserved_and_scenario_is_not_labeled_observed():
    before = forecast_station("site_5404")
    first = _simulate("site_5404", "traffic_restriction", "MEDIUM")
    second = _simulate("site_5404", "traffic_restriction", "MEDIUM")
    after = forecast_station("site_5404")
    forecast = client.get("/api/forecast", params={"station_id": "site_5404"})
    assert first == second
    assert before == after
    assert forecast.status_code == 200
    published = forecast.json()
    assert published["method"] == FORECAST_METHOD
    assert published["status"] == FORECAST_API_STATUS
    assert published["forecast_pm25_24h"] == published["current_pm25"] == before["current_pm25"]
    assert first["baseline"]["pm25"] == before["current_pm25"]
    assert first["baseline"]["pm25_status"] == "OBSERVED"
    assert first["baseline"]["production_forecast_modified"] is False
    assert first["scenario"]["status"] == STATUS_SCENARIO
    assert first["delta"]["status"] == STATUS_SCENARIO
    assert first["scenario"]["modeled_pm25"] is None
    text = str(first)
    assert "% of pollution" not in text
    assert "comes from traffic" not in text
    assert "enforcement percentage" in text


def test_unknown_station_and_unknown_intervention():
    missing = client.post(
        "/api/scenarios/simulate",
        json={"station_id": "missing", "intervention": "traffic_restriction", "intensity": "LOW"},
    )
    assert missing.status_code == 404
    rejected = client.post(
        "/api/scenarios/simulate",
        json={"station_id": "site_5404", "intervention": "weather_control", "intensity": "LOW"},
    )
    assert rejected.status_code == 422
