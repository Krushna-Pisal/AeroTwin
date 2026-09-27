"""Single place for paths, the production forecast, hotspot floors, and vocabularies.

The forecast route still returns status ``observed_baseline``. That word is the
frozen API label for the persistence baseline. It is not one of the canonical
data statuses.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

ROOT = Path(__file__).resolve().parents[2]

HOURLY_PATH = ROOT / "data" / "processed" / "v2_hourly.parquet"
MAP_DIR = ROOT / "data" / "processed" / "map"
STATIONS_GEOJSON = ROOT / "data" / "processed" / "stations.geojson"
ROAD_NETWORK_GEOJSON = MAP_DIR / "road_network.geojson"
INDUSTRIAL_PROXY_GEOJSON = MAP_DIR / "industrial_activity_proxy.geojson"

# South, west, north, east. Covers the station coordinates on file.
PUNE_CONTEXT_BBOX = (18.43, 73.72, 18.70, 73.96)
OSM_SOURCE = "OpenStreetMap"
OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright"
PROXIMITY_NOTE = "Contextual distance only. Proximity is not causal proof."

CLOCK = "published_+0000"
SOURCE = "OpenCity republish of CPCB CAAQMS observations"
DATASET_URL = "https://data.opencity.in/dataset/pune-hourly-air-quality-reports"

FORECAST_METHOD = "persistence"
FORECAST_API_STATUS = "observed_baseline"
PM25_UNIT = "µg/m³"

# CPCB NAQI 24-hour PM2.5 breakpoint between Satisfactory and Moderate.
# Operational floor only. Not an official AQI calculation.
HOTSPOT_CONCENTRATION_FLOOR = 60.0
HOTSPOT_MIN_HOURS = 12
HOTSPOT_PERCENTILE = 0.75
HOTSPOT_STALE_HOURS = 48.0

STATUS_OBSERVED = "OBSERVED"
STATUS_MODELED = "MODELED"
STATUS_CITIZEN_REPORTED = "CITIZEN_REPORTED"
STATUS_PROXY = "PROXY"
STATUS_SCENARIO = "SCENARIO"
STATUS_DATA_UNAVAILABLE = "DATA_UNAVAILABLE"

DATA_STATUSES = (
    STATUS_OBSERVED,
    STATUS_MODELED,
    STATUS_CITIZEN_REPORTED,
    STATUS_PROXY,
    STATUS_SCENARIO,
    STATUS_DATA_UNAVAILABLE,
)

DataStatus = Literal[
    "OBSERVED",
    "MODELED",
    "CITIZEN_REPORTED",
    "PROXY",
    "SCENARIO",
    "DATA_UNAVAILABLE",
]

# Weather is not a source category. It stays a meteorological observation.
SOURCE_CATEGORIES = (
    "TRAFFIC",
    "INDUSTRIAL",
    "DUST_CONSTRUCTION",
)

SourceCategory = Literal["TRAFFIC", "INDUSTRIAL", "DUST_CONSTRUCTION"]
