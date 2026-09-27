"""Write MapLibre GeoJSON from the processed hourly table and the station registry."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.data_store import CLOCK, MAP_DIR, SOURCE, STATIONS_GEOJSON, hourly, iso, number  # noqa: E402
from app.services.forecast_service import forecast_all  # noqa: E402
from app.services.hotspot_service import hotspot_geojson  # noqa: E402
from app.services.observation_service import stations_geojson  # noqa: E402
from app.stations import by_id  # noqa: E402


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(path, "features", len(payload.get("features", [])))


def _point(station_id: str, properties: dict) -> dict | None:
    station = by_id(station_id)
    if station is None or station["latitude"] is None or station["longitude"] is None:
        return None
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [station["longitude"], station["latitude"]]},
        "properties": properties,
    }


def current_layer() -> dict:
    frame = hourly()
    latest = frame.loc[frame["pm25"].notna()].sort_values("timestamp").groupby("station_id", as_index=False).tail(1)
    features = []
    for _, row in latest.iterrows():
        feature = _point(
            str(row["station_id"]),
            {
                "station_id": str(row["station_id"]),
                "station_name": str(row["station_name"]),
                "pm25": number(row["pm25"]),
                "timestamp": iso(row["timestamp"]),
                "source": SOURCE,
                "status": "OBSERVED",
                "clock": CLOCK,
                "layer": "current_pm25",
            },
        )
        if feature:
            features.append(feature)
    return {"type": "FeatureCollection", "name": "current_pm25", "clock": CLOCK, "source": SOURCE, "status": "OBSERVED", "features": features}


def history_layer() -> dict:
    """Hourly observations for the last 14 days of the series. Full history is the API."""
    frame = hourly()
    end = frame.loc[frame["pm25"].notna(), "timestamp"].max()
    start = end - pd.Timedelta(days=14)
    window = frame.loc[(frame["timestamp"] >= start) & (frame["timestamp"] <= end) & frame["pm25"].notna()]
    features = []
    for _, row in window.iterrows():
        feature = _point(
            str(row["station_id"]),
            {
                "station_id": str(row["station_id"]),
                "station_name": str(row["station_name"]),
                "pm25": number(row["pm25"]),
                "timestamp": iso(row["timestamp"]),
                "source": SOURCE,
                "status": "OBSERVED",
                "clock": CLOCK,
                "layer": "historical_pm25",
                "window": "last_14_days_of_series",
            },
        )
        if feature:
            features.append(feature)
    return {
        "type": "FeatureCollection",
        "name": "historical_pm25",
        "clock": CLOCK,
        "source": SOURCE,
        "status": "OBSERVED",
        "window_start": iso(start),
        "window_end": iso(end),
        "note": "Last 14 days of the hourly series. Earlier hours are served by GET /api/observations/history.",
        "features": features,
    }


def forecast_layer() -> dict:
    features = []
    for item in forecast_all():
        feature = _point(
            item["station_id"],
            {
                "station_id": item["station_id"],
                "station_name": item["station_name"],
                "pm25": item["forecast_pm25_24h"],
                "observed_pm25": item["current_pm25"],
                "timestamp": item["timestamp"],
                "forecast_timestamp": item["forecast_timestamp"],
                "method": "persistence",
                "source": SOURCE,
                "status": "MODELED",
                "forecast_status": "observed_baseline",
                "clock": CLOCK,
                "layer": "forecast_24h",
                "note": "Equals the latest observed PM2.5. Not a V2 model prediction and not a measurement of the future hour.",
            },
        )
        if feature:
            features.append(feature)
    return {
        "type": "FeatureCollection",
        "name": "forecast_24h",
        "clock": CLOCK,
        "source": SOURCE,
        "method": "persistence",
        "status": "MODELED",
        "features": features,
    }


def main() -> int:
    stations = stations_geojson()
    _write(STATIONS_GEOJSON, stations)
    _write(MAP_DIR / "stations.geojson", stations)
    _write(MAP_DIR / "current_pm25.geojson", current_layer())
    _write(MAP_DIR / "historical_pm25.geojson", history_layer())
    _write(MAP_DIR / "hotspots.geojson", hotspot_geojson())
    _write(MAP_DIR / "forecast_24h.geojson", forecast_layer())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
