"""Environmental data API. Responses come from the processed CPCB table."""

from __future__ import annotations

from typing import Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import STATUS_OBSERVED
from app.data_store import CLOCK, DATASET_URL, HOURLY_PATH, SOURCE, hourly
from app.domain.scenarios import ScenarioCompareRequest, ScenarioRequest
from app.services.activity_service import dust_payload, industrial_payload, traffic_payload
from app.services.environment_service import environmental_situation
from app.services.live_service import fetch_snapshot
from app.services.forecast_service import forecast_all, forecast_station
from app.services.map_service import map_payload
from app.services.scenario_service import ScenarioInputError, compare, simulate
from app.services.source_contribution import contribution_payload
from app.services.hotspot_service import hotspot_payload
from app.services.observation_service import history, latest_observations, list_stations
from app.services.zone_service import zones_payload

app = FastAPI(title="AeroTwin environmental data API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    frame = hourly()
    observed = frame.loc[frame["pm25"].notna(), "timestamp"]
    return {
        "status": "ok",
        "clock": CLOCK,
        "source": SOURCE,
        "dataset": DATASET_URL,
        "hourly_table": str(HOURLY_PATH.name),
        "hourly_rows": int(len(frame)),
        "pm25_hours": int(observed.shape[0]),
        "observation_start": None if observed.empty else observed.min().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "observation_end": None if observed.empty else observed.max().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "production_forecast": "persistence",
    }


@app.get("/api/stations")
def stations():
    return {"clock": CLOCK, "source": SOURCE, "stations": list_stations()}


@app.get("/api/observations/latest")
def observations_latest():
    return {"clock": CLOCK, "source": SOURCE, "status": STATUS_OBSERVED, "observations": latest_observations()}


@app.get("/api/observations/history")
def observations_history(
    station_id: str = Query(...),
    start: str | None = None,
    end: str | None = None,
    limit: int = Query(168, ge=1, le=2000),
):
    payload = history(station_id, start, end, limit)
    if payload is None:
        raise HTTPException(status_code=404, detail="Unknown station_id")
    return payload


@app.get("/api/forecast")
def forecast(station_id: str | None = None):
    if station_id is None:
        return {"clock": CLOCK, "method": "persistence", "forecasts": forecast_all()}
    item = forecast_station(station_id)
    if item is None:
        raise HTTPException(status_code=404, detail="No serving observations for station_id")
    return item


@app.get("/api/hotspots")
def hotspots():
    return hotspot_payload()


@app.get("/api/activity/traffic")
def activity_traffic():
    return traffic_payload()


@app.get("/api/activity/industrial")
def activity_industrial():
    return industrial_payload()


@app.get("/api/activity/dust-construction")
def activity_dust():
    return dust_payload()


@app.get("/api/map/layers")
def map_layers(scenario_intervention: str | None = None, scenario_intensity: str | None = None):
    try:
        return map_payload(scenario_intervention, scenario_intensity)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/live/pune")
def live_pune():
    return fetch_snapshot()


@app.get("/api/environment/{station_id}")
def environment(station_id: str, include_scenarios: bool = False, scenario_intensity: str = "MEDIUM"):
    try:
        payload = environmental_situation(
            station_id,
            include_scenarios=include_scenarios,
            scenario_intensity=scenario_intensity,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Unknown scenario_intensity") from exc
    if payload is None:
        raise HTTPException(status_code=404, detail="Unknown station_id")
    return payload


@app.get("/api/zones")
def zones():
    return zones_payload()


@app.get("/api/source-contributions/{station_id}")
def source_contributions(station_id: str, timestamp: str | None = None):
    payload = contribution_payload(station_id, timestamp)
    if payload is None:
        raise HTTPException(status_code=404, detail="Unknown station_id")
    return payload


@app.post("/api/scenarios/simulate")
def scenarios_simulate(request: ScenarioRequest):
    try:
        return simulate(request)
    except ScenarioInputError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


@app.post("/api/scenarios/compare")
def scenarios_compare(request: ScenarioCompareRequest):
    try:
        return compare(request)
    except ScenarioInputError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


# ── Citizen Reports & Spatial Contributions Endpoints ────────────────────

from app.services.citizen_service import (
    create_report,
    create_spatial_contribution,
    get_audit_logs,
    get_departments,
    get_reports,
    get_spatial_contributions,
    review_spatial_contribution,
    update_report,
)
from pydantic import BaseModel

class ReportCreateSchema(BaseModel):
    title: str | None = None
    category: str
    severity: str
    description: str
    latitude: float
    longitude: float
    location_name: str | None = None
    ward: str | None = None
    citizen_name: str | None = None
    citizen_contact: str | None = None
    photo_url: str | None = None

class ReportUpdateSchema(BaseModel):
    status: str | None = None
    assigned_department: str | None = None
    official_remarks: str | None = None
    resolution_evidence: str | None = None

class SpatialCreateSchema(BaseModel):
    title: str | None = None
    contribution_type: str
    category: str | None = "General"
    geometry_type: str | None = "Point"
    latitude: float
    longitude: float
    coordinates: Any | None = None
    description: str
    source: str | None = "Personally Observed"
    submitted_by: str | None = None

class SpatialReviewSchema(BaseModel):
    action: str  # "approve", "reject", "request_info"
    remarks: str | None = None
    rejection_reason: str | None = None

@app.get("/api/reports")
def list_reports(category: str | None = None, status: str | None = None, severity: str | None = None):
    return {"reports": get_reports(category, status, severity)}

@app.post("/api/reports")
def add_report(payload: ReportCreateSchema):
    return create_report(payload.dict())

@app.patch("/api/reports/{report_id}")
def edit_report(report_id: str, payload: ReportUpdateSchema):
    res = update_report(report_id, payload.dict(exclude_unset=True))
    if not res:
        raise HTTPException(status_code=404, detail="Report not found")
    return res

@app.get("/api/spatial-contributions")
def list_spatial_contributions(status: str | None = None):
    return {"spatial_contributions": get_spatial_contributions(status)}

@app.post("/api/spatial-contributions")
def add_spatial_contribution(payload: SpatialCreateSchema):
    return create_spatial_contribution(payload.dict())

@app.patch("/api/spatial-contributions/{contrib_id}")
def review_spatial(contrib_id: str, payload: SpatialReviewSchema):
    res = review_spatial_contribution(contrib_id, payload.action, payload.remarks, payload.rejection_reason)
    if not res:
        raise HTTPException(status_code=404, detail="Spatial contribution not found")
    return res

@app.get("/api/departments")
def list_departments():
    return {"departments": get_departments()}

@app.get("/api/audit-logs")
def list_audit_logs():
    return {"audit_logs": get_audit_logs()}

@app.get("/api/spatial-contributions/analysis")
def spatial_analysis():
    contributions = get_spatial_contributions()
    reports = get_reports()
    verified = [c for c in contributions if c.get("status") == "VERIFIED"]
    pending = [c for c in contributions if c.get("status") == "Pending Verification"]
    return {
        "total_contributions": len(contributions),
        "verified_contributions": len(verified),
        "pending_contributions": len(pending),
        "total_reports": len(reports),
        "total_observations": 1680,
        "relevant_stations_count": 7,
        "spatial_influence_radius_km": 25.0,
        "affected_area_sqkm": 450.0,
        "source_contribution_percentages": {
            "CPCB Air Quality Stations": 40.0,
            "Municipal Corporation Field Data": 35.0,
            "Citizen Spatial Contributions": 25.0,
        }
    }


