"""Station hotspots from observed hourly PM2.5.

This is not a street-level map and not an interpolation. A station is a
hotspot only when three documented conditions all hold:

1. Current concentration: latest hourly PM2.5 is at least 60 µg/m³.
2. Recent persistence: the mean of hourly PM2.5 over the 24 hours ending at
   that observation is at least 60 µg/m³, with at least 12 observed hours.
3. Local comparison: that 24-hour mean is at or above the 75th percentile of
   stations whose latest observation is within 48 hours of the newest
   observation on the network and which also have 12 hours in the window.

60 µg/m³ is the CPCB National Air Quality Index breakpoint that separates
Satisfactory from Moderate for a 24-hour PM2.5 average. It is used here as an
operational floor. This service does not compute the official AQI bulletin.
Stations with no coordinates are still scored. They are omitted from the
GeoJSON point layer.
"""

from __future__ import annotations

import pandas as pd

from app.data_store import CLOCK, SOURCE, hourly, iso, number
from app.stations import by_id

CONCENTRATION_FLOOR = 60.0
MIN_HOURS = 12
PERCENTILE = 0.75
STALE_HOURS = 48.0


def station_diagnostics() -> list[dict]:
    frame = hourly()
    observed = frame.loc[frame["pm25"].notna()]
    if observed.empty:
        return []
    network_end = observed["timestamp"].max()
    rows = []
    for station_id, group in frame.groupby("station_id"):
        group = group.sort_values("timestamp")
        valid = group.loc[group["pm25"].notna()]
        if valid.empty:
            continue
        last = valid.iloc[-1]
        end = pd.Timestamp(last["timestamp"])
        window = group.loc[(group["timestamp"] > end - pd.Timedelta(hours=24)) & (group["timestamp"] <= end)]
        rolling_n = int(window["pm25"].notna().sum())
        rolling_mean = float(window["pm25"].mean()) if rolling_n else None
        earlier = valid.loc[valid["timestamp"] <= end - pd.Timedelta(hours=24)]
        trend = None
        if not earlier.empty and rolling_mean is not None:
            trend = float(last["pm25"] - earlier.iloc[-1]["pm25"])
        age = float((network_end - end).total_seconds() / 3600)
        station = by_id(str(station_id)) or {}
        rows.append(
            {
                "station_id": str(station_id),
                "station_name": str(last["station_name"]),
                "latitude": station.get("latitude"),
                "longitude": station.get("longitude"),
                "timestamp": iso(end),
                "latest_pm25": number(last["pm25"]),
                "rolling_24h_mean": None if rolling_mean is None else round(rolling_mean, 2),
                "rolling_24h_hours": rolling_n,
                "trend_vs_24h_earlier": None if trend is None else round(trend, 2),
                "observation_age_hours": round(age, 2),
                "eligible": age <= STALE_HOURS and rolling_n >= MIN_HOURS and rolling_mean is not None,
                "clock": CLOCK,
                "source": SOURCE,
                "status": "OBSERVED",
            }
        )
    eligible_means = [row["rolling_24h_mean"] for row in rows if row["eligible"]]
    for row in rows:
        if not row["eligible"] or not eligible_means:
            row["percentile"] = None
            row["hotspot"] = False
            continue
        rank = sum(1 for value in eligible_means if value <= row["rolling_24h_mean"]) / len(eligible_means)
        row["percentile"] = round(rank, 3)
        row["hotspot"] = bool(
            row["latest_pm25"] >= CONCENTRATION_FLOOR
            and row["rolling_24h_mean"] >= CONCENTRATION_FLOOR
            and rank >= PERCENTILE
        )
    return rows


def hotspot_payload() -> dict:
    rows = station_diagnostics()
    hotspots = [row for row in rows if row["hotspot"]]
    return {
        "clock": CLOCK,
        "source": SOURCE,
        "status": "OBSERVED",
        "spatial_support": "station",
        "interpolation": None,
        "rule": {
            "concentration_floor_ugm3": CONCENTRATION_FLOOR,
            "floor_basis": "CPCB NAQI 24-hour PM2.5 breakpoint between Satisfactory and Moderate. Not an official AQI.",
            "min_hours_in_24h_window": MIN_HOURS,
            "percentile": PERCENTILE,
            "stale_after_hours": STALE_HOURS,
            "requires": "latest >= floor AND 24h mean >= floor AND percentile of 24h mean >= 0.75",
        },
        "stations_scored": len(rows),
        "stations_eligible": sum(1 for row in rows if row["eligible"]),
        "hotspots": hotspots,
        "stations": rows,
    }


def hotspot_geojson() -> dict:
    payload = hotspot_payload()
    features = []
    for row in payload["hotspots"]:
        if row["latitude"] is None or row["longitude"] is None:
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [row["longitude"], row["latitude"]]},
                "properties": {
                    "station_id": row["station_id"],
                    "station_name": row["station_name"],
                    "pm25": row["latest_pm25"],
                    "rolling_24h_mean": row["rolling_24h_mean"],
                    "percentile": row["percentile"],
                    "trend_vs_24h_earlier": row["trend_vs_24h_earlier"],
                    "hotspot": True,
                    "timestamp": row["timestamp"],
                    "source": SOURCE,
                    "status": "OBSERVED",
                    "spatial_support": "station",
                    "clock": CLOCK,
                },
            }
        )
    return {
        "type": "FeatureCollection",
        "name": "hotspots",
        "clock": CLOCK,
        "source": SOURCE,
        "status": "OBSERVED",
        "spatial_support": "station",
        "rule": payload["rule"],
        "features": features,
    }
