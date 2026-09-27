"""Environmental data API. Responses come from the processed CPCB table."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import STATUS_OBSERVED
from app.data_store import CLOCK, DATASET_URL, HOURLY_PATH, SOURCE, hourly
from app.domain.scenarios import ScenarioCompareRequest, ScenarioRequest
from app.services.activity_service import dust_payload, industrial_payload, traffic_payload
from app.services.environment_service import environmental_situation
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
