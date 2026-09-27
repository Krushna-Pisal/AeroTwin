"""Activity providers share one method and return no fabricated values."""

from __future__ import annotations

import json
from typing import Protocol

from app.config import INDUSTRIAL_PROXY_GEOJSON, OSM_SOURCE, STATUS_DATA_UNAVAILABLE, STATUS_PROXY, SourceCategory
from app.domain.schemas import ActivityEvidence


class ActivityProvider(Protocol):
    category: SourceCategory

    def get_activity(
        self,
        *,
        timestamp: str | None = None,
        station_id: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> ActivityEvidence:
        """Return evidence for this category, or DATA_UNAVAILABLE with value None."""


class _UnavailableProvider:
    category: SourceCategory
    detail: str

    def get_activity(
        self,
        *,
        timestamp: str | None = None,
        station_id: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> ActivityEvidence:
        return ActivityEvidence(
            category=self.category,
            value=None,
            unit=None,
            timestamp=timestamp,
            station_id=station_id,
            latitude=latitude,
            longitude=longitude,
            source=None,
            status=STATUS_DATA_UNAVAILABLE,
            confidence=None,
            detail=self.detail,
        )


class TrafficActivityProvider(_UnavailableProvider):
    category = "TRAFFIC"
    detail = (
        "No traffic count, probe speed, or modeled volume is loaded. "
        "See docs/traffic_data_options.md."
    )


class IndustrialActivityProvider:
    category = "INDUSTRIAL"

    def get_activity(
        self,
        *,
        timestamp: str | None = None,
        station_id: str | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> ActivityEvidence:
        loaded = _industrial_polygons_loaded()
        if not loaded:
            return ActivityEvidence(
                category=self.category,
                value=None,
                unit=None,
                timestamp=timestamp,
                station_id=station_id,
                latitude=latitude,
                longitude=longitude,
                source=None,
                status=STATUS_DATA_UNAVAILABLE,
                confidence=None,
                detail=(
                    "No industrial_activity_proxy layer is loaded. "
                    "GatiShakti park boundaries and MIDC parcel geometries were not retrieved. "
                    "See docs/industrial_data_options.md."
                ),
            )
        return ActivityEvidence(
            category=self.category,
            value=None,
            unit=None,
            timestamp=timestamp,
            station_id=station_id,
            latitude=latitude,
            longitude=longitude,
            source=OSM_SOURCE,
            status=STATUS_PROXY,
            confidence=None,
            detail=(
                "Industrial activity proxy from OSM landuse=industrial polygons. "
                "Not emissions and not a source contribution."
            ),
        )


class DustConstructionActivityProvider(_UnavailableProvider):
    category = "DUST_CONSTRUCTION"
    detail = (
        "No construction-permit or dust series is loaded. "
        "See docs/dust_construction_data_options.md."
    )


def _industrial_polygons_loaded() -> bool:
    if not INDUSTRIAL_PROXY_GEOJSON.is_file():
        return False
    payload = json.loads(INDUSTRIAL_PROXY_GEOJSON.read_text(encoding="utf-8"))
    return bool(payload.get("features"))


def activity_providers() -> list[ActivityProvider]:
    return [
        TrafficActivityProvider(),
        IndustrialActivityProvider(),
        DustConstructionActivityProvider(),
    ]
