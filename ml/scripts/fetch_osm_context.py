"""Download Pune OSM road centerlines and industrial land-use polygons.

Roads are context geometry, not traffic counts. Industrial polygons are a
spatial proxy, not emissions. A failed request is left missing rather than filled.
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import (  # noqa: E402
    INDUSTRIAL_PROXY_GEOJSON,
    OSM_COPYRIGHT,
    OSM_SOURCE,
    PUNE_CONTEXT_BBOX,
    ROAD_NETWORK_GEOJSON,
    STATUS_OBSERVED,
    STATUS_PROXY,
)

SERVERS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
)
SOUTH, WEST, NORTH, EAST = PUNE_CONTEXT_BBOX


def overpass(query: str) -> dict:
    last_error = None
    for url in SERVERS:
        request = urllib.request.Request(
            url,
            data=query.encode("utf-8"),
            headers={"User-Agent": "AeroTwin-Pune-research/0.1 (local environmental twin)"},
        )
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.load(response)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            print(url, type(exc).__name__, exc)
            time.sleep(2)
    raise RuntimeError(f"Overpass failed: {last_error}")


def _line(element: dict) -> list[list[float]] | None:
    geometry = element.get("geometry") or []
    coordinates = [[point["lon"], point["lat"]] for point in geometry if "lon" in point and "lat" in point]
    if len(coordinates) < 2:
        return None
    return coordinates


def _closed_ring(element: dict) -> list[list[float]] | None:
    coordinates = _line(element)
    if coordinates is None or len(coordinates) < 4:
        return None
    if coordinates[0] != coordinates[-1]:
        return None
    return coordinates


def road_collection(elements: list[dict]) -> dict:
    features = []
    for element in elements:
        if element.get("type") != "way":
            continue
        coordinates = _line(element)
        if coordinates is None:
            continue
        tags = element.get("tags") or {}
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": coordinates},
                "properties": {
                    "osm_id": element.get("id"),
                    "highway": tags.get("highway"),
                    "name": tags.get("name"),
                    "representation": "ROAD_NETWORK",
                    "role": "CONTEXT",
                    "label": "Road network context",
                    "status": STATUS_OBSERVED,
                    "source": OSM_SOURCE,
                    "source_url": OSM_COPYRIGHT,
                    "measures_traffic": False,
                    "timestamp": None,
                },
            }
        )
    return {
        "type": "FeatureCollection",
        "name": "road_network",
        "representation": "ROAD_NETWORK",
        "role": "CONTEXT",
        "status": STATUS_OBSERVED,
        "source": OSM_SOURCE,
        "source_url": OSM_COPYRIGHT,
        "note": "Highway centerlines from OpenStreetMap. Not traffic volume and not congestion.",
        "bbox": {"south": SOUTH, "west": WEST, "north": NORTH, "east": EAST},
        "features": features,
    }


def industrial_collection(elements: list[dict]) -> tuple[dict, int]:
    features = []
    skipped_open = 0
    for element in elements:
        if element.get("type") != "way":
            continue
        ring = _closed_ring(element)
        if ring is None:
            skipped_open += 1
            continue
        tags = element.get("tags") or {}
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [ring]},
                "properties": {
                    "osm_id": element.get("id"),
                    "name": tags.get("name"),
                    "landuse": "industrial",
                    "label": "Industrial activity proxy",
                    "status": STATUS_PROXY,
                    "source": OSM_SOURCE,
                    "source_url": OSM_COPYRIGHT,
                    "timestamp": None,
                },
            }
        )
    collection = {
        "type": "FeatureCollection",
        "name": "industrial_activity_proxy",
        "label": "Industrial activity proxy",
        "status": STATUS_PROXY,
        "source": OSM_SOURCE,
        "source_url": OSM_COPYRIGHT,
        "note": "OSM landuse=industrial polygons. Not emissions and not a source contribution.",
        "bbox": {"south": SOUTH, "west": WEST, "north": NORTH, "east": EAST},
        "skipped_unclosed_ways": skipped_open,
        "features": features,
    }
    return collection, skipped_open


def tiles() -> list[tuple[float, float, float, float]]:
    mid_lat = (SOUTH + NORTH) / 2
    mid_lon = (WEST + EAST) / 2
    return [
        (SOUTH, WEST, mid_lat, mid_lon),
        (SOUTH, mid_lon, mid_lat, EAST),
        (mid_lat, WEST, NORTH, mid_lon),
        (mid_lat, mid_lon, NORTH, EAST),
    ]


def _collect_tiles(tag_query: str) -> tuple[list[dict], list[str]]:
    elements = []
    errors = []
    for index, (south, west, north, east) in enumerate(tiles(), start=1):
        print(tag_query, "tile", index)
        try:
            payload = overpass(
                f"""
[out:json][timeout:50];
{tag_query}({south},{west},{north},{east});
out geom;
"""
            )
            elements.extend(payload.get("elements") or [])
        except (RuntimeError, urllib.error.URLError, TimeoutError) as exc:
            errors.append(str(exc))
        time.sleep(2)
    return elements, errors


def main() -> int:
    retrieved = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    road_elements, road_errors = _collect_tiles('way["highway"~"^(motorway|trunk|primary|secondary)$"]')
    seen = set()
    unique_roads = []
    for element in road_elements:
        key = element.get("id")
        if key in seen:
            continue
        seen.add(key)
        unique_roads.append(element)
    road_geo = road_collection(unique_roads)
    ROAD_NETWORK_GEOJSON.parent.mkdir(parents=True, exist_ok=True)
    if road_geo["features"]:
        ROAD_NETWORK_GEOJSON.write_text(json.dumps(road_geo), encoding="utf-8")
    print("road features", len(road_geo["features"]), road_errors)

    industrial_elements, errors = _collect_tiles('way["landuse"="industrial"]')
    unique = []
    seen = set()
    for element in industrial_elements:
        key = element.get("id")
        if key in seen:
            continue
        seen.add(key)
        unique.append(element)
    industrial_geo, skipped = industrial_collection(unique)
    if industrial_geo["features"]:
        INDUSTRIAL_PROXY_GEOJSON.write_text(json.dumps(industrial_geo), encoding="utf-8")
        print("industrial features", len(industrial_geo["features"]), "open skipped", skipped)
    else:
        print("industrial features 0; file not written", errors)
    provenance = {
        "retrieved_at": retrieved,
        "source": OSM_SOURCE,
        "source_url": OSM_COPYRIGHT,
        "bbox": {"south": SOUTH, "west": WEST, "north": NORTH, "east": EAST},
        "roads": {
            "file": ROAD_NETWORK_GEOJSON.name if road_geo["features"] else None,
            "features": len(road_geo["features"]),
            "classes": ["motorway", "trunk", "primary", "secondary"],
            "errors": road_errors,
        },
        "industrial": {
            "file": INDUSTRIAL_PROXY_GEOJSON.name if industrial_geo["features"] else None,
            "features": len(industrial_geo["features"]),
            "skipped_unclosed_ways": skipped,
            "relations_not_requested": True,
            "errors": errors,
        },
        "not_loaded": ["GatiShakti industrial park boundaries", "MIDC parcel geometries", "traffic counts", "construction permits"],
    }
    (ROAD_NETWORK_GEOJSON.parent / "osm_context_provenance.json").write_text(
        json.dumps(provenance, indent=2), encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
