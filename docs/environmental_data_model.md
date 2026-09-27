# Environmental data model

This is the shared representation for the citizen portal and the municipal portal. It is not a second database and it does not contain synthetic measurements.

Clock for CPCB observations: `published_+0000`. See `docs/timestamp_semantics.md`.

Status on every value is one of:

| Status | Meaning |
| --- | --- |
| `OBSERVED` | A measurement from a named instrument or agency series |
| `MODELED` | A calculated output, including the 24-hour persistence baseline and any future scenario |
| `PROXY` | A stand-in variable that is not the thing named in the label. Industrial activity is a proxy. It is not emissions. |
| `CITIZEN_REPORTED` | A person submitted the report. It is not ground truth and it does not change the PM2.5 forecast. |

Python types live in `backend/app/schemas.py`. Only stations, observations, the persistence forecast, and station hotspots are populated. Activity, citizen reports, and scenarios have types and no rows.

## Station

| Field | Rule |
| --- | --- |
| `station_id` | CPCB site id, such as `site_5404` |
| `station_name` | Name in the OpenCity file |
| `latitude`, `longitude` | Only when a source table publishes them. Otherwise null |
| `coordinate_status` | `source_table`, `unavailable`, or `unresolved` |
| `pm25_available` | The project holds labelled PM2.5 for this station |
| `in_serving_table` | The station is in `data/processed/v2_hourly.parquet` |
| `source` | OpenCity republish of CPCB |
| `status` | `OBSERVED` |

The registry is `backend/app/stations.py`. The map file is `data/processed/stations.geojson`.

## Observation

| Field | Rule |
| --- | --- |
| `timestamp` | Hour start on the published `+0000` clock |
| `station_id` | Station |
| `pm25` | Hourly mean of 15-minute CPCB PM2.5, µg/m³. Missing stays missing |
| `meteorology` | Hourly temperature, humidity, wind speed, circular-mean wind direction, rainfall sum, solar radiation. Included only when that station-hour observed the field |
| `source` | OpenCity / CPCB |
| `status` | `OBSERVED` |

Pressure is stored in the hourly file for audit and is not served as a weather feature. It is not a usable pressure series.

## Activity

Not populated.

| Field | Rule |
| --- | --- |
| `timestamp` | Time the activity value applies |
| `zone_id` or latitude/longitude | Where it applies. A citywide number is not given a fake point |
| `activity_type` | `traffic`, `industrial_activity_proxy`, or `dust_construction` |
| `activity_value` | Numeric only when a documented source provides it |
| `unit` | Stated with the value |
| `source` | Named dataset |
| `status` | `OBSERVED` for a count or sensor, `PROXY` for a stand-in, `MODELED` for a vendor model such as estimated traffic volume |

`industrial_activity_proxy` is never renamed to emissions.

## Citizen observation

Not populated and not connected to the forecast. Design: `docs/citizen_observation_design.md`.

## Scenario

Not populated. Design: `docs/intervention_engine_design.md`. A scenario row, when one exists, carries baseline, intervention parameter, the activity variable it would modify, modeled output, assumptions, and `status = MODELED`. No reduction percentage is stored until a response function is documented.

## Hotspot

A hotspot is a station classification, not a new measurement and not an interpolated surface. The rule is in `backend/app/services/hotspot_service.py`.

A station is a hotspot when all of the following hold:

- Latest hourly PM2.5 is at least 60 µg/m³.
- The mean of hourly PM2.5 over the preceding 24 hours is at least 60 µg/m³, with at least 12 observed hours.
- That 24-hour mean is at or above the 75th percentile among stations whose latest hour is within 48 hours of the newest network observation and which also have 12 hours in the window.

60 µg/m³ is the CPCB National Air Quality Index breakpoint between Satisfactory and Moderate for a 24-hour PM2.5 average. Using it as a floor on this hourly series is an operational rule. The service does not publish an official AQI.

## Forecast

| Field | Production value |
| --- | --- |
| `current_pm25` | Latest observed hourly PM2.5 |
| `forecast_pm25_24h` | The same number |
| `method` | `persistence` |
| `status` | `observed_baseline` |
| Map-layer `status` | `MODELED`, because the future hour was not measured |

V2-A, V2-B, and V2-C remain research artifacts. The API does not serve them.

## Map layers

| File | Contents |
| --- | --- |
| `data/processed/stations.geojson` | Station points. Dhankawadi and Karve Road have null geometry |
| `data/processed/map/current_pm25.geojson` | Latest observed hour at stations that have coordinates |
| `data/processed/map/historical_pm25.geojson` | Hourly observations for the last 14 days of the series, at stations that have coordinates |
| `data/processed/map/hotspots.geojson` | Stations that meet the hotspot rule and have coordinates |
| `data/processed/map/forecast_24h.geojson` | Persistence forecast at stations that have coordinates |

Dhankawadi has observations, a forecast, and can be a hotspot in the API. It is absent from the point files because its coordinates are unknown. On the latest hour of the series, the API flags Dhankawadi as a hotspot and the GeoJSON does not draw it. Earlier history is `GET /api/observations/history`.
