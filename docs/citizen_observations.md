# Citizen Observations

Citizen observations allow individuals to report environmental events manually. 
They act purely as evidence and metadata for analysis and visualization.

## Constraints

Citizen reports **MUST NOT** directly modify:
- PM2.5 observations
- Production forecast
- Hotspot calculations
- Source contribution calculations

Unless a future validated methodology explicitly introduces them, they remain as separate contextual metadata.

## Report Schema

Each report captures:
- `report_id`: Unique identifier
- `category`: Activity type (e.g. `TRAFFIC`, `DUST_CONSTRUCTION`, `SMOKE_BURNING`, `INDUSTRIAL_ACTIVITY`, `UNUSUAL_ODOR`)
- `description`: Details of the event
- `latitude` / `longitude`: Location of the event
- `timestamp`: Time of the event
- `photo_url`: Optional photo reference (no computer vision processing)
- `status`: Always set to `CITIZEN_REPORTED`
- `created_at`: Time of report creation
- `source`: Always set to `citizen`

## API

- `POST /api/citizen-reports`: Create a new citizen report.
- `GET /api/citizen-reports`: Retrieve a list of reports. Supports filtering by `category`, `start` time, and `end` time.
- `GET /api/citizen-reports/clusters`: Returns spatio-temporal clusters of reports. 

## Clustering

Clusters are formed using spatial (≤ 2.0 km) and temporal (≤ 24 hours) proximity. 
They are labeled strictly as `Citizen-reported activity cluster` and are not considered ground truth.
