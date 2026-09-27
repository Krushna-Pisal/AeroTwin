# Citizen observation design

Citizen reports are not in the forecast and they are not training rows. The type is `CitizenObservation` in `backend/app/schemas.py`. No report store is filled with example data.

## What a report is

Status is always `CITIZEN_REPORTED`. Source is always `citizen`. A report is a claim by a person about something they saw or smelled. It is not a PM2.5 measurement and it is not ground truth.

## Categories

1. Traffic congestion
2. Dust / construction
3. Smoke / burning
4. Industrial activity
5. Unusual odour

## Fields

| Field | Rule |
| --- | --- |
| `timestamp` | When the person says the condition was present. Stored with an explicit offset. Not assumed to be the CPCB clock until the client sends one |
| `latitude`, `longitude` | Approximate. The client should not present it as a surveyed point |
| `category` | One of the five names above |
| `severity` | `low`, `medium`, or `high`, as chosen by the reporter |
| `image_reference` | Optional pointer to a stored photo. The photo is evidence attached to the report, not a sensor |
| `validation_status` | `received`, `held`, or `rejected`. Initial value is `received` |
| `source` | `citizen` |
| `status` | `CITIZEN_REPORTED` |

## What the forecast is allowed to do

Nothing, in this version. One report, or many reports, must not change `forecast_pm25_24h`. The production forecast remains persistence of the station observation.

## Later aggregation, not built

If reports are summarised on a map later, the summary can count:

- distinct reports, not one person counted many times in a few minutes
- distance to a station or to a zone
- time separation from the CPCB hour
- whether a photo was attached
- whether the station PM2.5 moved in the same hour

That summary stays `CITIZEN_REPORTED`. It can be shown next to the sensor. It is not written back into the sensor table and it is not a feature of the production forecast until a separate, documented experiment says so.
