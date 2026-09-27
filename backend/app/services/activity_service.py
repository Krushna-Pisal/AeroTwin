"""Activity responses.

Traffic volume and construction sites are not invented. A road layer, when
the OSM file is present, is context geometry only. Industrial polygons, when
present, are a spatial proxy.
"""

from __future__ import annotations

import json

from app.config import (
    INDUSTRIAL_PROXY_GEOJSON,
    OSM_COPYRIGHT,
    OSM_SOURCE,
    PROXIMITY_NOTE,
    ROAD_NETWORK_GEOJSON,
    STATUS_DATA_UNAVAILABLE,
    STATUS_OBSERVED,
    STATUS_PROXY,
)
from app.providers.activity import (
    DustConstructionActivityProvider,
    IndustrialActivityProvider,
    TrafficActivityProvider,
)
from app.spatial import distance_to_lines_m, distance_to_polygons_m
from app.stations import STATIONS

_CACHE: dict = {}


def _read_collection(path) -> dict | None:
    if not path.is_file():
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("type") != "FeatureCollection" or not payload.get("features"):
        return None
    return payload


def _lines(collection: dict | None) -> list[list[list[float]]]:
    if collection is None:
        return []
    lines = []
    for feature in collection["features"]:
        geometry = feature.get("geometry") or {}
        if geometry.get("type") == "LineString":
            lines.append(geometry.get("coordinates") or [])
    return lines


def _outer_rings(collection: dict | None) -> list[list[list[float]]]:
    if collection is None:
        return []
    rings = []
    for feature in collection["features"]:
        geometry = feature.get("geometry") or {}
        if geometry.get("type") != "Polygon":
            continue
        coordinates = geometry.get("coordinates") or []
        if coordinates:
            rings.append(coordinates[0])
    return rings


def road_collection() -> dict | None:
    if "roads" not in _CACHE:
        _CACHE["roads"] = _read_collection(ROAD_NETWORK_GEOJSON)
    return _CACHE["roads"]


def industrial_collection() -> dict | None:
    if "industrial" not in _CACHE:
        _CACHE["industrial"] = _read_collection(INDUSTRIAL_PROXY_GEOJSON)
    return _CACHE["industrial"]


def _station_distances(kind: str, measure) -> list[dict]:
    rows = []
    for station in STATIONS:
        base = {
            "station_id": station["station_id"],
            "station_name": station["station_name"],
            "relation": kind,
            "note": PROXIMITY_NOTE,
        }
        if station["latitude"] is None or station["longitude"] is None:
            rows.append({**base, "distance_m": None, "status": STATUS_DATA_UNAVAILABLE, "reason": "station coordinates unavailable"})
            continue
        distance = measure(station["longitude"], station["latitude"])
        if distance is None:
            rows.append({**base, "distance_m": None, "status": STATUS_DATA_UNAVAILABLE, "reason": "activity geometry unavailable"})
            continue
        rows.append({**base, "distance_m": round(distance, 1), "status": STATUS_OBSERVED if kind == "distance_to_road_network" else STATUS_PROXY})
    return rows


def traffic_payload() -> dict:
    evidence = TrafficActivityProvider().get_activity()
    roads = road_collection()
    lines = _lines(roads)
    context = {
        "representation": "ROAD_NETWORK",
        "role": "CONTEXT",
        "status": STATUS_DATA_UNAVAILABLE if roads is None else STATUS_OBSERVED,
        "source": None if roads is None else OSM_SOURCE,
        "source_url": None if roads is None else OSM_COPYRIGHT,
        "feature_count": 0 if roads is None else len(roads["features"]),
        "measures_traffic": False,
        "note": "No road geometry is loaded." if roads is None else "Mapped highway centerlines. Not traffic volume and not congestion.",
    }
    return {
        "category": "TRAFFIC",
        "label": None,
        "value": evidence.value,
        "unit": evidence.unit,
        "timestamp": None,
        "source": evidence.source,
        "status": evidence.status,
        "detail": evidence.detail,
        "context_layer": context,
        "station_context": _station_distances(
            "distance_to_road_network",
            lambda lon, lat: distance_to_lines_m(lon, lat, lines),
        ),
    }


def industrial_payload() -> dict:
    evidence = IndustrialActivityProvider().get_activity()
    layer = industrial_collection()
    rings = _outer_rings(layer)
    return {
        "category": "INDUSTRIAL",
        "label": None if layer is None else "Industrial activity proxy",
        "value": evidence.value,
        "unit": evidence.unit,
        "timestamp": None,
        "source": evidence.source,
        "status": evidence.status,
        "detail": evidence.detail,
        "feature_count": 0 if layer is None else len(layer["features"]),
        "station_context": _station_distances(
            "distance_to_industrial_activity_proxy",
            lambda lon, lat: distance_to_polygons_m(lon, lat, rings),
        ),
    }


def dust_payload() -> dict:
    evidence = DustConstructionActivityProvider().get_activity()
    return {
        "category": "DUST_CONSTRUCTION",
        "label": None,
        "value": evidence.value,
        "unit": evidence.unit,
        "timestamp": None,
        "source": evidence.source,
        "status": evidence.status,
        "detail": evidence.detail,
        "feature_count": 0,
        "station_context": [],
    }


def map_layers_payload() -> dict:
    roads = road_collection()
    industrial = industrial_collection()
    layers = [
        {
            "id": "road_network",
            "representation": "ROAD_NETWORK",
            "role": "CONTEXT",
            "path": None if roads is None else "data/processed/map/road_network.geojson",
            "status": STATUS_DATA_UNAVAILABLE if roads is None else STATUS_OBSERVED,
            "feature_count": 0 if roads is None else len(roads["features"]),
            "source": None if roads is None else OSM_SOURCE,
            "note": "Not traffic volume and not congestion.",
        },
        {
            "id": "industrial_activity_proxy",
            "label": "Industrial activity proxy",
            "path": None if industrial is None else "data/processed/map/industrial_activity_proxy.geojson",
            "status": STATUS_DATA_UNAVAILABLE if industrial is None else STATUS_PROXY,
            "feature_count": 0 if industrial is None else len(industrial["features"]),
            "source": None if industrial is None else OSM_SOURCE,
            "note": "Not emissions and not a source contribution.",
        },
        {
            "id": "dust_construction",
            "path": None,
            "status": STATUS_DATA_UNAVAILABLE,
            "feature_count": 0,
            "source": None,
            "note": "No construction-permit or dust geometry is loaded.",
        },
    ]
    return {"layers": layers}
