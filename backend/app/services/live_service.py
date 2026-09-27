"""Live PM2.5 from the public aqi.in Pune page.

The page is a different sensor network from the CPCB archive. A shared place
name is not treated as the same monitor. Nothing here is written into the
hourly table, and the persistence forecast is not changed.
"""

from __future__ import annotations

import re
import threading
import time
import urllib.request
from datetime import datetime, timezone

from app.config import AQIIN_PUNE_URL, LIVE_SOURCE, PM25_UNIT, STATUS_DATA_UNAVAILABLE, STATUS_OBSERVED

# Exact aqi.in location title -> CPCB station id. Place-name overlap only.
AQIN_NAME_TO_STATION = {
    "shivajinagar": "site_5409",
    "hadapsar": "site_5407",
    "pashan": "site_5996",
    "dhankawadi": "site_6012",
    "alandi": "site_5405",
}

_DIFFERENT_SENSOR = (
    "Neighborhood sensor on aqi.in with the same place name. "
    "It is not the CPCB CAAQMS monitor stored in the archive."
)
_NOT_LISTED = (
    "aqi.in does not list this CPCB monitor. "
    "The city figure on that page is not used as this station's reading."
)
_UNREADABLE = "The live page could not be read. No number was filled in."
_AQI_NOTE = "US AQI is an index, not a concentration and not the CPCB index."

_CACHE_SECONDS = 600
_FAILURE_CACHE_SECONDS = 45
_lock = threading.Lock()
_cache: dict = {"expires": 0.0, "snapshot": None}


def clear_cache() -> None:
    with _lock:
        _cache["expires"] = 0.0
        _cache["snapshot"] = None


def fetch_html(url: str = AQIIN_PUNE_URL) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "AeroTwin/0.1 (live reading)"})
    with urllib.request.urlopen(request, timeout=12) as response:
        return response.read().decode("utf-8", "replace")


def parse_dashboard(html: str) -> dict:
    head, _, _rest = html.partition('id="row-')
    updated = re.search(r"Last Updated:\s*<strong>([^<]+)</strong>", html)
    aqi = re.search(r">(\d+(?:\.\d+)?)<span[^>]*>AQI \(US\)", head)
    pm25 = re.search(r"PM2\.5[\s\S]{0,220}?font-bold\">([0-9]+(?:\.[0-9]+)?)", head)
    pm10 = re.search(r"pm10[\s\S]{0,220}?font-bold\">([0-9]+(?:\.[0-9]+)?)", head, re.IGNORECASE)
    city_pm25 = _number(pm25.group(1) if pm25 else None)
    city = {
        "name": "Pune",
        "pm25": city_pm25,
        "pm10": _number(pm10.group(1) if pm10 else None),
        "aqi_us": _number(aqi.group(1) if aqi else None),
        "unit": PM25_UNIT,
        "page_updated_local": None if updated is None else updated.group(1).strip(),
        "clock": "aqi.in local time",
        "source": LIVE_SOURCE,
        "source_url": AQIIN_PUNE_URL,
        "status": STATUS_OBSERVED if city_pm25 is not None else STATUS_DATA_UNAVAILABLE,
        "detail": "Citywide figure on the Pune page. Not a CPCB station reading.",
    }
    stations = []
    for chunk in re.split(r'id="row-\d+"', html)[1:]:
        link = re.search(
            r'href="(https://www\.aqi\.in/in/dashboard/india/maharashtra/pune/([^"]+))"[^>]*>([^<]+)',
            chunk,
        )
        if link is None:
            continue
        url, slug, name = link.group(1), link.group(2), link.group(3).strip()
        if slug in {"pm", "pm10", "co", "so2", "no2", "o3"}:
            continue
        numbers = [
            _number(item)
            for item in re.findall(r'<span class="font-bold text-center">([^<]*)</span>', chunk)
        ]
        stations.append(
            {
                "name": name,
                "slug": slug,
                "url": url,
                "aqi_us": numbers[0] if len(numbers) > 0 else None,
                "pm25": numbers[1] if len(numbers) > 1 else None,
                "pm10": numbers[2] if len(numbers) > 2 else None,
            }
        )
    return {
        "ok": True,
        "source": LIVE_SOURCE,
        "source_url": AQIIN_PUNE_URL,
        "retrieved_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "page_updated_local": city["page_updated_local"],
        "city": city,
        "stations": stations,
    }


def fetch_snapshot() -> dict:
    now = time.monotonic()
    with _lock:
        cached = _cache["snapshot"]
        if cached is not None and now < _cache["expires"]:
            return cached
    try:
        snapshot = parse_dashboard(fetch_html())
        ttl = _CACHE_SECONDS
    except Exception:
        snapshot = {
            "ok": False,
            "source": LIVE_SOURCE,
            "source_url": AQIIN_PUNE_URL,
            "retrieved_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "page_updated_local": None,
            "city": None,
            "stations": [],
            "detail": _UNREADABLE,
        }
        ttl = _FAILURE_CACHE_SECONDS
    with _lock:
        _cache["snapshot"] = snapshot
        _cache["expires"] = time.monotonic() + ttl
    return snapshot


def reading_for_station(station_id: str) -> dict:
    snapshot = fetch_snapshot()
    city = snapshot.get("city")
    base = {
        "same_monitor": False,
        "unit": PM25_UNIT,
        "source": LIVE_SOURCE,
        "source_url": AQIIN_PUNE_URL,
        "source_station": None,
        "pm25": None,
        "pm10": None,
        "aqi_us": None,
        "aqi_us_note": _AQI_NOTE,
        "page_updated_local": snapshot.get("page_updated_local"),
        "clock": "aqi.in local time",
        "retrieved_at": snapshot.get("retrieved_at"),
        "city": city,
        "archive_unchanged": True,
        "forecast_unchanged": True,
    }
    if not snapshot.get("ok"):
        return {
            **base,
            "status": STATUS_DATA_UNAVAILABLE,
            "detail": snapshot.get("detail") or _UNREADABLE,
        }
    match = None
    for row in snapshot["stations"]:
        mapped = AQIN_NAME_TO_STATION.get(row["name"].casefold())
        if mapped == station_id:
            match = row
            break
    if match is None or match["pm25"] is None:
        return {
            **base,
            "status": STATUS_DATA_UNAVAILABLE,
            "detail": _NOT_LISTED if match is None else "The matching aqi.in row has no PM2.5 concentration.",
        }
    return {
        **base,
        "status": STATUS_OBSERVED,
        "source_station": match["name"],
        "source_url": match["url"],
        "pm25": match["pm25"],
        "pm10": match["pm10"],
        "aqi_us": match["aqi_us"],
        "detail": _DIFFERENT_SENSOR,
    }


def _number(text: str | None) -> float | None:
    if text is None:
        return None
    cleaned = text.strip().replace(",", "")
    if cleaned in {"", "-", "—", "NA", "N/A", "--"}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None
