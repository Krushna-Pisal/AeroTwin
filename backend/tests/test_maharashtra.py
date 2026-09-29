from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import maharashtra_service as mh

client = TestClient(app)


def _hours(end: datetime, days: int, value) -> dict[str, float]:
    out = {}
    t = end - timedelta(days=days)
    while t <= end:
        out[t.strftime("%Y-%m-%dT%H:%M:%SZ")] = float(value(t))
        t += timedelta(hours=1)
    return out


def _location(location_id: int, lon: float, lat: float) -> dict:
    return {
        "location_id": location_id,
        "name": f"Station {location_id}",
        "locality": None,
        "provider": "AirNow",
        "owner": None,
        "longitude": lon,
        "latitude": lat,
    }


@pytest.fixture
def state(monkeypatch):
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    fresh_end = now - timedelta(hours=1)
    stale_end = now - timedelta(days=5)
    dead_end = now - timedelta(days=30)
    fake = {
        "listing_at": None,
        "cycle_started": None,
        "cycle_done": None,
        "locations": [
            _location(1, 73.85, 18.52),
            _location(2, 73.80, 18.60),
            _location(3, 72.85, 19.07),
        ],
        "readings": {
            1: {
                "latest": {"value": 40.0, "utc": fresh_end.strftime("%Y-%m-%dT%H:%M:%SZ")},
                "history": _hours(fresh_end, 10, lambda t: 30 + t.hour),
            },
            2: {
                "latest": {"value": 80.0, "utc": stale_end.strftime("%Y-%m-%dT%H:%M:%SZ")},
                "history": _hours(stale_end, 10, lambda t: 60.0),
            },
            3: {
                "latest": {"value": 55.0, "utc": dead_end.strftime("%Y-%m-%dT%H:%M:%SZ")},
                "history": _hours(dead_end, 10, lambda t: 55.0),
            },
        },
    }
    monkeypatch.setattr(mh, "_state", fake)
    return fake


def test_boundary_keeps_maharashtra_and_drops_neighbour_cities():
    assert mh.in_maharashtra(73.8567, 18.5204)  # Pune
    assert mh.in_maharashtra(72.8777, 19.0760)  # Mumbai
    assert mh.in_maharashtra(79.0882, 21.1458)  # Nagpur
    assert not mh.in_maharashtra(78.4867, 17.3850)  # Hyderabad
    assert not mh.in_maharashtra(72.8311, 21.1702)  # Surat


def test_forecast_never_reads_hours_after_the_origin():
    origin = datetime(2026, 9, 1, 12, tzinfo=timezone.utc)
    history = {origin - timedelta(hours=h): 50.0 + h % 24 for h in range(24 * 8)}
    before = mh.diurnal_forecast(history, origin, [1, 6, 24])
    history.update({origin + timedelta(hours=h): 999.0 for h in range(1, 30)})
    assert mh.diurnal_forecast(history, origin, [1, 6, 24]) == before


def test_one_spike_after_a_gap_does_not_repeat_into_the_forecast():
    origin = datetime(2026, 9, 29, 11, tzinfo=timezone.utc)
    history = {}
    for day in range(16, 21):
        for hour in range(24):
            history[datetime(2026, 9, day, hour, tzinfo=timezone.utc)] = 12.0
    for hour in range(8, 12):
        history[datetime(2026, 9, 28, hour, tzinfo=timezone.utc)] = 15.0
        history[datetime(2026, 9, 29, hour, tzinfo=timezone.utc)] = 15.0
    history[datetime(2026, 9, 29, 8, tzinfo=timezone.utc)] = 278.0
    tomorrow_08 = mh.diurnal_forecast(history, origin, [21])[0]
    assert tomorrow_08 < 20


def test_persistence_carries_the_last_hour():
    origin = datetime(2026, 9, 1, 12, tzinfo=timezone.utc)
    history = {origin - timedelta(hours=1): 20.0, origin: 42.0}
    assert mh.diurnal_forecast(history, origin, [1, 72], blend_hours=None) == [42.0, 42.0]


def test_only_a_recent_monitor_hour_is_observed(state):
    payload = mh.stations_payload()
    by_id = {f["properties"]["location_id"]: f["properties"] for f in payload["features"]}
    assert by_id[1]["now_status"] == "OBSERVED"
    assert by_id[1]["now_pm25"] == 40.0
    assert by_id[2]["now_status"] == "MODELED"
    assert by_id[2]["last_pm25"] == 80.0
    assert by_id[2]["now_pm25"] == pytest.approx(60.0, abs=0.5)
    assert by_id[3]["now_status"] == "DATA_UNAVAILABLE"
    assert by_id[3]["now_pm25"] is None
    assert payload["counts"] == {"OBSERVED": 1, "MODELED": 1, "DATA_UNAVAILABLE": 1}


def test_station_forecast_marks_future_hours_modeled(state):
    detail = mh.station_detail(1)
    assert len(detail["forecast"]) == mh.FORECAST_HOURS + 1
    assert detail["forecast"][0]["status"] == "OBSERVED"
    assert detail["forecast"][0]["pm25"] == 40.0
    assert detail["forecast"][0]["valid_utc"] == detail["station"]["last_utc"]
    assert {row["status"] for row in detail["forecast"][1:]} == {"MODELED"}
    assert all(row["status"] == "OBSERVED" for row in detail["recent_hours"])


def test_point_estimate_is_modeled_and_weights_nearer_monitors(state):
    point = mh.point_estimate(18.53, 73.84)
    assert point["now_status"] == "MODELED"
    assert point["confidence"] == "HIGH"
    weights = {n["location_id"]: n["weight"] for n in point["neighbours"]}
    assert 3 not in weights
    assert weights[1] > weights[2]
    assert sum(weights.values()) == pytest.approx(1.0, abs=0.01)
    assert {row["status"] for row in point["forecast"]} == {"MODELED"}
    assert all(row["typical_error"] is None for row in point["forecast"])


def test_point_outside_the_state_has_no_number(state):
    point = mh.point_estimate(17.385, 78.4867)
    assert point["inside_maharashtra"] is False
    assert point["now_pm25"] is None
    assert point["now_status"] == "DATA_UNAVAILABLE"


def test_routes_respond_without_network(state):
    assert client.get("/api/maharashtra/stations").json()["type"] == "FeatureCollection"
    assert client.get("/api/maharashtra/stations/1").status_code == 200
    assert client.get("/api/maharashtra/stations/424242").status_code == 404
    assert client.get("/api/maharashtra/point", params={"lat": 18.5, "lon": 73.8}).json()["kind"] == "point"
    boundary = client.get("/api/maharashtra/boundary")
    assert boundary.status_code == 200
    assert boundary.json()["features"][0]["properties"]["iso"] == "IN-MH"
