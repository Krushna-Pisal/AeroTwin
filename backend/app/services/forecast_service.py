"""Production 24-hour forecast.

The production method is persistence: PM2.5 at T+24h equals the latest
observed PM2.5 at that station. V2 models are kept on disk for research and
are not called here.
"""

from __future__ import annotations

import pandas as pd

from app.config import FORECAST_API_STATUS, FORECAST_METHOD
from app.data_store import CLOCK, SOURCE, hourly, iso, number
from app.stations import by_id

METHOD = FORECAST_METHOD
STATUS = FORECAST_API_STATUS
V2_NOTE = (
    "V2-A lags-only, V2-B weather, and V2-C calendar were evaluated on the "
    "July–December 2025 test period and did not beat persistence. They are "
    "not the production forecast."
)


def _latest_rows() -> pd.DataFrame:
    frame = hourly()
    observed = frame.loc[frame["pm25"].notna(), ["station_id", "station_name", "timestamp", "pm25"]]
    return observed.sort_values("timestamp").groupby("station_id", as_index=False).tail(1)


def forecast_station(station_id: str) -> dict | None:
    station = by_id(station_id)
    if station is None or not station["in_serving_table"]:
        return None
    latest = _latest_rows()
    row = latest.loc[latest["station_id"] == station_id]
    if row.empty:
        return None
    item = row.iloc[0]
    network_end = hourly().loc[hourly()["pm25"].notna(), "timestamp"].max()
    age_hours = float((network_end - item["timestamp"]).total_seconds() / 3600)
    current = number(item["pm25"])
    issued = pd.Timestamp(item["timestamp"])
    return {
        "station_id": station_id,
        "station_name": str(item["station_name"]),
        "current_pm25": current,
        "forecast_pm25_24h": current,
        "method": METHOD,
        "status": STATUS,
        "timestamp": iso(issued),
        "forecast_timestamp": iso(issued + pd.Timedelta(hours=24)),
        "clock": CLOCK,
        "source": SOURCE,
        "observation_age_hours": round(age_hours, 2),
        "stale": age_hours > 48,
        "model_metadata": {
            "production_method": METHOD,
            "v2_promoted": False,
            "research_models_retained": ["V0_persistence", "V2-A", "V2-B", "V2-C"],
            "note": V2_NOTE,
        },
    }


def forecast_all() -> list[dict]:
    rows = []
    for station_id in _latest_rows()["station_id"]:
        item = forecast_station(str(station_id))
        if item is not None:
            rows.append(item)
    return rows
