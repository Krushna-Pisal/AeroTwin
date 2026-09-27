"""Reusable environmental records.

Each value carries its unit, time, place, source, and canonical status.
Confidence is omitted when the project has no basis for a number.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.config import CLOCK, PM25_UNIT, DataStatus, SourceCategory


class EnvironmentalObservation(BaseModel):
    value: float | None
    unit: str
    timestamp: str
    station_id: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    source: str
    status: DataStatus
    confidence: float | None = Field(default=None, ge=0, le=1)
    variable: str
    clock: str = CLOCK


class Forecast(BaseModel):
    """Domain forecast. The live route still uses status observed_baseline."""

    value: float | None
    unit: str = PM25_UNIT
    timestamp: str
    valid_timestamp: str
    station_id: str
    latitude: float | None = None
    longitude: float | None = None
    source: str
    status: DataStatus
    method: str
    api_status: str
    confidence: float | None = Field(default=None, ge=0, le=1)
    clock: str = CLOCK


class Hotspot(BaseModel):
    station_id: str
    station_name: str
    value: float | None
    unit: str = PM25_UNIT
    timestamp: str
    latitude: float | None = None
    longitude: float | None = None
    source: str
    status: DataStatus
    hotspot: bool
    rolling_24h_mean: float | None = None
    percentile: float | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    clock: str = CLOCK


class ActivityEvidence(BaseModel):
    category: SourceCategory
    value: float | None = None
    unit: str | None = None
    timestamp: str | None = None
    station_id: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    source: str | None = None
    status: DataStatus
    confidence: float | None = Field(default=None, ge=0, le=1)
    detail: str | None = None


class CitizenObservation(BaseModel):
    timestamp: str
    latitude: float
    longitude: float
    category: str
    severity: str
    source: str = "citizen"
    status: DataStatus = "CITIZEN_REPORTED"
    image_reference: str | None = None
    validation_status: str = "received"
    confidence: float | None = Field(default=None, ge=0, le=1)


class SourceContribution(BaseModel):
    """Model-derived feature contribution. Not causal source apportionment."""

    category: SourceCategory
    value: float | None = None
    unit: str | None = None
    timestamp: str | None = None
    station_id: str | None = None
    source: str
    status: DataStatus
    confidence: float | None = Field(default=None, ge=0, le=1)
    note: str


class ScenarioResult(BaseModel):
    scenario_id: str
    baseline_value: float | None
    unit: str = PM25_UNIT
    timestamp: str | None = None
    station_id: str | None = None
    intervention_parameter: dict
    modified_activity: SourceCategory | None = None
    output_value: float | None = None
    source: str
    status: DataStatus = "SCENARIO"
    assumptions: list[str]
    confidence: float | None = Field(default=None, ge=0, le=1)


class EnvironmentalSituation(BaseModel):
    timestamp: str
    station_id: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    clock: str = CLOCK
    observation: EnvironmentalObservation | None = None
    forecast: Forecast | None = None
    hotspots: list[Hotspot] = Field(default_factory=list)
    activity: list[ActivityEvidence] = Field(default_factory=list)
    citizen_observations: list[CitizenObservation] = Field(default_factory=list)
    source_contributions: list[SourceContribution] = Field(default_factory=list)
    scenario_results: list[ScenarioResult] = Field(default_factory=list)
