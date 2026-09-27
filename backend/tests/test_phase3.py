"""Phase 3 contribution estimates. Shares are not invented from one score."""

from fastapi.testclient import TestClient

from app.config import STATUS_DATA_UNAVAILABLE, STATUS_PROXY
from app.main import app
from app.services.source_contribution import apply_normalized_shares, contribution_payload, proximity_score

client = TestClient(app)


def test_proximity_score_is_deterministic():
    assert proximity_score(0) == 1.0
    assert proximity_score(500) == 0.5
    assert proximity_score(500) == proximity_score(500)


def test_shares_require_two_scores_and_sum_to_one():
    alone = [
        {"category": "TRAFFIC", "score": 0.4},
        {"category": "INDUSTRIAL", "score": None},
        {"category": "DUST_CONSTRUCTION", "score": None},
    ]
    apply_normalized_shares(alone)
    assert [row["normalized_share"] for row in alone] == [None, None, None]

    paired = [
        {"category": "TRAFFIC", "score": 0.25},
        {"category": "INDUSTRIAL", "score": 0.75},
        {"category": "DUST_CONSTRUCTION", "score": None},
    ]
    apply_normalized_shares(paired)
    assert paired[0]["normalized_share"] == 0.25
    assert paired[1]["normalized_share"] == 0.75
    assert paired[2]["normalized_share"] is None
    assert round(paired[0]["normalized_share"] + paired[1]["normalized_share"], 4) == 1.0


def test_station_exposes_three_categories_without_a_fabricated_share():
    first = client.get("/api/source-contributions/site_5404")
    second = client.get("/api/source-contributions/site_5404")
    assert first.status_code == 200
    assert first.json() == second.json()
    body = first.json()
    assert body["methodology"] == "evidence-weighted contribution estimate"
    assert "not causal source apportionment" in body["limitations"][0]
    names = [row["category"] for row in body["categories"]]
    assert names == ["TRAFFIC", "INDUSTRIAL", "DUST_CONSTRUCTION"]
    by_name = {row["category"]: row for row in body["categories"]}
    traffic = by_name["TRAFFIC"]
    assert traffic["status"] == STATUS_PROXY
    assert traffic["confidence"] == "LOW"
    assert traffic["score"] is not None
    assert 0 < traffic["score"] <= 1
    assert traffic["normalized_share"] is None
    assert by_name["INDUSTRIAL"]["status"] == STATUS_DATA_UNAVAILABLE
    assert by_name["INDUSTRIAL"]["score"] is None
    assert by_name["INDUSTRIAL"]["normalized_share"] is None
    assert by_name["DUST_CONSTRUCTION"]["status"] == STATUS_DATA_UNAVAILABLE
    assert by_name["DUST_CONSTRUCTION"]["score"] is None
    assert body["pm25_status"] == "OBSERVED"
    assert all(row["normalized_share"] is None for row in body["categories"])
    text = str(body)
    assert "% of pollution" not in text
    assert "comes from traffic" not in text


def test_missing_coordinates_leave_every_category_unavailable():
    body = contribution_payload("site_6012")
    assert body is not None
    assert [row["status"] for row in body["categories"]] == [STATUS_DATA_UNAVAILABLE] * 3
    assert all(row["score"] is None and row["normalized_share"] is None and row["confidence"] is None for row in body["categories"])


def test_unknown_station_is_not_found():
    assert client.get("/api/source-contributions/missing").status_code == 404
