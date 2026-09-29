"""OpenAQ readings are the same CPCB monitor and stay separate from the archive."""

from app.config import STATUS_DATA_UNAVAILABLE, STATUS_OBSERVED
from app.services import openaq_service
from app.services.environment_service import environmental_situation
from app.services.forecast_service import forecast_station

LOCATION = {
    "name": "Mhada Colony, Pune - IITM",
    "timezone": "Asia/Kolkata",
    "sensors": [
        {"id": 1, "parameter": {"name": "pm25"}},
        {"id": 2, "parameter": {"name": "pm10"}},
        {"id": 3, "parameter": {"name": "pm25"}},
    ],
}
LATEST = [
    {"sensorsId": 1, "value": 29.02, "datetime": {"utc": "2022-06-22T08:45:00Z"}},
    {"sensorsId": 2, "value": 121.26, "datetime": {"utc": "2026-09-24T17:30:00Z"}},
    {"sensorsId": 3, "value": 43.19, "datetime": {"utc": "2026-09-24T17:30:00Z", "local": "2026-09-24T23:00:00+05:30"}},
]


def _online(monkeypatch, location=LOCATION, latest=LATEST):
    def fake(path):
        return {"results": latest if path.endswith("/latest") else [location]}

    openaq_service.clear_cache()
    monkeypatch.setattr(openaq_service, "OPENAQ_API_KEY", "test-key")
    monkeypatch.setattr(openaq_service, "fetch_json", fake)


def test_newest_pm25_sensor_wins_over_stale_duplicate():
    picked = openaq_service.pick_newest_pm25(LOCATION, LATEST)
    assert picked["value"] == 43.19
    assert picked["utc"] == "2026-09-24T17:30:00Z"


def test_recent_reading_does_not_replace_archive_or_forecast(monkeypatch):
    _online(monkeypatch)
    before = forecast_station("site_5404")
    body = environmental_situation("site_5404")
    recent = body["recent_cpcb_reading"]
    assert recent["status"] == STATUS_OBSERVED
    assert recent["pm25"] == 43.19
    assert recent["same_monitor"] is True
    assert recent["timestamp_utc"] == "2026-09-24T17:30:00Z"
    assert recent["age_hours"] > 0
    assert body["current_observation"]["pm25"] == before["current_pm25"]
    assert forecast_station("site_5404") == before


def test_missing_key_is_unavailable(monkeypatch):
    monkeypatch.setattr(openaq_service, "OPENAQ_API_KEY", "")
    recent = openaq_service.reading_for_station("site_5404")
    assert recent["status"] == STATUS_DATA_UNAVAILABLE
    assert recent["pm25"] is None


def test_failed_request_does_not_invent_a_number(monkeypatch):
    def boom(path):
        raise OSError("down")

    openaq_service.clear_cache()
    monkeypatch.setattr(openaq_service, "OPENAQ_API_KEY", "test-key")
    monkeypatch.setattr(openaq_service, "fetch_json", boom)
    recent = openaq_service.reading_for_station("site_5409")
    assert recent["status"] == STATUS_DATA_UNAVAILABLE
    assert recent["pm25"] is None


def test_no_pm25_row_is_unavailable(monkeypatch):
    _online(monkeypatch, latest=[LATEST[1]])
    recent = openaq_service.reading_for_station("site_5404")
    assert recent["status"] == STATUS_DATA_UNAVAILABLE
    assert recent["pm25"] is None
