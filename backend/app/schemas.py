"""Types for the environmental data model.

Activity, citizen reports, and scenarios are schemas only. The API does not
invent rows for them.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.config import DataStatus

Status = DataStatus
Clock = Literal["published_+0000"]


class Station(BaseModel):
    station_id: str
    station_name: str
    latitude: float | None = None
    longitude: float | None = None
    coordinate_status: str
    pm25_available: bool
    source: str
    status: Status = "OBSERVED"


class Observation(BaseModel):
    timestamp: str
    station_id: str
    pm25: float | None = None
    meteorology: dict[str, float | None] = Field(default_factory=dict)
    clock: Clock = "published_+0000"
    source: str
    status: Status = "OBSERVED"


class Forecast(BaseModel):
    station_id: str
    station_name: str
    current_pm25: float | None
    forecast_pm25_24h: float | None
    method: Literal["persistence"]
    status: Literal["observed_baseline"]
    timestamp: str
    forecast_timestamp: str
    clock: Clock = "published_+0000"
    source: str


class Activity(BaseModel):
    timestamp: str
    zone_id: str
    latitude: float | None = None
    longitude: float | None = None
    activity_type: Literal["traffic", "industrial_activity_proxy", "dust_construction"]
    activity_value: float | None = None
    unit: str | None = None
    source: str
    status: Status


class CitizenObservation(BaseModel):
    timestamp: str
    latitude: float
    longitude: float
    category: Literal[
        "traffic_congestion",
        "dust_construction",
        "smoke_burning",
        "industrial_activity",
        "unusual_odour",
    ]
    severity: Literal["low", "medium", "high"]
    image_reference: str | None = None
    validation_status: Literal["received", "held", "rejected"] = "received"
    source: Literal["citizen"] = "citizen"
    status: Literal["CITIZEN_REPORTED"] = "CITIZEN_REPORTED"


class Scenario(BaseModel):
    scenario_id: str
    name: str
    baseline: dict
    intervention_parameter: dict
    modified_activity_variable: str | None = None
    modeled_output: dict | None = None
    assumptions: list[str]
    status: Literal["MODELED"] = "MODELED"
