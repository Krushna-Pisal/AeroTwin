"""Map collections for the station-detail and city maps.

Point layers use station coordinates only. Road and industrial geometry are
the loaded context files. PM2.5 is not copied onto roads.
"""

from __future__ import annotations

from app.config import (
    CLOCK,
    INTERVENTION_CATEGORY,
    OSM_COPYRIGHT,
    OSM_SOURCE,
    SCENARIO_SCORE_REDUCTION,
    SOURCE,
    STATUS_DATA_UNAVAILABLE,
    STATUS_MODELED,
    STATUS_OBSERVED,
    STATUS_PROXY,
    STATUS_SCENARIO,
)
from app.domain.scenarios import ScenarioRequest
from app.services.activity_service import industrial_collection, map_layers_payload, road_collection
from app.services.forecast_service import forecast_all
from app.services.hotspot_service import hotspot_geojson
from app.services.observation_service import latest_observations, stations_geojson
from app.services.scenario_service import simulate
from app.stations import STATIONS, by_id

_NO_INTERPOLATION = "Station PM2.5 is not interpolated onto roads or between stations."


def map_payload(scenario_intervention: str | None = None, scenario_intensity: str | None = None) -> dict:
    if (scenario_intervention is None) != (scenario_intensity is None):
        raise ValueError("scenario_intervention and scenario_intensity are sent together")
    if scenario_intervention is not None and scenario_intervention not in INTERVENTION_CATEGORY:
        raise ValueError(scenario_intervention)
    if scenario_intensity is not None and scenario_intensity not in SCENARIO_SCORE_REDUCTION:
        raise ValueError(scenario_intensity)
    payload = map_layers_payload()
    collections = {
        "stations": _with_note(stations_geojson(), "stations"),
        "current_pm25": _current_pm25(),
        "hotspots": _with_note(hotspot_geojson(), "hotspots"),
        "forecast": _forecast_layer(),
        "industrial_proxy": _context_collection(
            industrial_collection(),
            "industrial_proxy",
            STATUS_PROXY,
            "Industrial activity proxy. Not emissions and not a source contribution.",
        ),
        "road_context": _context_collection(
            road_collection(),
            "road_context",
            STATUS_OBSERVED,
            "Mapped highway centerlines. ROAD_NETWORK context. Not traffic volume and not a PM2.5 surface.",
        ),
        "citizen_reports": _empty_collection(
            "citizen_reports",
            "No citizen-report store is loaded.",
        ),
        "scenario_results": _scenario_layer(scenario_intervention, scenario_intensity),
    }
    payload["collections"] = collections
    payload["interpolation"] = None
    payload["note"] = _NO_INTERPOLATION
    payload["layers"].extend(_summaries(collections))
    return payload


def _summaries(collections: dict) -> list[dict]:
    rows = []
    for name, collection in collections.items():
        rows.append(
            {
                "id": name,
                "status": collection.get("status"),
                "feature_count": len(collection.get("features") or []),
                "geometry": "station_point" if name not in {"industrial_proxy", "road_context"} else "loaded_context",
                "interpolation": None,
            }
        )
    return rows


def _with_note(collection: dict, name: str) -> dict:
    body = dict(collection)
    body["name"] = name
    body["interpolation"] = None
    body.setdefault("status", STATUS_OBSERVED)
    return body


def _point(station_id: str, properties: dict) -> dict | None:
    station = by_id(station_id)
    if station is None or station["latitude"] is None or station["longitude"] is None:
        return None
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [station["longitude"], station["latitude"]]},
        "properties": properties,
    }


def _current_pm25() -> dict:
    features = []
    for row in latest_observations():
        feature = _point(
            row["station_id"],
            {
                "station_id": row["station_id"],
                "station_name": row["station_name"],
                "pm25": row["pm25"],
                "unit": "µg/m³",
                "timestamp": row["timestamp"],
                "source": row["source"],
                "status": STATUS_OBSERVED,
                "spatial_support": "station",
                "interpolation": None,
                "clock": CLOCK,
            },
        )
        if feature:
            features.append(feature)
    return {
        "type": "FeatureCollection",
        "name": "current_pm25",
        "clock": CLOCK,
        "source": SOURCE,
        "status": STATUS_OBSERVED,
        "spatial_support": "station",
        "interpolation": None,
        "note": _NO_INTERPOLATION,
        "features": features,
    }


def _forecast_layer() -> dict:
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
                "method": item["method"],
                "source": item["source"],
                "status": STATUS_MODELED,
                "forecast_status": item["status"],
                "spatial_support": "station",
                "interpolation": None,
                "clock": item["clock"],
                "note": "Equals the latest observed PM2.5.",
            },
        )
        if feature:
            features.append(feature)
    return {
        "type": "FeatureCollection",
        "name": "forecast",
        "clock": CLOCK,
        "source": SOURCE,
        "method": "persistence",
        "status": STATUS_MODELED,
        "spatial_support": "station",
        "interpolation": None,
        "features": features,
    }


def _context_collection(collection: dict | None, name: str, status: str, note: str) -> dict:
    if collection is None:
        return _empty_collection(name, note)
    body = {
        "type": "FeatureCollection",
        "name": name,
        "status": status,
        "source": OSM_SOURCE,
        "source_url": OSM_COPYRIGHT,
        "interpolation": None,
        "note": note,
        "features": collection["features"],
    }
    if name == "road_context":
        body["representation"] = "ROAD_NETWORK"
        body["role"] = "CONTEXT"
        body["measures_traffic"] = False
    if name == "industrial_proxy":
        body["label"] = "Industrial activity proxy"
    return body


def _empty_collection(name: str, note: str) -> dict:
    return {
        "type": "FeatureCollection",
        "name": name,
        "status": STATUS_DATA_UNAVAILABLE,
        "interpolation": None,
        "note": note,
        "features": [],
    }


def _scenario_layer(intervention: str | None, intensity: str | None) -> dict:
    if intervention is None or intensity is None:
        return _empty_collection(
            "scenario_results",
            "Scenario points are included when scenario_intervention and scenario_intensity are set.",
        )
    features = []
    for station in STATIONS:
        result = simulate(
            ScenarioRequest(
                station_id=station["station_id"],
                intervention=intervention,
                intensity=intensity,
            )
        )
        feature = _point(
            station["station_id"],
            {
                "station_id": station["station_id"],
                "scenario_id": result["scenario"]["scenario_id"],
                "intervention_type": result["scenario"]["intervention_type"],
                "intervention_intensity": result["scenario"]["intervention_intensity"],
                "baseline_pm25": result["scenario"]["baseline_pm25"],
                "modeled_pm25": result["scenario"]["modeled_pm25"],
                "modeled_contribution": result["scenario"]["modeled_contribution"],
                "status": STATUS_SCENARIO,
                "spatial_support": "station",
                "interpolation": None,
            },
        )
        if feature:
            features.append(feature)
    return {
        "type": "FeatureCollection",
        "name": "scenario_results",
        "status": STATUS_SCENARIO,
        "interpolation": None,
        "spatial_support": "station",
        "note": "Scenario points sit on the station coordinate. They are not a pollution surface.",
        "features": features,
    }
