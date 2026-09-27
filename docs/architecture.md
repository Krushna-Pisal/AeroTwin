# Architecture

One data path serves both portals. The frontend is not built yet.

```
REAL DATA
    OpenCity / CPCB 15-minute files
    station coordinate table where one exists
        ↓
DATA PROCESSING
    hourly means, rainfall sums, circular wind
    published +0000 clock, not shifted
    data/processed/v2_hourly.parquet
        ↓
ENVIRONMENTAL DATA MODEL
    docs/environmental_data_model.md
    backend/app/schemas.py
        ↓
ENVIRONMENTAL INTELLIGENCE
    PM2.5 observations     observation_service
    24h persistence        forecast_service
    station hotspots       hotspot_service
    weather fields         only where the station observed them
    activity layers        not loaded; options are documented
    citizen observations   schema only
    scenario engine        design only; no effect size
        ↓
FastAPI   backend/app/main.py
    /api/health
    /api/stations
    /api/observations/latest
    /api/observations/history
    /api/forecast
    /api/hotspots
        ↓
    citizen view          municipal view
    same routes           same routes, more of the payload
```

## Forecast

Production method: PM2.5(T+24h) = PM2.5(T).

Research files kept, not served:

- V0 persistence
- V2-A lags only
- V2-B lags plus weather
- V2-C lags, weather, and calendar

## Map files

`data/processed/stations.geojson` and `data/processed/map/`. Each feature carries `source`, `timestamp` where it is an observation or a forecast, and `status`.

## Not in this stage

React pages, traffic, industrial proxies, dust values, citizen report storage, and scenario numbers.
