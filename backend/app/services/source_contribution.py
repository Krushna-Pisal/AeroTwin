"""Evidence-weighted contribution estimates.

This is not causal source apportionment. A score records how strong the
available map evidence is for one category. normalized_share is filled only
when at least two categories have scores, and even then it is a share of
those scores, not a percent of PM2.5.
"""

from __future__ import annotations

import pandas as pd

from app.config import (
    CONTRIBUTION_MIN_SCORED_CATEGORIES,
    CONTRIBUTION_PROXIMITY_SCALE_M,
    PM25_UNIT,
    PROXIMITY_NOTE,
    STATUS_DATA_UNAVAILABLE,
    STATUS_OBSERVED,
    STATUS_PROXY,
)
from app.data_store import hourly, iso, number
from app.providers.activity import DustConstructionActivityProvider, IndustrialActivityProvider, TrafficActivityProvider
from app.services.activity_service import _lines, _outer_rings, industrial_collection, road_collection
from app.spatial import distance_to_lines_m, distance_to_polygons_m
from app.stations import by_id

METHODOLOGY = "evidence-weighted contribution estimate"
NOT_CAUSAL = (
    "This is an evidence-weighted contribution estimate, not causal source apportionment. "
    "It does not say what percent of PM2.5 comes from a category."
)
SHARE_LIMIT = (
    "normalized_share is omitted unless at least two categories have an evidence score. "
    "A single score is not turned into a pollution percentage. "
    "When a share is present, it is a share of evidence scores, not a share of PM2.5."
)

_ROAD_DISTANCE: dict[str, float | None] = {}
_INDUSTRIAL_DISTANCE: dict[str, float | None] = {}


def proximity_score(distance_m: float) -> float:
    """Unitless score in (0, 1]. One at zero metres, one half at the configured scale."""
    return round(1.0 / (1.0 + float(distance_m) / CONTRIBUTION_PROXIMITY_SCALE_M), 4)


def apply_normalized_shares(categories: list[dict]) -> None:
    """Fill normalized_share in place. Unavailable categories stay null."""
    scored = [row for row in categories if row["score"] is not None]
    if len(scored) < CONTRIBUTION_MIN_SCORED_CATEGORIES:
        for row in categories:
            row["normalized_share"] = None
        return
    total = sum(row["score"] for row in scored)
    if total <= 0:
        for row in categories:
            row["normalized_share"] = None
        return
    for row in categories:
        if row["score"] is None:
            row["normalized_share"] = None
        else:
            row["normalized_share"] = round(row["score"] / total, 4)


def _pm25_context(station_id: str, timestamp: str | None) -> tuple[str | None, float | None, str | None]:
    frame = hourly()
    group = frame.loc[(frame["station_id"] == station_id) & frame["pm25"].notna()]
    if group.empty:
        return timestamp, None, "This station has no PM2.5 in the serving table."
    if timestamp is None:
        row = group.sort_values("timestamp").iloc[-1]
        return iso(row["timestamp"]), number(row["pm25"]), None
    stamp = pd.Timestamp(timestamp)
    if stamp.tzinfo is None:
        stamp = stamp.tz_localize("UTC")
    else:
        stamp = stamp.tz_convert("UTC")
    match = group.loc[group["timestamp"] == stamp]
    if match.empty:
        return iso(stamp), None, "No observed PM2.5 at the requested hour."
    row = match.iloc[-1]
    return iso(row["timestamp"]), number(row["pm25"]), None


def _cached_distance(cache: dict, station_id: str, longitude: float, latitude: float, geometries: list, metric) -> float | None:
    if station_id not in cache:
        cache[station_id] = metric(longitude, latitude, geometries)
    return cache[station_id]


def _unavailable(category: str, evidence: list[dict], limitations: list[str]) -> dict:
    return {
        "category": category,
        "score": None,
        "normalized_share": None,
        "confidence": None,
        "evidence": evidence,
        "status": STATUS_DATA_UNAVAILABLE,
        "limitations": limitations,
    }


def _proximity_category(category: str, distance_m: float | None, evidence: list[dict], missing_limitations: list[str], proxy_limitations: list[str]) -> dict:
    if distance_m is None:
        return _unavailable(category, evidence, missing_limitations)
    evidence = [
        *evidence,
        {
            "name": "proximity_distance",
            "value": round(float(distance_m), 1),
            "unit": "m",
            "status": STATUS_PROXY,
            "detail": PROXIMITY_NOTE,
        },
    ]
    return {
        "category": category,
        "score": proximity_score(distance_m),
        "normalized_share": None,
        "confidence": "LOW",
        "evidence": evidence,
        "status": STATUS_PROXY,
        "limitations": proxy_limitations,
    }


def contribution_payload(station_id: str, timestamp: str | None = None) -> dict | None:
    station = by_id(station_id)
    if station is None:
        return None
    context_time, pm25, pm25_note = _pm25_context(station_id, timestamp)
    categories = [
        _traffic(station),
        _industrial(station),
        _dust(),
    ]
    apply_normalized_shares(categories)
    limitations = [
        NOT_CAUSAL,
        SHARE_LIMIT,
        "Observed PM2.5 is reported as context and is not allocated across categories.",
        "Weather is not a source category and is not used to assign a share.",
        "V2 feature importances are not used. They describe a forecast model that was not promoted, and they are not category shares.",
        "Citizen reports are not loaded.",
    ]
    if pm25_note:
        limitations.append(pm25_note)
    if all(row["normalized_share"] is None for row in categories):
        limitations.append("No normalized shares are reported for this station.")
    return {
        "station_id": station["station_id"],
        "station_name": station["station_name"],
        "timestamp": context_time,
        "pm25": pm25,
        "pm25_unit": PM25_UNIT,
        "pm25_status": None if pm25 is None else STATUS_OBSERVED,
        "methodology": METHODOLOGY,
        "categories": categories,
        "limitations": limitations,
    }


def _traffic(station: dict) -> dict:
    volume = TrafficActivityProvider().get_activity(station_id=station["station_id"])
    evidence = [
        {
            "name": "traffic_volume",
            "value": volume.value,
            "unit": volume.unit,
            "status": volume.status,
            "detail": volume.detail,
        }
    ]
    limitations = [
        "No traffic count, probe speed, or modeled volume is loaded.",
        "Road distance is map context, not a measurement of congestion or of PM2.5 from traffic.",
    ]
    if station["latitude"] is None or station["longitude"] is None:
        evidence.append(
            {
                "name": "distance_to_road_network",
                "value": None,
                "unit": "m",
                "status": STATUS_DATA_UNAVAILABLE,
                "detail": "Station coordinates are not available, so road distance is not calculated.",
            }
        )
        return _unavailable("TRAFFIC", evidence, limitations + ["Station coordinates are unavailable."])
    lines = _lines(road_collection())
    distance = _cached_distance(
        _ROAD_DISTANCE,
        station["station_id"],
        station["longitude"],
        station["latitude"],
        lines,
        distance_to_lines_m,
    )
    if distance is None:
        evidence.append(
            {
                "name": "distance_to_road_network",
                "value": None,
                "unit": "m",
                "status": STATUS_DATA_UNAVAILABLE,
                "detail": "The road-network context layer is not loaded.",
            }
        )
        return _unavailable("TRAFFIC", evidence, limitations)
    return _proximity_category(
        "TRAFFIC",
        distance,
        evidence,
        limitations,
        limitations + ["Confidence is LOW because the score uses road proximity only."],
    )


def _industrial(station: dict) -> dict:
    activity = IndustrialActivityProvider().get_activity(station_id=station["station_id"])
    limitations = [
        "Industrial polygons, when present, are an activity proxy. They are not emissions and not a source contribution.",
    ]
    if activity.status == STATUS_DATA_UNAVAILABLE:
        return _unavailable(
            "INDUSTRIAL",
            [
                {
                    "name": "industrial_activity_proxy",
                    "value": None,
                    "unit": None,
                    "status": STATUS_DATA_UNAVAILABLE,
                    "detail": activity.detail,
                }
            ],
            limitations + ["No industrial proxy geometry is loaded."],
        )
    if station["latitude"] is None or station["longitude"] is None:
        return _unavailable(
            "INDUSTRIAL",
            [
                {
                    "name": "distance_to_industrial_activity_proxy",
                    "value": None,
                    "unit": "m",
                    "status": STATUS_DATA_UNAVAILABLE,
                    "detail": "Station coordinates are not available.",
                }
            ],
            limitations + ["Station coordinates are unavailable."],
        )
    rings = _outer_rings(industrial_collection())
    distance = _cached_distance(
        _INDUSTRIAL_DISTANCE,
        station["station_id"],
        station["longitude"],
        station["latitude"],
        rings,
        distance_to_polygons_m,
    )
    return _proximity_category(
        "INDUSTRIAL",
        distance,
        [
            {
                "name": "industrial_activity_proxy",
                "value": None,
                "unit": None,
                "status": STATUS_PROXY,
                "detail": activity.detail,
            }
        ],
        limitations + ["Industrial proxy geometry did not yield a distance."],
        limitations + ["Confidence is LOW because the score uses polygon proximity only."],
    )


def _dust() -> dict:
    activity = DustConstructionActivityProvider().get_activity()
    return _unavailable(
        "DUST_CONSTRUCTION",
        [
            {
                "name": "dust_or_construction_activity",
                "value": None,
                "unit": None,
                "status": activity.status,
                "detail": activity.detail,
            }
        ],
        [
            "No construction-permit or dust series is loaded.",
            "No construction sites are invented.",
        ],
    )
