"""Station-centered zones.

No official boundary dataset is loaded. Each zone is a circle around a
published station coordinate, or unavailable when that coordinate is missing.
"""

from __future__ import annotations

from app.config import STATUS_DATA_UNAVAILABLE, STATUS_MODELED, ZONE_BASIS, ZONE_RADIUS_M
from app.spatial import circle_ring
from app.stations import STATIONS


def zones_payload() -> dict:
    zones = []
    for station in STATIONS:
        has_point = station["latitude"] is not None and station["longitude"] is not None
        geometry = None
        if has_point:
            geometry = {
                "type": "Polygon",
                "coordinates": [circle_ring(station["longitude"], station["latitude"], ZONE_RADIUS_M)],
            }
        zones.append(
            {
                "zone_id": f"station:{station['station_id']}",
                "station_id": station["station_id"],
                "station_name": station["station_name"],
                "name": f"{station['station_name']} station buffer",
                "basis": ZONE_BASIS,
                "radius_m": ZONE_RADIUS_M if has_point else None,
                "official_administrative_zone": False,
                "geometry": geometry,
                "status": STATUS_MODELED if has_point else STATUS_DATA_UNAVAILABLE,
            }
        )
    return {
        "basis": ZONE_BASIS,
        "official_administrative_zones": False,
        "boundary_dataset": None,
        "radius_m": ZONE_RADIUS_M,
        "status": STATUS_MODELED,
        "zones": zones,
    }
