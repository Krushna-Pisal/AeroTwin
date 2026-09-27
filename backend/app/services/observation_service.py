"""Read observed hourly PM2.5 and the meteorological fields stored with it."""

from __future__ import annotations

import pandas as pd

from app.config import STATUS_OBSERVED
from app.data_store import CLOCK, DATASET_URL, MET_FIELDS, SOURCE, hourly, iso, number
from app.stations import STATIONS, by_id


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


def _observation_row(row: pd.Series) -> dict:
    weather = {field: number(row[field]) if field in row.index else None for field in MET_FIELDS}
    return {
        "timestamp": iso(row["timestamp"]),
        "station_id": str(row["station_id"]),
        "station_name": str(row["station_name"]),
        "pm25": number(row["pm25"]),
        "meteorology": weather,
        "clock": CLOCK,
        "source": SOURCE,
        "status": STATUS_OBSERVED,
    }


def latest_observations() -> list[dict]:
    frame = hourly()
    observed = frame.loc[frame["pm25"].notna()].sort_values("timestamp")
    latest = observed.groupby("station_id", as_index=False).tail(1)
    return [_observation_row(row) for _, row in latest.iterrows()]


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
