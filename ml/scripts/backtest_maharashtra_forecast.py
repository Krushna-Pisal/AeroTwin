"""Backtest short-range PM2.5 forecasts on OpenAQ hourly data for Maharashtra.

Compares persistence with a diurnal-profile forecast and blends of the two.
Hourly values come from OpenAQ v3 sensor hours for a random sample of
Maharashtra PM2.5 locations. Nothing is written into the training table.

Usage (repo root):
    $env:PYTHONPATH = "backend"
    .venv\\Scripts\\python.exe ml\\scripts\\backtest_maharashtra_forecast.py
"""

from __future__ import annotations

import json
import math
import random
import statistics
import sys
import time
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from app.config import MAHARASHTRA_BACKTEST_JSON, OPENAQ_API_KEY, OPENAQ_API_URL  # noqa: E402
from app.services.maharashtra_service import diurnal_forecast, in_maharashtra  # noqa: E402

HORIZONS = [1, 3, 6, 12, 24, 48, 72, 120, 168]
SAMPLE = 16
HISTORY_DAYS = 40


def get(path: str) -> dict:
    request = urllib.request.Request(OPENAQ_API_URL + path, headers={"X-API-Key": OPENAQ_API_KEY})
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.load(response)


def load_series() -> dict[str, dict[datetime, float]]:
    locations = get("/locations?bbox=72.6,15.6,80.9,22.1&parameters_id=2&limit=1000")["results"]
    active = [
        loc
        for loc in locations
        if ((loc.get("datetimeLast") or {}).get("utc") or "") >= "2026-09-22"
        and in_maharashtra(loc["coordinates"]["longitude"], loc["coordinates"]["latitude"])
    ]
    random.seed(7)
    series: dict[str, dict[datetime, float]] = {}
    for loc in random.sample(active, min(SAMPLE, len(active))):
        sensors = [s for s in get(f"/locations/{loc['id']}/sensors")["results"] if s["parameter"]["name"] == "pm25"]
        best = max(sensors, key=lambda s: s["datetimeLast"]["utc"])
        end = best["datetimeLast"]["utc"]
        start = (datetime.fromisoformat(end.replace("Z", "+00:00")) - timedelta(days=HISTORY_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
        rows = get(f"/sensors/{best['id']}/hours?datetime_from={start}&datetime_to={end}&limit=1000")["results"]
        values = {}
        for row in rows:
            stamp = datetime.fromisoformat(row["period"]["datetimeFrom"]["utc"].replace("Z", "+00:00")).replace(minute=0)
            if row["value"] is not None and 0 <= row["value"] < 1000:
                values[stamp] = float(row["value"])
        series[loc["name"]] = values
        time.sleep(1.2)
    return series


def evaluate(series: dict[str, dict[datetime, float]]) -> dict[str, dict[int, float]]:
    methods = {
        "persistence": lambda hist, origin, h: diurnal_forecast(hist, origin, [h], blend_hours=None)[0],
        "diurnal": lambda hist, origin, h: diurnal_forecast(hist, origin, [h], blend_hours=0.0)[0],
        "blend_tau3": lambda hist, origin, h: diurnal_forecast(hist, origin, [h], blend_hours=3.0)[0],
        "blend_tau6": lambda hist, origin, h: diurnal_forecast(hist, origin, [h], blend_hours=6.0)[0],
        "blend_tau12": lambda hist, origin, h: diurnal_forecast(hist, origin, [h], blend_hours=12.0)[0],
        "blend_tau24": lambda hist, origin, h: diurnal_forecast(hist, origin, [h], blend_hours=24.0)[0],
    }
    errors = {name: {h: [] for h in HORIZONS} for name in methods}
    for values in series.values():
        stamps = sorted(values)
        if len(stamps) < 24 * 14:
            continue
        origins = [t for t in stamps if t >= stamps[0] + timedelta(days=8) and t.hour % 6 == 0]
        for origin in origins:
            history = {t: v for t, v in values.items() if t <= origin}
            for h in HORIZONS:
                target = values.get(origin + timedelta(hours=h))
                if target is None:
                    continue
                for name, method in methods.items():
                    guess = method(history, origin, h)
                    if guess is not None:
                        errors[name][h].append(abs(guess - target))
    return {name: {h: statistics.fmean(v) if v else math.nan for h, v in by_h.items()} for name, by_h in errors.items()}


def main() -> None:
    series = load_series()
    print("stations:", len(series), "hours each:", [len(v) for v in series.values()])
    table = evaluate(series)
    print("MAE (µg/m³) by horizon in hours")
    print("method".ljust(14) + "".join(f"{h:>8}" for h in HORIZONS))
    for name, row in table.items():
        print(name.ljust(14) + "".join(f"{row[h]:8.2f}" for h in HORIZONS))
    first = min(min(v) for v in series.values() if v)
    last = max(max(v) for v in series.values() if v)
    MAHARASHTRA_BACKTEST_JSON.write_text(
        json.dumps(
            {
                "source": "OpenAQ v3 sensor hours",
                "stations": sorted(series),
                "hours_from_utc": first.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "hours_to_utc": last.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "origins": "every 6 h after the first 8 days of each station",
                "metric": "MAE µg/m³",
                "mae": {
                    name: {str(h): None if math.isnan(v) else round(v, 2) for h, v in row.items()}
                    for name, row in table.items()
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print("wrote", MAHARASHTRA_BACKTEST_JSON)


if __name__ == "__main__":
    main()
