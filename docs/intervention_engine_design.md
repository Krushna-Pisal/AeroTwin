# Intervention engine design

No scenario is computed. This document defines the record a scenario must have before any number is shown. It does not assign a percent reduction to traffic, industry, or dust.

## Record

| Field | Required content |
| --- | --- |
| Baseline | The production forecast and the observed PM2.5 it copies, with station, timestamp, and `method = persistence` |
| Intervention parameter | A named input the user sets, such as a scale on an activity variable. The scale is an assumption, not a measurement |
| Modified activity variable | One of `traffic`, `industrial_activity_proxy`, `dust_construction`. The variable has to exist as data before it can be modified |
| Modeled output | Empty until a response function is attached. The function has to map the activity change to PM2.5 and cite the evidence for that map |
| Assumptions | Written in the record: which stations, which hours, which activity layer, and what the response function does not know |
| `status` | `MODELED` |

The type is `Scenario` in `backend/app/schemas.py`.

## Scenarios that may be added later

1. Traffic reduction, only after a traffic series exists and is labelled `OBSERVED`, `MODELED`, or `PROXY`.
2. Industrial activity reduction, only on `industrial_activity_proxy`, never as a claimed emission cut.
3. Dust and construction control, only after a construction or dust series exists.

## What is refused

- A default percentage such as "20% less traffic lowers PM2.5 by X".
- A citywide PM2.5 change with no station and no hour.
- Writing the scenario result back onto the observed PM2.5.
- Treating a citizen report as the intervention's measured effect.

Until an activity layer and a documented response function both exist, the municipal scenario screen can show the baseline only. The baseline is the persistence forecast.
