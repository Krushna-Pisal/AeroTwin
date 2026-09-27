"""Load the processed hourly CPCB table. Values are not invented."""

from __future__ import annotations

import pandas as pd

from app.config import CLOCK, DATASET_URL, HOURLY_PATH, MAP_DIR, SOURCE, STATIONS_GEOJSON

MET_FIELDS = (
    "temperature",
    "humidity",
    "wind_speed",
    "wind_direction",
    "rainfall",
    "solar_radiation",
)

_FRAME: pd.DataFrame | None = None


def hourly() -> pd.DataFrame:
    global _FRAME
    if _FRAME is None:
        frame = pd.read_parquet(HOURLY_PATH)
        frame["timestamp"] = pd.to_datetime(frame["timestamp"], utc=True)
        _FRAME = frame
    return _FRAME


def iso(value) -> str | None:
    if value is None or pd.isna(value):
        return None
    stamp = pd.Timestamp(value)
    if stamp.tzinfo is None:
        stamp = stamp.tz_localize("UTC")
    return stamp.strftime("%Y-%m-%dT%H:%M:%SZ")


def number(value):
    if value is None or pd.isna(value):
        return None
    return float(value)
