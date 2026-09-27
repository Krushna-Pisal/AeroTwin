"""Assumption-based intervention scenarios.

The production forecast is not read for writing and is not replaced.
A scenario scales one category evidence score when that score exists:

    modeled contribution = baseline contribution
        - (baseline contribution × scenario reduction assumption)

The reduction is labeled SCENARIO_ASSUMPTION. It is not an observed
enforcement rate. The evidence score is not a fraction of PM2.5, so this
service does not emit a modeled concentration.
"""

from __future__ import annotations

import pandas as pd

from app.config import (
    FORECAST_API_STATUS,
    FORECAST_METHOD,
    INTERVENTION_CATEGORY,
    PM25_UNIT,
    SCENARIO_ASSUMPTION_LABEL,
    SCENARIO_SCORE_REDUCTION,
    STATUS_DATA_UNAVAILABLE,
    STATUS_OBSERVED,
    STATUS_SCENARIO,
)
from app.domain.scenarios import (
    ScenarioCompareRequest,
    ScenarioComparison,
    ScenarioRequest,
    ScenarioResult,
)
from app.services.source_contribution import NOT_CAUSAL, contribution_payload
from app.stations import by_id

NO_RESPONSE = (
    "No response function maps an evidence score onto PM2.5. "
    "modeled_pm25, absolute_change, and percentage_change are omitted."
)
NOT_ENFORCEMENT = (
    "LOW, MEDIUM, and HIGH are names for scenario assumptions. "
    "They are not observed enforcement percentages."
)
NOT_RANKED = "Scenarios are listed in the requested order and are not ranked."


class ScenarioInputError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


def apply_score_reduction(baseline_contribution: float | None, reduction_assumption: float) -> tuple[float | None, float | None]:
    """Return (assumed score reduction, modeled contribution).

    Both are null when the baseline contribution is null. A missing score is
    not treated as zero.
    """
    if baseline_contribution is None:
        return None, None
    modeled = round(float(baseline_contribution) * (1.0 - float(reduction_assumption)), 4)
    removed = round(float(baseline_contribution) - modeled, 4)
    return removed, modeled


def pm25_changes(baseline_pm25: float | None, modeled_pm25: float | None) -> tuple[float | None, float | None]:
    """Absolute and fractional PM2.5 change. Null unless both concentrations exist."""
    if baseline_pm25 is None or modeled_pm25 is None:
        return None, None
    absolute = round(float(modeled_pm25) - float(baseline_pm25), 4)
    if float(baseline_pm25) == 0:
        return absolute, None
    percentage = round((float(modeled_pm25) - float(baseline_pm25)) / float(baseline_pm25), 4)
    return absolute, percentage


def _load_context(station_id: str, timestamp: str | None) -> dict:
    station = by_id(station_id)
    if station is None:
        raise ScenarioInputError(404, "Unknown station_id")
    try:
        payload = contribution_payload(station_id, timestamp)
    except (ValueError, pd.errors.ParserError) as exc:
        raise ScenarioInputError(400, "Unreadable timestamp") from exc
    if payload is None:
        raise ScenarioInputError(404, "Unknown station_id")
    return payload


def _baseline(payload: dict, zone_id: str | None) -> dict:
    pm25 = payload["pm25"]
    return {
        "station_id": payload["station_id"],
        "station_name": payload["station_name"],
        "zone_id": zone_id,
        "timestamp": payload["timestamp"],
        "pm25": pm25,
        "pm25_unit": PM25_UNIT,
        "pm25_status": None if pm25 is None else STATUS_OBSERVED,
        "production_forecast_method": FORECAST_METHOD,
        "production_forecast_status": FORECAST_API_STATUS,
        "production_forecast_modified": False,
    }


def _assumption(intervention: str, intensity: str, reduction: float, category: str) -> dict:
    return {
        "label": SCENARIO_ASSUMPTION_LABEL,
        "name": "evidence_score_reduction_fraction",
        "value": reduction,
        "intensity": intensity,
        "intervention": intervention,
        "category": category,
        "statement": (
            f"{intensity} assumes the {category} evidence score is reduced by {reduction:.2f} "
            "of its baseline. This is a SCENARIO_ASSUMPTION, not an observed enforcement "
            "percentage, and it is not a change in PM2.5."
        ),
    }


def _shared_limitations(zone_id: str | None) -> list[str]:
    rows = [
        NOT_CAUSAL,
        NOT_ENFORCEMENT,
        NO_RESPONSE,
        "The production forecast remains persistence and is not modified.",
        "Citizen reports are not an intervention effect.",
        "Weather is not an intervention.",
    ]
    if zone_id:
        rows.append(
            "No zone geometry is loaded. zone_id is recorded and the scenario is evaluated at the station."
        )
    return rows


def _scenario(request: ScenarioRequest, payload: dict, index: int = 0) -> ScenarioResult:
    category_name = INTERVENTION_CATEGORY[request.intervention]
    category = next(row for row in payload["categories"] if row["category"] == category_name)
    reduction = SCENARIO_SCORE_REDUCTION[request.intensity]
    baseline_contribution = category["score"]
    _removed, modeled_contribution = apply_score_reduction(baseline_contribution, reduction)
    absolute_change, percentage_change = pm25_changes(payload["pm25"], None)
    limitations = list(category["limitations"])
    if baseline_contribution is None:
        limitations.append(
            "This category has no evidence score, so the reduction assumption is not applied and no share is created."
        )
    else:
        limitations.append(
            "The modeled contribution is the evidence score after the scenario assumption. It is not micrograms and not a percent of PM2.5."
        )
    limitations.append(NO_RESPONSE)
    stamp = payload["timestamp"] or "unspecified"
    return ScenarioResult(
        scenario_id=f"{payload['station_id']}:{request.intervention}:{request.intensity}:{stamp}:{index}",
        station_id=payload["station_id"],
        zone_id=request.zone_id,
        baseline_timestamp=payload["timestamp"],
        intervention_type=request.intervention,
        intervention_intensity=request.intensity,
        category=category_name,
        baseline_pm25=payload["pm25"],
        modeled_pm25=None,
        absolute_change=absolute_change,
        percentage_change=percentage_change,
        baseline_contribution=baseline_contribution,
        reduction_assumption=reduction,
        reduction_assumption_label=SCENARIO_ASSUMPTION_LABEL,
        modeled_contribution=modeled_contribution,
        assumptions=[_assumption(request.intervention, request.intensity, reduction, category_name)],
        confidence=None if baseline_contribution is None else "LOW",
        status=STATUS_SCENARIO,
        source_evidence_status=category["status"] if category["status"] else STATUS_DATA_UNAVAILABLE,
        limitations=limitations,
    )


def _delta(result: ScenarioResult) -> dict:
    contribution_change = None
    if result.baseline_contribution is not None and result.modeled_contribution is not None:
        contribution_change = round(result.modeled_contribution - result.baseline_contribution, 4)
    return {
        "status": STATUS_SCENARIO,
        "absolute_change": result.absolute_change,
        "percentage_change": result.percentage_change,
        "contribution_absolute_change": contribution_change,
        "formula": (
            "modeled_contribution = baseline_contribution - "
            "(baseline_contribution × SCENARIO_ASSUMPTION reduction fraction)"
        ),
    }


def simulate(request: ScenarioRequest) -> dict:
    payload = _load_context(request.station_id, request.timestamp)
    result = _scenario(request, payload)
    limitations = _shared_limitations(request.zone_id) + [
        item for item in result.limitations if item not in _shared_limitations(request.zone_id)
    ]
    return {
        "station_id": payload["station_id"],
        "zone_id": request.zone_id,
        "baseline": _baseline(payload, request.zone_id),
        "scenario": result.model_dump(),
        "delta": _delta(result),
        "assumptions": result.assumptions,
        "confidence": result.confidence,
        "limitations": limitations,
    }


def compare(request: ScenarioCompareRequest) -> dict:
    payload = _load_context(request.station_id, request.timestamp)
    scenarios = []
    assumptions = []
    for index, choice in enumerate(request.interventions):
        single = ScenarioRequest(
            station_id=request.station_id,
            zone_id=request.zone_id,
            timestamp=request.timestamp,
            intervention=choice.intervention,
            intensity=choice.intensity,
        )
        result = _scenario(single, payload, index)
        scenarios.append(result)
        assumptions.extend(result.assumptions)
    limitations = _shared_limitations(request.zone_id) + [NOT_RANKED, NO_RESPONSE]
    comparison = ScenarioComparison(
        station_id=payload["station_id"],
        zone_id=request.zone_id,
        baseline_timestamp=payload["timestamp"],
        baseline=_baseline(payload, request.zone_id),
        scenarios=scenarios,
        assumptions=assumptions,
        limitations=limitations,
    )
    return comparison.model_dump()
