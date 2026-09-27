"""Phase 2 activity context. Geometry fixtures in this file are not city data."""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import INDUSTRIAL_PROXY_GEOJSON, ROAD_NETWORK_GEOJSON, STATUS_DATA_UNAVAILABLE, STATUS_OBSERVED, STATUS_PROXY
from app.main import app
from app.services.activity_service import _read_collection
from app.spatial import distance_to_lines_m, distance_to_polygons_m

client = TestClient(app)


def _valid_feature_collection(payload: dict, geometry_type: str) -> None:
    assert payload["type"] == "FeatureCollection"
    assert payload["features"]
    for feature in payload["features"]:
        assert feature["type"] == "Feature"
        assert feature["geometry"]["type"] == geometry_type
        coordinates = feature["geometry"]["coordinates"]
        assert isinstance(coordinates, list) and coordinates
        assert feature["properties"]["source"] == "OpenStreetMap"
        assert feature["properties"]["status"] in {STATUS_OBSERVED, STATUS_PROXY}


def test_missing_collection_is_unavailable():
    assert _read_collection(Path("data/processed/map/does_not_exist.geojson")) is None


def test_valid_proxy_dataset_is_read(tmp_path):
    path = tmp_path / "industrial_activity_proxy.geojson"
    ring = [[73.80, 18.50], [73.81, 18.50], [73.81, 18.51], [73.80, 18.51], [73.80, 18.50]]
    payload = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [ring]},
                "properties": {
                    "label": "Industrial activity proxy",
                    "status": "PROXY",
                    "source": "OpenStreetMap",
                },
            }
        ],
    }
    path.write_text(json.dumps(payload), encoding="utf-8")
    loaded = _read_collection(path)
    assert loaded is not None
    assert loaded["features"][0]["properties"]["label"] == "Industrial activity proxy"
    assert loaded["features"][0]["properties"]["status"] == STATUS_PROXY
    assert distance_to_polygons_m(73.805, 18.505, [ring]) == 0.0


def test_distance_to_a_line_and_a_polygon():
    line = [[[73.80, 18.50], [73.81, 18.50]]]
    south_of_line = distance_to_lines_m(73.805, 18.49, line)
    assert south_of_line is not None
    assert 1000 < south_of_line < 1300

    ring = [
        [73.80, 18.50],
        [73.81, 18.50],
        [73.81, 18.51],
        [73.80, 18.51],
        [73.80, 18.50],
    ]
    assert distance_to_polygons_m(73.805, 18.505, [ring]) == 0.0
    outside = distance_to_polygons_m(73.805, 18.49, [ring])
    assert outside is not None
    assert 1000 < outside < 1300
    assert distance_to_lines_m(73.8, 18.5, []) is None
    assert distance_to_polygons_m(73.8, 18.5, []) is None


def test_traffic_api_does_not_invent_volume():
    response = client.get("/api/activity/traffic")
    assert response.status_code == 200
    body = response.json()
    assert body["category"] == "TRAFFIC"
    assert body["status"] == STATUS_DATA_UNAVAILABLE
    assert body["value"] is None
    assert body["context_layer"]["representation"] == "ROAD_NETWORK"
    assert body["context_layer"]["role"] == "CONTEXT"
    assert body["context_layer"]["measures_traffic"] is False
    if ROAD_NETWORK_GEOJSON.is_file():
        assert body["context_layer"]["status"] == STATUS_OBSERVED
        payload = json.loads(ROAD_NETWORK_GEOJSON.read_text(encoding="utf-8"))
        _valid_feature_collection(payload, "LineString")
        assert payload["features"][0]["properties"]["representation"] == "ROAD_NETWORK"
        assert payload["features"][0]["properties"]["measures_traffic"] is False
        distances = [row for row in body["station_context"] if row["distance_m"] is not None]
        assert distances
        assert all(row["note"].startswith("Contextual distance only.") for row in body["station_context"])
    else:
        assert body["context_layer"]["status"] == STATUS_DATA_UNAVAILABLE


def test_industrial_api_is_proxy_or_unavailable():
    response = client.get("/api/activity/industrial")
    assert response.status_code == 200
    body = response.json()
    assert body["category"] == "INDUSTRIAL"
    assert body["value"] is None
    assert "contribution" not in (body.get("label") or "").lower()
    if INDUSTRIAL_PROXY_GEOJSON.is_file():
        assert body["status"] == STATUS_PROXY
        assert body["label"] == "Industrial activity proxy"
        payload = json.loads(INDUSTRIAL_PROXY_GEOJSON.read_text(encoding="utf-8"))
        _valid_feature_collection(payload, "Polygon")
        assert payload["features"][0]["properties"]["label"] == "Industrial activity proxy"
        assert "emission" not in payload["features"][0]["properties"]["label"].lower()
    else:
        assert body["status"] == STATUS_DATA_UNAVAILABLE
        assert body["label"] is None


def test_dust_api_is_unavailable():
    response = client.get("/api/activity/dust-construction")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == STATUS_DATA_UNAVAILABLE
    assert body["value"] is None
    assert body["feature_count"] == 0


def test_map_layers_catalog():
    response = client.get("/api/map/layers")
    assert response.status_code == 200
    layers = {item["id"]: item for item in response.json()["layers"]}
    assert layers["dust_construction"]["status"] == STATUS_DATA_UNAVAILABLE
    assert layers["road_network"]["representation"] == "ROAD_NETWORK"
    assert layers["road_network"]["role"] == "CONTEXT"
    assert layers["industrial_activity_proxy"]["label"] == "Industrial activity proxy"
    assert layers["industrial_activity_proxy"]["status"] in {STATUS_PROXY, STATUS_DATA_UNAVAILABLE}
