# Digital twin data contract

`GET /api/environment/{station_id}` is the station-detail payload. It is assembled by `environmental_situation` in `backend/app/services/environment_service.py`. The function calls the observation, forecast, hotspot, contribution, and scenario services. It does not replace their calculations.

The earlier typed record in `backend/app/domain/schemas.py` remains the phase-1 model. The live payload uses the field names below.

## Flow

```
v2_hourly.parquet
    latest PM2.5 hour          current_observation   OBSERVED
    aqi.in Pune page           live_reading          OBSERVED or DATA_UNAVAILABLE
    same hour, copied +24h     forecast              MODELED
    hotspot rule on that hour  hotspot               OBSERVED
meteorology on that hour       weather               OBSERVED or DATA_UNAVAILABLE
road file, industrial file,
dust provider                  activity
contribution service           source_contributions
empty report store             citizen_reports       DATA_UNAVAILABLE
counts from the hourly table   data_quality
scenario service, on request   scenario_availability SCENARIO
```

Clock on CPCB hours: `published_+0000`.

## Environment fields

| Field | Source | Status rule |
| --- | --- | --- |
| `station` | Station registry | `OBSERVED` for a known station id |
| `zone` | Station-centered buffer | `MODELED` when coordinates exist. `DATA_UNAVAILABLE` when they do not. `official_administrative_zone` is false |
| `timestamp` | Latest PM2.5 hour for that station | Null when the station is outside the serving table |
| `current_observation` | `latest_observations` | `OBSERVED` with a concentration, or `DATA_UNAVAILABLE`. This is the last stored CPCB hour, not a live feed |
| `live_reading` | Public aqi.in Pune dashboard | `OBSERVED` only when that page lists a PM2.5 concentration under the same place name. `DATA_UNAVAILABLE` when the monitor is absent or the page cannot be read. `same_monitor` is false. The city figure is not copied onto an unlisted station. The archive and the persistence forecast are unchanged |
| `forecast` | `forecast_station` | `MODELED` when a serving hour exists. `forecast_status` remains `observed_baseline`. `DATA_UNAVAILABLE` otherwise. The value equals the latest observation |
| `hotspot` | `station_diagnostics` | `OBSERVED` when the station is scored. `DATA_UNAVAILABLE` when it is not in the hourly table |
| `activity` | Road file, industrial file, and the three providers | Traffic volume `DATA_UNAVAILABLE`. Road context `OBSERVED` when the road file is loaded. Industrial `PROXY` only when polygons are loaded. Dust `DATA_UNAVAILABLE` |
| `source_contributions` | `contribution_payload` | Same categories, scores, and null shares as `GET /api/source-contributions/{station_id}` |
| `citizen_reports` | No store | `DATA_UNAVAILABLE`, `reports` empty |
| `weather` | Meteorological columns on the latest PM2.5 hour | Each field is `OBSERVED` or `DATA_UNAVAILABLE`. Weather is not a source category |
| `data_quality` | Counts and presence flags | Coverage, weather, coordinates, activity, and citizen reports, each with its own status |
| `scenario_availability` | Scenario catalog | `status` is `SCENARIO`. `results` stay null unless `include_scenarios=true` |
| `limitations` | Statements from the services above | Includes the buffer basis and the contribution disclaimer |
| `interpolation` | None | Station PM2.5 is not spread onto roads or between stations |

`include_scenarios=true` runs the compare endpoint for traffic restriction, industrial control, and dust/construction control at `scenario_intensity` (default `MEDIUM`). Those rows stay `SCENARIO`. The production forecast route is not written.

## Data quality

For each station the payload reports:

- PM2.5 hours present in the serving table, hours with a value, and the coverage fraction
- How many weather fields are present on the latest PM2.5 hour
- Whether a published coordinate exists
- Whether traffic volume, road context, the industrial proxy, and dust evidence are loaded
- Whether any citizen report is stored

A missing series is `DATA_UNAVAILABLE`. The fraction is omitted when the station has no rows. It is not filled with zero to imply a measured share of pollution.

## Map

`GET /api/map/layers` still returns the activity `layers` catalog from phase 2. It also returns `collections`:

| Collection | Geometry | Status |
| --- | --- | --- |
| `stations` | Point, or null geometry when the coordinate is missing | `OBSERVED` |
| `current_pm25` | Point at stations that have both a coordinate and a latest hour | `OBSERVED` |
| `hotspots` | Point at hotspot stations that have a coordinate | `OBSERVED` |
| `forecast` | Point at serving stations that have a coordinate | `MODELED`, `forecast_status = observed_baseline` |
| `industrial_proxy` | Loaded polygons, or an empty collection | `PROXY` or `DATA_UNAVAILABLE` |
| `road_context` | Loaded highway centerlines | `OBSERVED` context. `measures_traffic` is false. Properties are not given a PM2.5 value |
| `citizen_reports` | Empty | `DATA_UNAVAILABLE` |
| `scenario_results` | Empty unless requested | With `scenario_intervention` and `scenario_intensity`, one station point per coordinate, status `SCENARIO` |

Dhankawadi and any other station without a coordinate are omitted from the point collections. They remain available from `GET /api/environment/{station_id}`.

## Zones

`GET /api/zones` returns one zone per registry station.

The basis is a circle of 1000 m around the published station coordinate. `backend/app/config.py` stores that radius and the basis sentence. No municipal boundary file is loaded. The zones are not official administrative zones. A station without a coordinate gets a zone id and a null geometry with status `DATA_UNAVAILABLE`.

## Status vocabulary

Every nested value uses one of:

`OBSERVED`, `MODELED`, `PROXY`, `CITIZEN_REPORTED`, `SCENARIO`, `DATA_UNAVAILABLE`.

The forecast route's frozen label `observed_baseline` is carried beside the canonical status. It is not used as the canonical status inside the fused record.

## What this contract refuses

- A street-level PM2.5 surface
- A claim that a contribution score is a percent of pollution
- A scenario concentration without a documented response function
- A citizen report that changes `forecast_pm25_24h`
- An official ward or municipal polygon that the project does not hold
