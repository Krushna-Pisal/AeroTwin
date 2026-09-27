"""Distances from a station point to mapped lines and polygons.

Results are contextual evidence. They are not a traffic volume, an emission,
or a causal source contribution.
"""

from __future__ import annotations

import math

EARTH_RADIUS_M = 6_371_000.0
LAT0 = math.radians(18.55)


def project(longitude: float, latitude: float) -> tuple[float, float]:
    """Local metres around Pune. Accurate enough for distances inside the city."""
    x = math.radians(longitude) * math.cos(LAT0) * EARTH_RADIUS_M
    y = math.radians(latitude) * EARTH_RADIUS_M
    return x, y


def _segment_distance(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    dx = bx - ax
    dy = by - ay
    length_sq = dx * dx + dy * dy
    if length_sq == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / length_sq
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def _ring_contains(x: float, y: float, ring: list[tuple[float, float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i, (xi, yi) in enumerate(ring):
        xj, yj = ring[j]
        crosses = (yi > y) != (yj > y)
        if crosses:
            x_cross = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < x_cross:
                inside = not inside
        j = i
    return inside


def distance_to_lines_m(longitude: float, latitude: float, lines: list[list[list[float]]]) -> float | None:
    """Minimum metres from a point to any LineString. Coordinates are [lon, lat]."""
    if not lines:
        return None
    px, py = project(longitude, latitude)
    best = None
    for line in lines:
        projected = [project(point[0], point[1]) for point in line if len(point) >= 2]
        for start, end in zip(projected, projected[1:]):
            distance = _segment_distance(px, py, start[0], start[1], end[0], end[1])
            if best is None or distance < best:
                best = distance
    return best


def distance_to_polygons_m(longitude: float, latitude: float, polygons: list[list[list[float]]]) -> float | None:
    """Metres to the nearest polygon. Zero when the point is inside the outer ring."""
    if not polygons:
        return None
    px, py = project(longitude, latitude)
    best = None
    for ring in polygons:
        projected = [project(point[0], point[1]) for point in ring if len(point) >= 2]
        if len(projected) < 3:
            continue
        if _ring_contains(px, py, projected):
            return 0.0
        for start, end in zip(projected, projected[1:]):
            distance = _segment_distance(px, py, start[0], start[1], end[0], end[1])
            if best is None or distance < best:
                best = distance
    return best
