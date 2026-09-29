"""Current PM2.5 near a station: WAQI ground monitor first, Open-Meteo model second.

1. WAQI's nearest monitor is used only when it is within ``WAQI_MAX_KM`` of the
   station and reported within ``WAQI_MAX_AGE_HOURS``. WAQI publishes PM2.5 as a
   US AQI sub-index, so it is converted back to µg/m³ before it is shown.
2. Otherwise Open-Meteo's CAMS grid value is returned. That is a model cell, so
   it is labelled MODELED, never OBSERVED.

Nothing here is written into the hourly table, and the persistence forecast is
not changed.
"""

from __future__ import annotations

import json
import math
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from app.config import (
    LIVE_SOURCE,
    OPEN_METEO_AQ_URL,
    PM25_UNIT,
    STATUS_DATA_UNAVAILABLE,
    STATUS_MODELED,
    STATUS_OBSERVED,
    WAQI_API_URL,
    WAQI_TOKEN,
)
from app.stations import by_id

WAQI_MAX_KM = 45.0
WAQI_MAX_AGE_HOURS = 6.0
_CACHE_SECONDS = 300
_FAILURE_CACHE_SECONDS = 60
_lock = threading.Lock()
_cache: dict[str, dict] = {}

# US EPA PM2.5 breakpoints used by WAQI: (AQI low, AQI high, µg/m³ low, µg/m³ high).
_AQI_BREAKPOINTS = (
    (0, 50, 0.0, 12.0),
    (51, 100, 12.1, 35.4),
    (101, 150, 35.5, 55.4),
    (151, 200, 55.5, 150.4),
    (201, 300, 150.5, 250.4),
    (301, 400, 250.5, 350.4),
    (401, 500, 350.5, 500.4),
)


def clear_cache() -> None:
    with _lock:
        _cache.clear()


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return 2 * 6371.0 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def aqi_to_pm25(aqi: float) -> float | None:
    """Invert the US AQI PM2.5 sub-index. None outside 0–500."""
    for i_lo, i_hi, c_lo, c_hi in _AQI_BREAKPOINTS:
        if i_lo <= aqi <= i_hi or (i_lo - 1 < aqi < i_lo):
            return round((aqi - i_lo) * (c_hi - c_lo) / (i_hi - i_lo) + c_lo, 1)
    return None


def _get_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "AeroTwin/0.1"})
    with urllib.request.urlopen(request, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_waqi(lat: float, lng: float) -> dict | None:
    """Raw WAQI feed for the monitor WAQI considers nearest to the point."""
    if not WAQI_TOKEN:
        return None
    payload = _get_json(f"{WAQI_API_URL}/feed/geo:{lat};{lng}/?token={urllib.parse.quote(WAQI_TOKEN)}")
    return payload.get("data") if payload.get("status") == "ok" else None


def fetch_open_meteo(lat: float, lng: float) -> dict | None:
    query = urllib.parse.urlencode(
        {"latitude": lat, "longitude": lng, "current": "pm2_5,pm10,us_aqi", "timezone": "GMT"}
    )
    current = _get_json(f"{OPEN_METEO_AQ_URL}?{query}").get("current") or {}
    return {
        "pm25": current.get("pm2_5"),
        "pm10": current.get("pm10"),
        "aqi_us": current.get("us_aqi"),
        "time": current.get("time"),
    }


def _base() -> dict:
    return {
        "same_monitor": False,
        "unit": PM25_UNIT,
        "archive_unchanged": True,
        "forecast_unchanged": True,
        "retrieved_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "city": None,
    }


def _from_waqi(station: dict, data: dict | None) -> tuple[dict | None, str]:
    """A reading when WAQI has a nearby, recent PM2.5 value, else the reason it was skipped."""
    if data is None:
        return None, "WAQI returned no feed."
    city = data.get("city") or {}
    geo = city.get("geo") or []
    if len(geo) != 2:
        return None, "WAQI feed has no monitor coordinate."
    distance = haversine_km(station["latitude"], station["longitude"], float(geo[0]), float(geo[1]))
    if distance > WAQI_MAX_KM:
        return None, f"WAQI's nearest monitor ({city.get('name')}) is {distance:.0f} km away."
    epoch = (data.get("time") or {}).get("v")
    if not isinstance(epoch, (int, float)):
        return None, "WAQI feed has no timestamp."
    # WAQI's "v" is local wall-clock seconds; subtract the published offset to get UTC.
    tz = (data.get("time") or {}).get("tz") or "+00:00"
    sign = -1 if tz.startswith("-") else 1
    hours, _, minutes = tz.lstrip("+-").partition(":")
    utc_epoch = epoch - sign * (int(hours or 0) * 3600 + int(minutes or 0) * 60)
    age = (time.time() - utc_epoch) / 3600.0
    if age > WAQI_MAX_AGE_HOURS:
        return None, f"WAQI's nearest monitor last reported {age:.0f} h ago."
    aqi = ((data.get("iaqi") or {}).get("pm25") or {}).get("v")
    pm25 = aqi_to_pm25(float(aqi)) if isinstance(aqi, (int, float)) else None
    if pm25 is None:
        return None, "WAQI feed has no PM2.5 value."
    return {
        **_base(),
        "source": "WAQI ground monitor",
        "source_url": city.get("url") or "https://aqicn.org",
        "source_station": city.get("name"),
        "distance_km": round(distance, 1),
        "age_hours": round(age, 1),
        "pm25": pm25,
        "pm25_aqi_us": aqi,
        "pm10": ((data.get("iaqi") or {}).get("pm10") or {}).get("v"),
        "aqi_us": data.get("aqi"),
        "page_updated_local": (data.get("time") or {}).get("iso"),
        "clock": "WAQI feed time",
        "status": STATUS_OBSERVED,
        "detail": (
            f"Ground monitor {distance:.1f} km away via WAQI. WAQI publishes US AQI {aqi}; "
            f"converted to {pm25} µg/m³ with the US EPA breakpoints."
        ),
    }, ""


def _from_open_meteo(station: dict, om: dict | None, reason: str) -> dict | None:
    if not om or om.get("pm25") is None:
        return None
    return {
        **_base(),
        "source": "Open-Meteo (CAMS model)",
        "source_url": "https://open-meteo.com/en/docs/air-quality-api",
        "source_station": f"Model grid cell at {station['station_name']}",
        "distance_km": None,
        "age_hours": None,
        "pm25": float(om["pm25"]),
        "pm25_aqi_us": None,
        "pm10": om.get("pm10"),
        "aqi_us": om.get("aqi_us"),
        "page_updated_local": om.get("time"),
        "clock": "UTC model hour",
        "status": STATUS_MODELED,
        "detail": (
            f"{reason} Showing the Open-Meteo CAMS model value for this grid cell. "
            "A model estimate, not a monitor reading."
        ).strip(),
    }


def reading_for_station(station_id: str) -> dict:
    station = by_id(station_id)
    if not station or station.get("latitude") is None or station.get("longitude") is None:
        return _unavailable("No coordinates found for this station in the registry.")

    with _lock:
        entry = _cache.get(station_id)
        if entry and time.monotonic() < entry["expires"]:
            return entry["data"]

    lat, lng = station["latitude"], station["longitude"]
    try:
        result, reason = _from_waqi(station, fetch_waqi(lat, lng))
    except Exception as exc:
        result, reason = None, f"WAQI could not be read ({exc.__class__.__name__})."
    if not WAQI_TOKEN:
        reason = "WAQI_TOKEN is not set."
    if result is None:
        try:
            result = _from_open_meteo(station, fetch_open_meteo(lat, lng), reason)
        except Exception:
            result = None
    if result is None:
        result = _unavailable(f"{reason} Open-Meteo could not be read either. No number was filled in.".strip())

    ttl = _CACHE_SECONDS if result["status"] != STATUS_DATA_UNAVAILABLE else _FAILURE_CACHE_SECONDS
    with _lock:
        _cache[station_id] = {"data": result, "expires": time.monotonic() + ttl}
    return result


def _unavailable(detail: str) -> dict:
    return {
        **_base(),
        "status": STATUS_DATA_UNAVAILABLE,
        "detail": detail,
        "source": LIVE_SOURCE,
        "pm25": None,
        "pm25_aqi_us": None,
        "pm10": None,
        "aqi_us": None,
        "distance_km": None,
        "age_hours": None,
        "page_updated_local": None,
        "clock": None,
        "source_station": None,
        "source_url": None,
    }


def fetch_snapshot() -> dict:
    reading = reading_for_station("site_5409")  # Shivajinagar as Pune reference
    return {
        "ok": reading.get("status") != STATUS_DATA_UNAVAILABLE,
        "source": reading.get("source"),
        "source_url": reading.get("source_url"),
        "retrieved_at": reading.get("retrieved_at"),
        "page_updated_local": reading.get("page_updated_local"),
        "city": {
            "name": "Pune",
            "pm25": reading.get("pm25"),
            "pm10": reading.get("pm10"),
            "aqi_us": reading.get("aqi_us"),
            "unit": PM25_UNIT,
            "page_updated_local": reading.get("page_updated_local"),
            "clock": reading.get("clock"),
            "source": reading.get("source"),
            "source_url": reading.get("source_url"),
            "status": reading.get("status"),
            "detail": reading.get("detail"),
        },
        "stations": [],
    }
