"""Scenario records for assumption-based intervention simulations.

These types describe a labeled scenario. They do not record an observed
concentration change.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

InterventionType = Literal[
    "traffic_restriction",
    "industrial_control",
    "dust_construction_control",
]
InterventionIntensity = Literal["LOW", "MEDIUM", "HIGH"]


class ScenarioRequest(BaseModel):
    station_id: str
    zone_id: str | None = None
    timestamp: str | None = None
    intervention: InterventionType
    intensity: InterventionIntensity


class InterventionChoice(BaseModel):
    intervention: InterventionType
    intensity: InterventionIntensity


class ScenarioCompareRequest(BaseModel):
    station_id: str
    zone_id: str | None = None
    timestamp: str | None = None
    interventions: list[InterventionChoice] = Field(min_length=1, max_length=9)


class ScenarioResult(BaseModel):
    scenario_id: str
    station_id: str
    zone_id: str | None = None
    baseline_timestamp: str | None
    intervention_type: InterventionType
    intervention_intensity: InterventionIntensity
    category: str
    baseline_pm25: float | None
    modeled_pm25: float | None
    absolute_change: float | None
    percentage_change: float | None
    baseline_contribution: float | None
    reduction_assumption: float
    reduction_assumption_label: Literal["SCENARIO_ASSUMPTION"]
    modeled_contribution: float | None
    assumptions: list[dict]
    confidence: Literal["LOW"] | None
    status: Literal["SCENARIO"]
    source_evidence_status: str
    limitations: list[str]


class ScenarioComparison(BaseModel):
    station_id: str
    zone_id: str | None = None
    baseline_timestamp: str | None
    baseline: dict
    scenarios: list[ScenarioResult]
    assumptions: list[dict]
    limitations: list[str]
