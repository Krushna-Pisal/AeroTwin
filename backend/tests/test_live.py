"""Live readings stay separate from the CPCB archive and carry the right status."""

import time

import pytest

from app.config import STATUS_DATA_UNAVAILABLE, STATUS_MODELED, STATUS_OBSERVED
from app.services import live_service
from app.services.environment_service import environmental_situation
from app.services.forecast_service import forecast_station

IST = 5.5 * 3600


def _waqi(lat, lng, aqi=63, hours_old=1.0, name="Shivajinagar, Pune, India"):
    local_epoch = int(time.time() - hours_old * 3600 + IST)
    return {
        "aqi": aqi,
        "city": {"geo": [lat, lng], "name": name, "url": "https://aqicn.org/city/india/pune/shivajinagar"},
        "iaqi": {"pm25": {"v": aqi}, "pm10": {"v": 40}},
        "time": {"v": local_epoch, "tz": "+05:30", "iso": "2026-09-29T19:00:00+05:30"},
    }


def _open_meteo(lat, lng):
    return {"pm25": 25.6, "pm10": 40.1, "aqi_us": 80, "time": "2026-09-29T14:00"}


@pytest.mark.parametrize(
    ("aqi", "pm25"),
    [(0, 0.0), (50, 12.0), (63, 17.8), (100, 35.4), (158, 69.1), (500, 500.4)],
)
def test_waqi_aqi_is_converted_back_to_concentration(aqi, pm25):
    assert live_service.aqi_to_pm25(aqi) == pytest.approx(pm25, abs=0.1)


def test_nearby_recent_waqi_monitor_is_observed(monkeypatch):
    monkeypatch.setattr(live_service, "fetch_waqi", lambda lat, lng: _waqi(lat + 0.01, lng))
    live = live_service.reading_for_station("site_5409")
    assert live["status"] == STATUS_OBSERVED
    assert live["pm25_aqi_us"] == 63
    assert live["pm25"] == pytest.approx(17.8, abs=0.1)
    assert live["distance_km"] < 2
    assert live["same_monitor"] is False


def test_distant_waqi_monitor_falls_back_to_a_modeled_value(monkeypatch):
    monkeypatch.setattr(live_service, "fetch_waqi", lambda lat, lng: _waqi(28.5, 77.2, aqi=86, name="Delhi"))
    monkeypatch.setattr(live_service, "fetch_open_meteo", _open_meteo)
    live = live_service.reading_for_station("site_5409")
    assert live["status"] == STATUS_MODELED
    assert live["pm25"] == 25.6
    assert "Delhi" in live["detail"]
    assert "not a monitor reading" in live["detail"]


def test_stale_waqi_monitor_is_not_observed(monkeypatch):
    monkeypatch.setattr(live_service, "fetch_waqi", lambda lat, lng: _waqi(lat, lng, hours_old=30))
    monkeypatch.setattr(live_service, "fetch_open_meteo", _open_meteo)
    live = live_service.reading_for_station("site_5409")
    assert live["status"] == STATUS_MODELED
    assert "30 h ago" in live["detail"]


def test_live_reading_does_not_replace_the_cpcb_hour(monkeypatch):
    monkeypatch.setattr(live_service, "fetch_waqi", lambda lat, lng: _waqi(lat, lng))
    before = forecast_station("site_5409")
    body = environmental_situation("site_5409")
    assert forecast_station("site_5409") == before
    assert body["current_observation"]["pm25"] == before["current_pm25"]
    assert body["forecast"]["forecast_status"] == "observed_baseline"
    live = body["live_reading"]
    assert live["archive_unchanged"] is True
    assert live["forecast_unchanged"] is True


def test_every_source_failing_invents_no_number(monkeypatch):
    def boom(lat, lng):
        raise OSError("down")

    monkeypatch.setattr(live_service, "fetch_waqi", boom)
    monkeypatch.setattr(live_service, "fetch_open_meteo", boom)
    live = live_service.reading_for_station("site_5409")
    assert live["status"] == STATUS_DATA_UNAVAILABLE
    assert live["pm25"] is None
