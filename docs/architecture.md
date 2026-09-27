# Architecture

One data path serves both portals. The frontend is not built yet.

```
REAL DATA
    OpenCity / CPCB 15-minute files
    station coordinate table where one exists
    OpenStreetMap road centerlines, when the file is present
        ↓
DATA PROCESSING
    hourly means, rainfall sums, circular wind
    published +0000 clock, not shifted
    data/processed/v2_hourly.parquet
    data/processed/map/
        ↓
SERVICES
    observations          observation_service
    24h persistence       forecast_service
    station hotspots      hotspot_service
    activity evidence     activity providers and activity_service
    contributions         source_contribution
    scenarios             scenario_service
        ↓
FUSION
    environmental_situation   GET /api/environment/{station_id}
    map collections           GET /api/map/layers
    station buffers           GET /api/zones
        ↓
FastAPI   backend/app/main.py
    /api/health
    /api/stations
    /api/observations/latest
    /api/observations/history
    /api/forecast
    /api/hotspots
    /api/activity/traffic
    /api/activity/industrial
    /api/activity/dust-construction
    /api/source-contributions/{station_id}
    /api/scenarios/simulate
    /api/scenarios/compare
    /api/environment/{station_id}
    /api/map/layers
    /api/zones
```

The contract for the fused payload is `docs/digital_twin_data_contract.md`.

## Forecast

Production method: PM2.5(T+24h) = PM2.5(T).

`GET /api/forecast` still returns `method = persistence` and `status = observed_baseline`. The fused environment record keeps that API label as `forecast_status` and marks the canonical status `MODELED`.

Research files kept, not served:

- V0 persistence
- V2-A lags only
- V2-B lags plus weather
- V2-C lags, weather, and calendar

## What each layer is allowed to say

| Layer | Status in the fused record | What it is |
| --- | --- | --- |
| Latest PM2.5 | `OBSERVED` | Hourly CPCB mean at the station |
| Persistence forecast | `MODELED`, with `forecast_status = observed_baseline` | The same concentration copied 24 hours ahead |
| Hotspot flag | `OBSERVED` | A station classification, not a new measurement |
| Road network | `OBSERVED` geometry, role `CONTEXT` | Major-road centerlines. Not traffic volume |
| Traffic volume | `DATA_UNAVAILABLE` | No count is loaded |
| Industrial polygons | `PROXY` only when the file is loaded | Industrial activity proxy. Not emissions |
| Dust / construction | `DATA_UNAVAILABLE` | No permit or site file is loaded |
| Contribution scores | `PROXY` or `DATA_UNAVAILABLE` | Evidence-weighted estimates, not causal shares |
| Citizen reports | `DATA_UNAVAILABLE` until a store exists | A future report stays `CITIZEN_REPORTED` |
| Scenario output | `SCENARIO` | An assumption applied to an evidence score |
| Station buffer | `MODELED` | A 1000 m circle. Not an administrative boundary |

## Map

`GET /api/map/layers` keeps the activity catalog and adds GeoJSON collections. PM2.5, hotspots, forecasts, and scenario results are station points. Roads stay lines. Nothing in this response paints PM2.5 along a street.

## Not in this stage

React pages, a citizen-report store, traffic counts, a PM2.5 response function for scenarios, and official municipal boundaries.
