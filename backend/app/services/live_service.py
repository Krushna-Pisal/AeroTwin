"""Live air quality service combining WAQI with Open-Meteo coordinate fallback.

1. Tries WAQI for official monitoring stations.
2. If WAQI returns a distant station (outside Pune) or has no data, falls back to Open-Meteo
   high-resolution CAMS/atmospheric coordinates API so EVERY station gets live data.
"""

from __future__ import annotations

import json
import math
import threading
import time
import urllib.request
from datetime import datetime, timezone

from app.config import (
    LIVE_SOURCE,
    PM25_UNIT,
    STATUS_DATA_UNAVAILABLE,
    STATUS_OBSERVED,
    WAQI_TOKEN,
)
from app.stations import by_id

_CACHE_SECONDS = 300
_FAILURE_CACHE_SECONDS = 60
_lock = threading.Lock()
_cache: dict[str, dict] = {}


def clear_cache() -> None:
    with _lock:
        _cache.clear()


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def fetch_open_meteo(lat: float, lon: float) -> dict | None:
    url = (
        f"https://air-quality-api.open-meteo.com/v1/air-quality?"
        f"latitude={lat}&longitude={lon}&current=pm2_5,pm10,us_aqi"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "AeroTwin/0.1"})
    with urllib.request.urlopen(req, timeout=8) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    curr = data.get("current", {})
    return {
        "pm25": curr.get("pm2_5"),
        "pm10": curr.get("pm10"),
        "aqi_us": curr.get("us_aqi"),
        "time": curr.get("time"),
    }


def reading_for_station(station_id: str) -> dict:
    station = by_id(station_id)
    if not station or not station.get("latitude") or not station.get("longitude"):
        return _unavailable("No coordinates found for this station in the registry.")

    now = time.monotonic()
    with _lock:
        if station_id in _cache:
            entry = _cache[station_id]
            if now < entry["expires"]:
                return entry["data"]

    lat = station["latitude"]
    lng = station["longitude"]
    result = None

    # Step 1: Try WAQI if token is provided
    if WAQI_TOKEN and WAQI_TOKEN != "your_waqi_token_here":
        try:
            url = f"https://api.waqi.info/feed/geo:{lat};{lng}/?token={WAQI_TOKEN}"
            req = urllib.request.Request(url, headers={"User-Agent": "AeroTwin/0.1"})
            with urllib.request.urlopen(req, timeout=8) as response:
                payload = json.loads(response.read().decode("utf-8"))

            if payload.get("status") == "ok":
                wdata = payload["data"]
                geo = wdata.get("city", {}).get("geo", [])
                
                # Check if station is reasonably close to Pune (within 45km)
                is_local = True
                if len(geo) == 2:
                    dist = haversine_km(lat, lng, float(geo[0]), float(geo[1]))
                    if dist > 45.0:
                        is_local = False

                pm25 = wdata.get("iaqi", {}).get("pm25", {}).get("v")
                if is_local and pm25 is not None:
                    result = {
                        "same_monitor": False,
                        "unit": PM25_UNIT,
                        "source": "WAQI (CPCB Ground Station)",
                        "source_url": wdata.get("city", {}).get("url") or "https://aqicn.org",
                        "source_station": wdata.get("city", {}).get("name"),
                        "pm25": float(pm25),
                        "pm10": wdata.get("iaqi", {}).get("pm10", {}).get("v"),
                        "aqi_us": wdata.get("aqi"),
                        "aqi_us_note": "US AQI standard",
                        "page_updated_local": wdata.get("time", {}).get("iso"),
                        "clock": "WAQI feed time",
                        "retrieved_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                        "city": None,
                        "archive_unchanged": True,
                        "forecast_unchanged": True,
                        "status": STATUS_OBSERVED,
                        "detail": f"Live ground monitor via WAQI ({wdata.get('city', {}).get('name')}).",
                    }
        except Exception:
            pass

    # Step 2: Fallback to Open-Meteo High Resolution Grid
    if result is None:
        try:
            om = fetch_open_meteo(lat, lng)
            if om and om.get("pm25") is not None:
                result = {
                    "same_monitor": False,
                    "unit": PM25_UNIT,
                    "source": "Open-Meteo (CAMS / Satellite / Model)",
                    "source_url": "https://open-meteo.com/en/docs/air-quality-api",
                    "source_station": f"{station['station_name']} (Grid Coordinates)",
                    "pm25": float(om["pm25"]),
                    "pm10": om.get("pm10"),
                    "aqi_us": om.get("aqi_us"),
                    "aqi_us_note": "US AQI standard",
                    "page_updated_local": om.get("time"),
                    "clock": "UTC / Local grid time",
                    "retrieved_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                    "city": None,
                    "archive_unchanged": True,
                    "forecast_unchanged": True,
                    "status": STATUS_OBSERVED,
                    "detail": "Accurate live coordinate reading via Open-Meteo atmospheric model.",
                }
        except Exception as e:
            result = _unavailable(f"Failed to fetch live readings: {e}")

    if result is None:
        result = _unavailable("Unable to obtain reading from live sources.")

    ttl = _CACHE_SECONDS if result.get("status") == STATUS_OBSERVED else _FAILURE_CACHE_SECONDS
    with _lock:
        _cache[station_id] = {"data": result, "expires": time.monotonic() + ttl}

    return result


def _unavailable(detail: str) -> dict:
    return {
        "status": STATUS_DATA_UNAVAILABLE,
        "detail": detail,
        "source": LIVE_SOURCE,
        "archive_unchanged": True,
        "forecast_unchanged": True,
        "unit": PM25_UNIT,
        "pm25": None,
        "pm10": None,
        "aqi_us": None,
        "page_updated_local": None,
        "clock": None,
        "retrieved_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source_station": None,
        "source_url": None,
    }


def fetch_snapshot() -> dict:
    reading = reading_for_station("site_5409")  # Shivajinagar as Pune reference
    return {
        "ok": reading.get("status") == STATUS_OBSERVED,
        "source": LIVE_SOURCE,
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
            "source": LIVE_SOURCE,
            "source_url": reading.get("source_url"),
            "status": reading.get("status"),
            "detail": reading.get("detail"),
        },
        "stations": [],
    }

