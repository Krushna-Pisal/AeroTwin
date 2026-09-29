"""Statewide PM2.5 for Maharashtra from OpenAQ v3.

Station values are OpenAQ republishes of CPCB, MPCB, AirNow and AirGradient
monitors. A value is OBSERVED only when the monitor reported it within
``OBSERVED_MAX_AGE_HOURS``. Anything else shown for "now" or for a future hour
is MODELED from that station's own recent hours, or from nearby stations for a
point without a monitor. Nothing here is written into the Pune training table.
"""

from __future__ import annotations

import json
import math
import statistics
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.config import (
    MAHARASHTRA_BACKTEST_JSON,
    MAHARASHTRA_BOUNDARY_GEOJSON,
    MAHARASHTRA_CACHE_JSON,
    OPENAQ_API_KEY,
    OPENAQ_API_URL,
    PM25_UNIT,
    STATUS_DATA_UNAVAILABLE,
    STATUS_MODELED,
    STATUS_OBSERVED,
)

SOURCE = "OpenAQ v3 (CPCB, MPCB, AirNow and AirGradient monitors)"
BBOX = "72.6,15.6,80.9,22.1"
OBSERVED_MAX_AGE_HOURS = 3.0
# A monitor silent for longer than this is shown with its last value only.
MODEL_MAX_AGE_HOURS = 14 * 24.0
LISTING_MAX_AGE_DAYS = 90
HISTORY_DAYS = 14
PROFILE_DAYS = 7
PROFILE_MIN_HOURS = 72
PROFILE_MIN_PER_HOUR = 3
FORECAST_HOURS = 168
# Chosen by ml/scripts/backtest_maharashtra_forecast.py. None means persistence.
BLEND_HOURS: float | None = 6.0
IDW_NEIGHBOURS = 4
IDW_MAX_KM = 150.0

REQUEST_SPACING_S = 1.2
REFRESH_EVERY_S = 30 * 60
LISTING_EVERY_S = 6 * 3600

_lock = threading.Lock()
_request_lock = threading.Lock()
_last_request = 0.0
_state: dict = {"listing_at": None, "locations": [], "readings": {}, "cycle_started": None, "cycle_done": None}
_refresher: threading.Thread | None = None
_rings: list[list[tuple[float, float]]] | None = None


# ── Geometry ────────────────────────────────────────────────────────────


def _boundary_rings() -> list[list[tuple[float, float]]]:
    global _rings
    if _rings is None:
        data = json.loads(Path(MAHARASHTRA_BOUNDARY_GEOJSON).read_text(encoding="utf-8"))
        rings = []
        for feature in data["features"]:
            geometry = feature["geometry"]
            polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
            for polygon in polygons:
                rings.append([(float(x), float(y)) for x, y in polygon[0]])
        _rings = rings
    return _rings


def _ring_contains(x: float, y: float, ring: list[tuple[float, float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i, (xi, yi) in enumerate(ring):
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def in_maharashtra(longitude: float, latitude: float) -> bool:
    return any(_ring_contains(longitude, latitude, ring) for ring in _boundary_rings())


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(a))


# ── Forecast ────────────────────────────────────────────────────────────


def diurnal_forecast(
    history: dict[datetime, float],
    origin: datetime,
    horizons: list[int],
    blend_hours: float | None = BLEND_HOURS,
    profile_days: int = PROFILE_DAYS,
) -> list[float | None]:
    """PM2.5 at origin + h for each h. Uses only hours at or before origin.

    ``blend_hours`` None is persistence. Zero is the diurnal profile alone.
    Otherwise the last hour decays into the profile with that e-folding time.
    """
    past = [t for t in history if t <= origin]
    if not past:
        return [None for _ in horizons]
    last_time = max(past)
    last = history[last_time]
    if blend_hours is None:
        return [last for _ in horizons]
    window_start = last_time - timedelta(days=profile_days)
    window = [t for t in past if t > window_start]
    if len(window) < PROFILE_MIN_HOURS:
        window = past
    buckets: dict[int, list[float]] = {}
    for t in window:
        buckets.setdefault(t.hour, []).append(history[t])
    # Medians over at least 3 days, so one sensor spike does not repeat into every future day.
    overall = statistics.median([history[t] for t in window])
    profile = {
        hour: statistics.median(values) for hour, values in buckets.items() if len(values) >= PROFILE_MIN_PER_HOUR
    }
    out: list[float | None] = []
    for h in horizons:
        step = h + (origin - last_time).total_seconds() / 3600.0
        typical = profile.get((last_time + timedelta(hours=step)).hour, overall)
        weight = 0.0 if blend_hours == 0 else math.exp(-step / blend_hours)
        out.append(weight * last + (1.0 - weight) * typical)
    return out


def _backtest() -> dict:
    path = Path(MAHARASHTRA_BACKTEST_JSON)
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def typical_error(horizon_hours: float) -> float | None:
    """Backtest MAE of the serving method at the nearest scored horizon."""
    table = (_backtest().get("mae") or {}).get(_method_name()) or {}
    if not table:
        return None
    nearest = min(table, key=lambda h: abs(int(h) - horizon_hours))
    value = table[nearest]
    return None if value is None else round(float(value), 1)


def _method_name() -> str:
    return "persistence" if BLEND_HOURS is None else f"blend_tau{int(BLEND_HOURS)}"


# ── OpenAQ access ───────────────────────────────────────────────────────


def _fetch(path: str) -> dict:
    global _last_request
    with _request_lock:
        wait = _last_request + REQUEST_SPACING_S - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        request = urllib.request.Request(
            OPENAQ_API_URL + path,
            headers={"X-API-Key": OPENAQ_API_KEY, "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                time.sleep(60)
            raise
        finally:
            _last_request = time.monotonic()


def _parse_utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _listing() -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=LISTING_MAX_AGE_DAYS)
    rows = _fetch(f"/locations?bbox={BBOX}&parameters_id=2&limit=1000")["results"]
    out = []
    for row in rows:
        coords = row.get("coordinates") or {}
        last = (row.get("datetimeLast") or {}).get("utc")
        lon, lat = coords.get("longitude"), coords.get("latitude")
        if lon is None or lat is None or not last or _parse_utc(last) < cutoff:
            continue
        if not in_maharashtra(lon, lat):
            continue
        out.append(
            {
                "location_id": row["id"],
                "name": row.get("name") or f"OpenAQ {row['id']}",
                "locality": row.get("locality"),
                "provider": (row.get("provider") or {}).get("name"),
                "owner": (row.get("owner") or {}).get("name"),
                "longitude": float(lon),
                "latitude": float(lat),
            }
        )
    return out


def _reading(location_id: int) -> dict:
    sensors = [
        s
        for s in _fetch(f"/locations/{location_id}/sensors")["results"]
        if (s.get("parameter") or {}).get("name") == "pm25" and (s.get("datetimeLast") or {}).get("utc")
    ]
    if not sensors:
        return {"sensor_id": None, "latest": None, "history": {}}
    best = max(sensors, key=lambda s: s["datetimeLast"]["utc"])
    latest = best.get("latest") or {}
    value = latest.get("value")
    stamp = (latest.get("datetime") or {}).get("utc")
    reading = {
        "sensor_id": best["id"],
        "latest": {"value": float(value), "utc": stamp} if value is not None and stamp and 0 <= value < 1000 else None,
        "history": {},
    }
    end = _parse_utc(best["datetimeLast"]["utc"])
    start = end - timedelta(days=HISTORY_DAYS)
    rows = _fetch(
        f"/sensors/{best['id']}/hours?datetime_from={start:%Y-%m-%dT%H:%M:%SZ}"
        f"&datetime_to={end + timedelta(hours=1):%Y-%m-%dT%H:%M:%SZ}&limit=1000"
    )["results"]
    for row in rows:
        v = row.get("value")
        t = ((row.get("period") or {}).get("datetimeFrom") or {}).get("utc")
        if v is not None and t and 0 <= v < 1000:
            reading["history"][_parse_utc(t).replace(minute=0, second=0).strftime("%Y-%m-%dT%H:%M:%SZ")] = float(v)
    return reading


def _save_cache() -> None:
    path = Path(MAHARASHTRA_CACHE_JSON)
    path.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        payload = json.dumps(_state)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(payload, encoding="utf-8")
    tmp.replace(path)


def load_cache() -> None:
    path = Path(MAHARASHTRA_CACHE_JSON)
    if not path.is_file():
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    with _lock:
        _state.update(data)
        _state["readings"] = {int(k): v for k, v in data.get("readings", {}).items()}


def _refresh_once() -> None:
    listing_at = _state.get("listing_at")
    stale_listing = not listing_at or time.time() - listing_at > LISTING_EVERY_S
    if stale_listing or not _state["locations"]:
        locations = _listing()
        with _lock:
            _state["locations"] = locations
            _state["listing_at"] = time.time()
    with _lock:
        _state["cycle_started"] = time.time()
        fresh_after = time.time() - REFRESH_EVERY_S
        ids = [
            loc["location_id"]
            for loc in _state["locations"]
            if (_state["readings"].get(loc["location_id"]) or {}).get("fetched_at", 0) < fresh_after
        ]
    for count, location_id in enumerate(ids, start=1):
        try:
            reading = _reading(location_id)
        except Exception:
            continue
        reading["fetched_at"] = time.time()
        with _lock:
            _state["readings"][location_id] = reading
        if count % 10 == 0:
            _save_cache()
    with _lock:
        _state["cycle_done"] = time.time()
    _save_cache()


def _refresh_loop() -> None:
    while True:
        started = time.time()
        try:
            _refresh_once()
        except Exception:
            pass
        time.sleep(max(60.0, REFRESH_EVERY_S - (time.time() - started)))


def start_refresher() -> None:
    """Load the disk cache and keep refreshing in one daemon thread."""
    global _refresher
    load_cache()
    if not OPENAQ_API_KEY or _refresher is not None:
        return
    _refresher = threading.Thread(target=_refresh_loop, name="openaq-maharashtra", daemon=True)
    _refresher.start()


# ── Station view ────────────────────────────────────────────────────────


def _history(reading: dict) -> dict[datetime, float]:
    return {_parse_utc(k): v for k, v in (reading.get("history") or {}).items()}


def _station_now(location: dict, reading: dict | None, now: datetime) -> dict:
    base = {
        **location,
        "unit": PM25_UNIT,
        "last_pm25": None,
        "last_utc": None,
        "age_hours": None,
        "now_pm25": None,
        "now_status": STATUS_DATA_UNAVAILABLE,
        "now_basis": "Not read from OpenAQ yet." if reading is None else "OpenAQ returned no PM2.5 value.",
    }
    if reading is None:
        return base
    latest = reading.get("latest")
    history = _history(reading)
    if latest is None and history:
        last_time = max(history)
        latest = {"value": history[last_time], "utc": last_time.strftime("%Y-%m-%dT%H:%M:%SZ")}
    if latest is None:
        return base
    age = (now - _parse_utc(latest["utc"])).total_seconds() / 3600.0
    base.update(last_pm25=round(latest["value"], 1), last_utc=latest["utc"], age_hours=round(age, 1))
    if age <= OBSERVED_MAX_AGE_HOURS:
        base.update(
            now_pm25=round(latest["value"], 1),
            now_status=STATUS_OBSERVED,
            now_basis="Monitor reported within the last 3 hours.",
        )
        return base
    if age > MODEL_MAX_AGE_HOURS or not history:
        base["now_basis"] = "Monitor silent for too long to model the current hour."
        return base
    estimate = diurnal_forecast(history, now, [0])[0]
    if estimate is None:
        return base
    base.update(
        now_pm25=round(estimate, 1),
        now_status=STATUS_MODELED,
        now_basis=(
            f"Monitor last reported {age:.0f} h ago. Current hour estimated from "
            f"its own last {PROFILE_DAYS} days of hourly values."
        ),
    )
    return base


def _snapshot() -> tuple[list[dict], dict[int, dict], dict]:
    with _lock:
        locations = list(_state["locations"])
        readings = dict(_state["readings"])
        meta = {k: _state.get(k) for k in ("listing_at", "cycle_started", "cycle_done")}
    return locations, readings, meta


def _iso(epoch: float | None) -> str | None:
    if epoch is None:
        return None
    return datetime.fromtimestamp(epoch, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def stations_payload() -> dict:
    now = datetime.now(timezone.utc)
    locations, readings, meta = _snapshot()
    features = []
    counts = {STATUS_OBSERVED: 0, STATUS_MODELED: 0, STATUS_DATA_UNAVAILABLE: 0}
    for location in locations:
        props = _station_now(location, readings.get(location["location_id"]), now)
        counts[props["now_status"]] += 1
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [location["longitude"], location["latitude"]]},
                "properties": props,
            }
        )
    return {
        "source": SOURCE,
        "generated_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "api_key_set": bool(OPENAQ_API_KEY),
        "listing_utc": _iso(meta["listing_at"]),
        "last_refresh_utc": _iso(meta["cycle_done"]),
        "stations_read": sum(1 for loc in locations if loc["location_id"] in readings),
        "stations_listed": len(locations),
        "counts": counts,
        "observed_max_age_hours": OBSERVED_MAX_AGE_HOURS,
        "type": "FeatureCollection",
        "features": features,
    }


def _series(history: dict[datetime, float], now: datetime) -> list[float | None]:
    return diurnal_forecast(history, now, list(range(FORECAST_HOURS + 1)))


def _forecast_block(
    series: list[float | None], now: datetime, age_hours: float | None, status_now: str
) -> list[dict]:
    """``age_hours`` None leaves typical_error empty. The backtest scored stations, not interpolation."""
    hour0 = now.replace(minute=0, second=0, microsecond=0)
    out = []
    for h, value in enumerate(series):
        status = status_now if h == 0 else STATUS_MODELED
        scored = value is not None and age_hours is not None and not (h == 0 and status_now == STATUS_OBSERVED)
        out.append(
            {
                "hours_ahead": h,
                "valid_utc": (hour0 + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "pm25": None if value is None else round(value, 1),
                "status": status if value is not None else STATUS_DATA_UNAVAILABLE,
                "typical_error": typical_error(age_hours + h) if scored else None,
            }
        )
    return out


def _method_note() -> str:
    if BLEND_HOURS is None:
        return "Persistence: the last reported hour is carried forward."
    return (
        f"Last reported hour decays into the station's {PROFILE_DAYS}-day hour-of-day profile "
        f"(e-folding {BLEND_HOURS:g} h). Backtested against persistence on OpenAQ hourly data."
    )


def station_detail(location_id: int) -> dict | None:
    now = datetime.now(timezone.utc)
    locations, readings, _ = _snapshot()
    location = next((loc for loc in locations if loc["location_id"] == location_id), None)
    if location is None:
        return None
    reading = readings.get(location_id)
    props = _station_now(location, reading, now)
    history = _history(reading) if reading else {}
    recent = sorted(history.items())[-48:]
    series: list[float | None] = [None] * (FORECAST_HOURS + 1)
    if props["now_status"] != STATUS_DATA_UNAVAILABLE and history:
        series = _series(history, now)
        if props["now_status"] == STATUS_OBSERVED:
            series[0] = props["now_pm25"]
    forecast = _forecast_block(series, now, props["age_hours"] or 0.0, props["now_status"])
    if props["now_status"] == STATUS_OBSERVED:
        forecast[0]["valid_utc"] = props["last_utc"]
    return {
        "source": SOURCE,
        "kind": "station",
        "generated_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "station": props,
        "recent_hours": [
            {"utc": t.strftime("%Y-%m-%dT%H:%M:%SZ"), "pm25": round(v, 1), "status": STATUS_OBSERVED} for t, v in recent
        ],
        "forecast_method": _method_name(),
        "forecast_note": _method_note(),
        "forecast": forecast,
    }


def _confidence(nearest_km: float) -> str:
    if nearest_km < 10:
        return "HIGH"
    if nearest_km < 30:
        return "MEDIUM"
    return "LOW"


def point_estimate(latitude: float, longitude: float) -> dict:
    now = datetime.now(timezone.utc)
    locations, readings, _ = _snapshot()
    base = {
        "source": SOURCE,
        "kind": "point",
        "generated_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "latitude": latitude,
        "longitude": longitude,
        "unit": PM25_UNIT,
        "inside_maharashtra": in_maharashtra(longitude, latitude),
        "now_pm25": None,
        "now_status": STATUS_DATA_UNAVAILABLE,
        "confidence": None,
        "nearest_km": None,
        "neighbours": [],
        "forecast_method": _method_name(),
        "forecast_note": (
            "Inverse-distance blend of the nearest monitors' own forecasts. No error band is shown: "
            "the backtest scored monitors, and interpolating between them adds error it did not measure."
        ),
        "forecast": [],
    }
    if not base["inside_maharashtra"]:
        base["detail"] = "Point is outside the Maharashtra boundary."
        return base
    candidates = []
    for location in locations:
        reading = readings.get(location["location_id"])
        props = _station_now(location, reading, now)
        if props["now_pm25"] is None:
            continue
        distance = haversine_km(longitude, latitude, location["longitude"], location["latitude"])
        if distance <= IDW_MAX_KM:
            candidates.append((distance, props, _history(reading)))
    candidates.sort(key=lambda item: item[0])
    chosen = candidates[:IDW_NEIGHBOURS]
    if not chosen:
        base["detail"] = f"No monitor with a usable value within {IDW_MAX_KM:.0f} km."
        return base
    weights = [1.0 / max(d, 0.5) ** 2 for d, _, _ in chosen]
    total = sum(weights)
    series_list = []
    for (_, props, history), w in zip(chosen, weights):
        series = _series(history, now)
        if props["now_status"] == STATUS_OBSERVED:
            series[0] = props["now_pm25"]
        series_list.append(series)
    blended: list[float | None] = []
    for h in range(FORECAST_HOURS + 1):
        pairs = [(s[h], w) for s, w in zip(series_list, weights) if s[h] is not None]
        wsum = sum(w for _, w in pairs)
        blended.append(sum(v * w for v, w in pairs) / wsum if wsum else None)
    now_value = sum(p["now_pm25"] * w for (_, p, _), w in zip(chosen, weights)) / total
    nearest = chosen[0][0]
    base.update(
        now_pm25=round(now_value, 1),
        now_status=STATUS_MODELED,
        confidence=_confidence(nearest),
        nearest_km=round(nearest, 1),
        neighbours=[
            {
                "location_id": p["location_id"],
                "name": p["name"],
                "distance_km": round(d, 1),
                "now_pm25": p["now_pm25"],
                "now_status": p["now_status"],
                "age_hours": p["age_hours"],
                "weight": round(w / total, 3),
            }
            for (d, p, _), w in zip(chosen, weights)
        ],
        detail=(
            "No monitor at this point. Inverse-distance estimate from the nearest "
            f"{len(chosen)} monitors. Not a measurement."
        ),
        forecast=_forecast_block(blended, now, None, STATUS_MODELED),
    )
    return base
