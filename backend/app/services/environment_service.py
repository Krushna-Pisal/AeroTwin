"""One station situation assembled from the existing services.

This module does not recalculate the forecast, hotspot rule, contribution
scores, or scenario arithmetic. It keeps each value's own status.
"""

from __future__ import annotations

from app.config import (
    CLOCK,
    FORECAST_METHOD,
    INTERVENTION_CATEGORY,
    PM25_UNIT,
    SCENARIO_SCORE_REDUCTION,
    STATUS_DATA_UNAVAILABLE,
    STATUS_MODELED,
    STATUS_OBSERVED,
    STATUS_PROXY,
    STATUS_SCENARIO,
    ZONE_BASIS,
    ZONE_RADIUS_M,
)
from app.data_store import MET_FIELDS, SOURCE, hourly
from app.domain.scenarios import InterventionChoice, ScenarioCompareRequest
from app.services.activity_service import industrial_collection, road_collection
from app.services import live_service
from app.services.forecast_service import forecast_station
from app.services.hotspot_service import station_diagnostics
from app.services.observation_service import latest_observations
from app.services.scenario_service import NOT_ENFORCEMENT, compare
from app.services.source_contribution import NOT_CAUSAL, contribution_payload
from app.stations import by_id

_CITIZEN_DETAIL = (
    "No citizen-report store is loaded. "
    "A report, when one exists, stays CITIZEN_REPORTED and does not change the forecast."
)


def environmental_situation(
    station_id: str,
    *,
    include_scenarios: bool = False,
    scenario_intensity: str = "MEDIUM",
) -> dict | None:
    station = by_id(station_id)
    if station is None:
        return None
    if include_scenarios and scenario_intensity not in SCENARIO_SCORE_REDUCTION:
        raise ValueError(scenario_intensity)
    current = _current(station_id)
    forecast = _forecast(station_id)
    contributions = contribution_payload(station_id)
    hotspot = _hotspot(station_id)
    weather = _weather(current)
    quality = _data_quality(station, current, weather)
    scenarios = _scenario_availability(station_id, include_scenarios, scenario_intensity, current)
    timestamp = None if current is None else current["timestamp"]
    return {
        "station": _station_block(station),
        "zone": _zone_pointer(station),
        "timestamp": timestamp,
        "clock": CLOCK,
        "current_observation": _observation_block(station, current),
        "live_reading": live_service.reading_for_station(station_id),
        "forecast": forecast,
        "hotspot": hotspot,
        "activity": _activity(contributions),
        "source_contributions": contributions,
        "citizen_reports": {
            "status": STATUS_DATA_UNAVAILABLE,
            "count": 0,
            "reports": [],
            "detail": _CITIZEN_DETAIL,
        },
        "weather": weather,
        "data_quality": quality,
        "scenario_availability": scenarios,
        "interpolation": None,
        "limitations": _limitations(station, current),
    }


def _station_block(station: dict) -> dict:
    return {
        "station_id": station["station_id"],
        "station_name": station["station_name"],
        "latitude": station["latitude"],
        "longitude": station["longitude"],
        "coordinate_status": station["coordinate_status"],
        "coordinate_note": station.get("coordinate_note"),
        "in_serving_table": station["in_serving_table"],
        "serving_note": station.get("serving_note"),
        "source": SOURCE,
        "status": STATUS_OBSERVED,
    }


def _zone_pointer(station: dict) -> dict:
    has_point = station["latitude"] is not None and station["longitude"] is not None
    return {
        "zone_id": f"station:{station['station_id']}",
        "basis": ZONE_BASIS,
        "radius_m": ZONE_RADIUS_M if has_point else None,
        "official_administrative_zone": False,
        "status": STATUS_MODELED if has_point else STATUS_DATA_UNAVAILABLE,
    }


def _current(station_id: str) -> dict | None:
    for row in latest_observations():
        if row["station_id"] == station_id:
            return row
    return None


def _observation_block(station: dict, current: dict | None) -> dict:
    if current is None:
        return {
            "pm25": None,
            "unit": PM25_UNIT,
            "timestamp": None,
            "source": None,
            "status": STATUS_DATA_UNAVAILABLE,
            "detail": station.get("serving_note") or "No PM2.5 hour is in the serving table.",
        }
    return {
        "pm25": current["pm25"],
        "unit": PM25_UNIT,
        "timestamp": current["timestamp"],
        "source": current["source"],
        "clock": current["clock"],
        "status": STATUS_OBSERVED,
    }


def _forecast(station_id: str) -> dict:
    item = forecast_station(station_id)
    if item is None:
        return {
            "pm25": None,
            "unit": PM25_UNIT,
            "method": FORECAST_METHOD,
            "status": STATUS_DATA_UNAVAILABLE,
            "forecast_status": None,
            "detail": "No serving observations for this station. The persistence forecast is not filled in.",
        }
    return {
        "pm25": item["forecast_pm25_24h"],
        "observed_pm25": item["current_pm25"],
        "unit": PM25_UNIT,
        "timestamp": item["timestamp"],
        "forecast_timestamp": item["forecast_timestamp"],
        "method": item["method"],
        "status": STATUS_MODELED,
        "forecast_status": item["status"],
        "clock": item["clock"],
        "source": item["source"],
        "observation_age_hours": item["observation_age_hours"],
        "stale": item["stale"],
        "note": "Equals the latest observed PM2.5. The production forecast route is unchanged.",
    }


def _hotspot(station_id: str) -> dict:
    for row in station_diagnostics():
        if row["station_id"] == station_id:
            return {
                "hotspot": row["hotspot"],
                "latest_pm25": row["latest_pm25"],
                "rolling_24h_mean": row["rolling_24h_mean"],
                "rolling_24h_hours": row["rolling_24h_hours"],
                "percentile": row["percentile"],
                "timestamp": row["timestamp"],
                "eligible": row["eligible"],
                "spatial_support": "station",
                "interpolation": None,
                "source": row["source"],
                "status": STATUS_OBSERVED,
            }
    return {
        "hotspot": None,
        "spatial_support": "station",
        "interpolation": None,
        "status": STATUS_DATA_UNAVAILABLE,
        "detail": "This station is not in the scored hourly table.",
    }


def _activity(contributions: dict | None) -> dict:
    by_name = {}
    if contributions is not None:
        by_name = {row["category"]: row for row in contributions["categories"]}
    roads = road_collection()
    industrial = industrial_collection()
    return {
        "traffic": {
            "category": "TRAFFIC",
            "volume": None,
            "volume_status": STATUS_DATA_UNAVAILABLE,
            "context_layer": {
                "representation": "ROAD_NETWORK",
                "role": "CONTEXT",
                "measures_traffic": False,
                "feature_count": 0 if roads is None else len(roads["features"]),
                "status": STATUS_DATA_UNAVAILABLE if roads is None else STATUS_OBSERVED,
            },
            "evidence_status": None if "TRAFFIC" not in by_name else by_name["TRAFFIC"]["status"],
            "score": None if "TRAFFIC" not in by_name else by_name["TRAFFIC"]["score"],
        },
        "industrial": {
            "category": "INDUSTRIAL",
            "label": None if industrial is None else "Industrial activity proxy",
            "value": None,
            "status": STATUS_DATA_UNAVAILABLE if industrial is None else STATUS_PROXY,
            "evidence_status": None if "INDUSTRIAL" not in by_name else by_name["INDUSTRIAL"]["status"],
            "score": None if "INDUSTRIAL" not in by_name else by_name["INDUSTRIAL"]["score"],
        },
        "dust_construction": {
            "category": "DUST_CONSTRUCTION",
            "value": None,
            "status": STATUS_DATA_UNAVAILABLE,
            "evidence_status": None if "DUST_CONSTRUCTION" not in by_name else by_name["DUST_CONSTRUCTION"]["status"],
            "score": None,
        },
    }


def _weather(current: dict | None) -> dict:
    fields = {}
    present = 0
    meteorology = {} if current is None else current.get("meteorology") or {}
    for name in MET_FIELDS:
        value = meteorology.get(name)
        observed = value is not None
        if observed:
            present += 1
        fields[name] = {
            "value": value,
            "status": STATUS_OBSERVED if observed else STATUS_DATA_UNAVAILABLE,
        }
    return {
        "status": STATUS_OBSERVED if present else STATUS_DATA_UNAVAILABLE,
        "fields_present": present,
        "fields": fields,
        "note": "Weather is a meteorological observation. It is not a source category.",
    }


def _data_quality(station: dict, current: dict | None, weather: dict) -> dict:
    frame = hourly()
    group = frame.loc[frame["station_id"] == station["station_id"]]
    hours = int(len(group))
    with_pm25 = int(group["pm25"].notna().sum()) if hours else 0
    has_point = station["latitude"] is not None and station["longitude"] is not None
    roads = road_collection()
    industrial = industrial_collection()
    return {
        "pm25_coverage": {
            "hours_in_table": hours,
            "hours_with_pm25": with_pm25,
            "coverage_fraction": None if hours == 0 else round(with_pm25 / hours, 4),
            "latest_timestamp": None if current is None else current["timestamp"],
            "status": STATUS_OBSERVED if with_pm25 else STATUS_DATA_UNAVAILABLE,
        },
        "weather_availability": {
            "fields_present_at_latest_hour": weather["fields_present"],
            "fields": list(MET_FIELDS),
            "status": weather["status"],
        },
        "coordinate_availability": {
            "available": has_point,
            "coordinate_status": station["coordinate_status"],
            "status": STATUS_OBSERVED if has_point else STATUS_DATA_UNAVAILABLE,
        },
        "activity_evidence_availability": {
            "traffic_volume": STATUS_DATA_UNAVAILABLE,
            "road_context": STATUS_DATA_UNAVAILABLE if roads is None else STATUS_OBSERVED,
            "industrial_proxy": STATUS_DATA_UNAVAILABLE if industrial is None else STATUS_PROXY,
            "dust_construction": STATUS_DATA_UNAVAILABLE,
        },
        "citizen_report_availability": {
            "count": 0,
            "status": STATUS_DATA_UNAVAILABLE,
        },
    }


def _scenario_availability(station_id: str, include_scenarios: bool, intensity: str, current: dict | None) -> dict:
    base = {
        "status": STATUS_SCENARIO,
        "results_included": include_scenarios,
        "production_forecast_modified": False,
        "interventions": list(INTERVENTION_CATEGORY),
        "intensities": list(SCENARIO_SCORE_REDUCTION),
        "simulate": "POST /api/scenarios/simulate",
        "compare": "POST /api/scenarios/compare",
        "note": (
            "Scenario results are separate from the observation and the persistence forecast. "
            + NOT_ENFORCEMENT
        ),
    }
    if not include_scenarios:
        base["results"] = None
        base["results_status"] = STATUS_DATA_UNAVAILABLE
        return base
    compared = compare(
        ScenarioCompareRequest(
            station_id=station_id,
            timestamp=None if current is None else current["timestamp"],
            interventions=[
                InterventionChoice(intervention=name, intensity=intensity)
                for name in INTERVENTION_CATEGORY
            ],
        )
    )
    base["scenario_intensity"] = intensity
    base["results"] = compared
    base["results_status"] = STATUS_SCENARIO
    return base


def _limitations(station: dict, current: dict | None) -> list[str]:
    rows = [
        "Station PM2.5 is reported at the monitor. It is not interpolated onto roads or between stations.",
        ZONE_BASIS + " The zone is not an official administrative zone.",
        NOT_CAUSAL,
        "The production forecast remains persistence of the stored CPCB hour and is not modified by a live reading.",
        "A live aqi.in value, when present, is a different sensor. It is not written into the archive.",
        _CITIZEN_DETAIL,
        "Weather is not used as a source category.",
    ]
    if current is None:
        rows.append(station.get("serving_note") or "No PM2.5 hour is in the serving table.")
    if station["latitude"] is None or station["longitude"] is None:
        rows.append(station.get("coordinate_note") or "Station coordinates are unavailable.")
    return rows
