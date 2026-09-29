"""Single place for paths, the production forecast, hotspot floors, and vocabularies.

The forecast route still returns status ``observed_baseline``. That word is the
frozen API label for the persistence baseline. It is not one of the canonical
data statuses.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

ROOT = Path(__file__).resolve().parents[2]


def _load_local_env(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        name, sep, value = line.strip().partition("=")
        if sep and name and not name.startswith("#"):
            os.environ.setdefault(name.strip(), value.strip().strip('"').strip("'"))


# Secrets live in backend/.env, which is gitignored. Shell variables win.
_load_local_env(ROOT / "backend" / ".env")

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
# Evidence score falls to 0.5 at this distance. It is not a pollution weight.
CONTRIBUTION_PROXIMITY_SCALE_M = 500.0
# One category score is not converted into a share of PM2.5.
CONTRIBUTION_MIN_SCORED_CATEGORIES = 2

CLOCK = "published_+0000"
SOURCE = "OpenCity republish of CPCB CAAQMS observations"
DATASET_URL = "https://data.opencity.in/dataset/pune-hourly-air-quality-reports"

# Public Pune dashboard. Kept out of the historical training table.
AQIIN_PUNE_URL = "https://www.aqi.in/in/dashboard/india/maharashtra/pune"
LIVE_SOURCE = "waqi.info"

# Free token from https://aqicn.org/data-platform/token/. Set it in backend/.env.
WAQI_TOKEN = os.environ.get("WAQI_TOKEN", "").strip()
WAQI_API_URL = "https://api.waqi.info"
OPEN_METEO_AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"

# OpenAQ republishes the same CPCB CAAQMS monitors. Kept out of the training table.
OPENAQ_API_URL = "https://api.openaq.org/v3"
OPENAQ_API_KEY = os.environ.get("OPENAQ_API_KEY", "").strip()
OPENAQ_SOURCE = "OpenAQ republish of CPCB CAAQMS"

# geoBoundaries gbOpen IND ADM1 (simplified), CC BY 2.5 IN.
MAHARASHTRA_BOUNDARY_GEOJSON = MAP_DIR / "maharashtra_boundary.geojson"
# Local OpenAQ cache so restarts do not refetch. Gitignored.
MAHARASHTRA_CACHE_JSON = ROOT / "data" / "cache" / "openaq_maharashtra.json"
MAHARASHTRA_BACKTEST_JSON = ROOT / "data" / "processed" / "maharashtra_forecast_backtest.json"

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

# Named scales for a scenario. Each value is the fraction removed from that
# category's evidence score. It is not an enforcement rate and not a PM2.5 factor.
SCENARIO_ASSUMPTION_LABEL = "SCENARIO_ASSUMPTION"
SCENARIO_SCORE_REDUCTION = {
    "LOW": 0.10,
    "MEDIUM": 0.25,
    "HIGH": 0.50,
}
INTERVENTION_CATEGORY = {
    "traffic_restriction": "TRAFFIC",
    "industrial_control": "INDUSTRIAL",
    "dust_construction_control": "DUST_CONSTRUCTION",
}

# Station-centered buffer used when no municipal boundary file is loaded.
# This is not an official administrative zone.
ZONE_RADIUS_M = 1000.0
ZONE_BASIS = (
    "Circle of 1000 m around the published station coordinate. "
    "No municipal boundary dataset is loaded."
)
