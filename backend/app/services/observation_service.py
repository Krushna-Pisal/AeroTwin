"""Read observed hourly PM2.5 and the meteorological fields stored with it."""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from app.config import STATUS_OBSERVED
from app.data_store import CLOCK, DATASET_URL, MET_FIELDS, SOURCE, hourly, iso, number
from app.stations import STATIONS, by_id

# If the most-recent PM2.5 hour in the archive is older than this many hours
# (relative to wall-clock UTC), every "latest" reading is flagged as stale
# archive data – it is NOT a live or near-live reading.
STALE_THRESHOLD_HOURS = 48.0


def list_stations() -> list[dict]:
    return [
        {
            "station_id": station["station_id"],
            "station_name": station["station_name"],
            "latitude": station["latitude"],
            "longitude": station["longitude"],
            "coordinate_status": station["coordinate_status"],
            "coordinate_note": station.get("coordinate_note"),
            "pm25_available": station["pm25_available"],
            "in_serving_table": station["in_serving_table"],
            "serving_note": station.get("serving_note"),
            "source": SOURCE,
            "dataset": DATASET_URL,
            "status": STATUS_OBSERVED,
        }
        for station in STATIONS
    ]


def stations_geojson() -> dict:
    features = []
    for station in STATIONS:
        geometry = None
        if station["latitude"] is not None and station["longitude"] is not None:
            geometry = {
                "type": "Point",
                "coordinates": [station["longitude"], station["latitude"]],
            }
        features.append(
            {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "station_id": station["station_id"],
                    "station_name": station["station_name"],
                    "pm25_available": station["pm25_available"],
                    "in_serving_table": station["in_serving_table"],
                    "coordinate_status": station["coordinate_status"],
                    "source": SOURCE,
                    "status": STATUS_OBSERVED,
                    "clock": CLOCK,
                },
            }
        )
    return {
        "type": "FeatureCollection",
        "name": "stations",
        "clock": CLOCK,
        "source": SOURCE,
        "features": features,
    }


def _as_utc(value: str) -> pd.Timestamp:
    stamp = pd.Timestamp(value)
    if stamp.tzinfo is None:
        return stamp.tz_localize("UTC")
    return stamp.tz_convert("UTC")


def _archive_age_hours(timestamp: pd.Timestamp) -> float:
    """Hours between the archive timestamp and wall-clock UTC now."""
    now = datetime.now(timezone.utc)
    ts = pd.Timestamp(timestamp)
    if ts.tzinfo is None:
        ts = ts.tz_localize("UTC")
    ts_dt = ts.to_pydatetime()
    return (now - ts_dt).total_seconds() / 3600.0


def _observation_row(row: pd.Series, age_hours: float | None = None) -> dict:
    weather = {field: number(row[field]) if field in row.index else None for field in MET_FIELDS}
    if age_hours is None:
        age_hours = _archive_age_hours(row["timestamp"])
    return {
        "timestamp": iso(row["timestamp"]),
        "station_id": str(row["station_id"]),
        "station_name": str(row["station_name"]),
        "pm25": number(row["pm25"]),
        "meteorology": weather,
        "clock": CLOCK,
        "source": SOURCE,
        "status": STATUS_OBSERVED,
        "archive_age_hours": round(age_hours, 1),
        "archive_stale": age_hours > STALE_THRESHOLD_HOURS,
    }


def _network_archive_age() -> float:
    """Age in hours of the newest PM2.5 reading across all stations."""
    frame = hourly()
    newest = frame.loc[frame["pm25"].notna(), "timestamp"].max()
    if pd.isna(newest):
        return float("inf")
    return _archive_age_hours(newest)


def latest_observations() -> list[dict]:
    frame = hourly()
    observed = frame.loc[frame["pm25"].notna()].sort_values("timestamp")
    latest = observed.groupby("station_id", as_index=False).tail(1)
    # Pre-compute per-row age so every row reflects wall-clock now at call time
    rows = []
    for _, row in latest.iterrows():
        age = _archive_age_hours(row["timestamp"])
        rows.append(_observation_row(row, age))
    return rows


def history(station_id: str, start: str | None, end: str | None, limit: int) -> dict | None:
    station = by_id(station_id)
    if station is None:
        return None
    if not station["in_serving_table"]:
        return {
            "station_id": station_id,
            "station_name": station["station_name"],
            "observations": [],
            "note": station.get("serving_note"),
            "clock": CLOCK,
            "source": SOURCE,
        }
    frame = hourly()
    group = frame.loc[(frame["station_id"] == station_id) & frame["pm25"].notna()].sort_values("timestamp")
    if start:
        group = group.loc[group["timestamp"] >= _as_utc(start)]
    if end:
        group = group.loc[group["timestamp"] <= _as_utc(end)]
    group = group.tail(limit)
    return {
        "station_id": station_id,
        "station_name": station["station_name"],
        "clock": CLOCK,
        "source": SOURCE,
        "status": STATUS_OBSERVED,
        "count": int(len(group)),
        "observations": [_observation_row(row) for _, row in group.iterrows()],
    }
