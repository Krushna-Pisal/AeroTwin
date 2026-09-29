"""Recent PM2.5 for the same CPCB monitors, read from OpenAQ v3.

OpenAQ carries the CPCB CAAQMS stations under the same names and coordinates
as the station registry. Values are returned with their own timestamp and age.
Nothing here is written into the hourly table, and the persistence forecast is
not changed.
"""

from __future__ import annotations

import json
import threading
import time
import urllib.request
from datetime import datetime, timezone

from app.config import (
    OPENAQ_API_KEY,
    OPENAQ_API_URL,
    OPENAQ_SOURCE,
    PM25_UNIT,
    STATUS_DATA_UNAVAILABLE,
    STATUS_OBSERVED,
)

# Registry station id -> OpenAQ location id. Matched on exact station name and
# coordinates. Bhosari has an older caaqm duplicate (11608) that stopped in 2022.
OPENAQ_LOCATION = {
    "site_5404": 11609,
    "site_5405": 12042,
    "site_5406": 3409331,
    "site_5407": 60658,
    "site_5408": 11610,
    "site_5409": 11613,
    "site_5766": 3409438,
    "site_5767": 3409439,
    "site_5988": 3409523,
    "site_5996": 3409526,
    "site_6012": 3410005,
    "site_292": 5661,
}

_NO_KEY = "OPENAQ_API_KEY is not set. No recent reading was requested."
_UNREADABLE = "OpenAQ could not be read. No number was filled in."
_NOT_MAPPED = "This station has no matching OpenAQ location."
_NO_PM25 = "OpenAQ returned no PM2.5 value for this monitor."
_SAME_MONITOR = (
    "Same CPCB CAAQMS monitor, republished by OpenAQ. "
    "Kept separate from the project archive. The persistence forecast is unchanged."
)

_CACHE_SECONDS = 600
_FAILURE_CACHE_SECONDS = 60
_lock = threading.Lock()
_cache: dict[int, tuple[float, dict]] = {}


def clear_cache() -> None:
    with _lock:
        _cache.clear()


def fetch_json(path: str) -> dict:
    request = urllib.request.Request(
        OPENAQ_API_URL + path,
        headers={"X-API-Key": OPENAQ_API_KEY, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=12) as response:
        return json.load(response)


def latest_pm25(location_id: int) -> dict:
    """Newest PM2.5 row for one OpenAQ location. Cached per location."""
    now = time.monotonic()
    with _lock:
        hit = _cache.get(location_id)
        if hit is not None and now < hit[0]:
            return hit[1]
    try:
        location = fetch_json(f"/locations/{location_id}")["results"][0]
        latest = fetch_json(f"/locations/{location_id}/latest")["results"]
        result = pick_newest_pm25(location, latest)
        ttl = _CACHE_SECONDS
    except Exception:
        result = {"ok": False, "detail": _UNREADABLE}
        ttl = _FAILURE_CACHE_SECONDS
    with _lock:
        _cache[location_id] = (time.monotonic() + ttl, result)
    return result


def pick_newest_pm25(location: dict, latest: list[dict]) -> dict:
    pm25_sensors = {
        sensor["id"]
        for sensor in location.get("sensors", [])
        if (sensor.get("parameter") or {}).get("name") == "pm25"
    }
    rows = [
        row
        for row in latest
        if row.get("sensorsId") in pm25_sensors
        and row.get("value") is not None
        and ((row.get("datetime") or {}).get("utc"))
    ]
    if not rows:
        return {"ok": True, "location_name": location.get("name"), "value": None}
    newest = max(rows, key=lambda row: row["datetime"]["utc"])
    return {
        "ok": True,
        "location_name": location.get("name"),
        "value": float(newest["value"]),
        "utc": newest["datetime"]["utc"],
        "local": newest["datetime"].get("local"),
        "timezone": location.get("timezone"),
    }


def reading_for_station(station_id: str) -> dict:
    location_id = OPENAQ_LOCATION.get(station_id)
    base = {
        "same_monitor": True,
        "source": OPENAQ_SOURCE,
        "openaq_location_id": location_id,
        "source_station": None,
        "pm25": None,
        "unit": PM25_UNIT,
        "timestamp_utc": None,
        "timestamp_local": None,
        "age_hours": None,
        "archive_unchanged": True,
        "forecast_unchanged": True,
    }
    if not OPENAQ_API_KEY:
        return {**base, "status": STATUS_DATA_UNAVAILABLE, "detail": _NO_KEY}
    if location_id is None:
        return {**base, "status": STATUS_DATA_UNAVAILABLE, "detail": _NOT_MAPPED}
    result = latest_pm25(location_id)
    if not result.get("ok"):
        return {**base, "status": STATUS_DATA_UNAVAILABLE, "detail": result.get("detail", _UNREADABLE)}
    if result.get("value") is None:
        return {
            **base,
            "source_station": result.get("location_name"),
            "status": STATUS_DATA_UNAVAILABLE,
            "detail": _NO_PM25,
        }
    stamp = datetime.fromisoformat(result["utc"].replace("Z", "+00:00"))
    age = (datetime.now(timezone.utc) - stamp).total_seconds() / 3600.0
    return {
        **base,
        "status": STATUS_OBSERVED,
        "source_station": result.get("location_name"),
        "pm25": result["value"],
        "timestamp_utc": result["utc"],
        "timestamp_local": result.get("local"),
        "age_hours": round(age, 1),
        "detail": _SAME_MONITOR,
    }
