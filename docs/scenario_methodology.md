# Scenario methodology

A scenario is an **assumption-based intervention simulation**.

It is not an observed change in PM2.5. It is not causal source apportionment. It does not say that an intervention cut pollution by a measured percent.

The production forecast stays persistence: PM2.5 at T+24h equals the latest observed PM2.5. Running a scenario does not write a new forecast and does not change the observed series.

## Interventions

| Request name | Category | What can be scaled |
| --- | --- | --- |
| `traffic_restriction` | `TRAFFIC` | The road-proximity evidence score, when the station has coordinates and the road layer is loaded |
| `industrial_control` | `INDUSTRIAL` | The industrial-proxy proximity score, only when that proxy geometry is loaded |
| `dust_construction_control` | `DUST_CONSTRUCTION` | Nothing in the current files. No construction or dust series is loaded |

The activity datasets are not edited. Traffic volume, emissions, and construction permits are not created in order to run the scenario.

## Intensity

`LOW`, `MEDIUM`, and `HIGH` select a reduction fraction that is applied to the category **evidence score**:

| Intensity | Reduction fraction |
| --- | --- |
| `LOW` | 0.10 |
| `MEDIUM` | 0.25 |
| `HIGH` | 0.50 |

Each fraction is returned with the label `SCENARIO_ASSUMPTION`. The label means the fraction is an input the scenario assumes. It is not an observed enforcement percentage, not a bylaw, and not a measured activity cut.

## Arithmetic

When the targeted category has an evidence score:

```text
assumed reduction of the score
    = baseline contribution × SCENARIO_ASSUMPTION

modeled contribution after intervention
    = baseline contribution − assumed reduction of the score
```

`baseline contribution` here is the evidence score from the contribution API. It is unitless. It is not micrograms and not a percent of PM2.5.

When the targeted category has no evidence score, the reduction is still reported as an assumption and is not applied. `modeled_contribution` stays null. A missing score is not replaced with zero, and it is not turned into a share of PM2.5.

`modeled_pm25`, `absolute_change`, and `percentage_change` stay null. No response function in this project maps an evidence score, or a change in that score, onto a concentration. The service will fill those three fields only when both a baseline concentration and a modeled concentration exist. A modeled concentration is not invented to make the fields numeric.

## What the endpoints return

`POST /api/scenarios/simulate` takes `station_id`, optional `zone_id`, optional `timestamp`, `intervention`, and `intensity`.

The body contains:

| Field | Content |
| --- | --- |
| `baseline` | Observed PM2.5 at the station hour, with `pm25_status = OBSERVED` when that hour exists. The production method `persistence` and API status `observed_baseline` are copied as labels. `production_forecast_modified` is false. |
| `scenario` | One scenario record. `status` is `SCENARIO`. |
| `delta` | PM2.5 deltas, which are null, and the change in the evidence score when a score existed. `status` is `SCENARIO`. |
| `assumptions` | The reduction fraction, labeled `SCENARIO_ASSUMPTION`. |
| `confidence` | `LOW` when a proximity score was scaled. Null when there was no score to scale. |
| `limitations` | Including the absence of a PM2.5 response function. |

`POST /api/scenarios/compare` takes the same station, zone, and timestamp, plus a list of intervention and intensity pairs. It returns one shared baseline, `scenarios` in the requested order, every assumption, and the same class of limitations. The list is not sorted and is not labeled with a best intervention.

`zone_id` is stored when the client sends it. No zone layer is loaded, so the calculation remains the station calculation.

## Evidence used

- The evidence-weighted contribution estimate for that station and hour: category score, category status, and category limitations.
- Observed PM2.5 at that hour, as the baseline concentration only.

The contribution methodology, including which map layers exist, is in `docs/source_contribution_methodology.md`.

## Evidence not used

- The production forecast, except to name it and to leave it unchanged.
- Weather, V2 feature importances, and citizen reports.
- A default statement of the form "this intensity lowers PM2.5 by X".

## Assumptions

- The named intensity fractions above are the only numeric intervention assumptions.
- A category without a score cannot take a modeled contribution.
- An evidence score is map context. Scaling it does not measure fewer vehicles, less industrial activity, or less dust.
- With the files currently loaded, only `TRAFFIC` at a station with coordinates can produce a modeled contribution. `INDUSTRIAL` and `DUST_CONSTRUCTION` remain without a score.

## Limitations

There is no ground-truth source apportionment and no evaluated response function from activity to PM2.5. A scenario therefore cannot support a claim that pollution fell, or would fall, by a stated percent. The baseline concentration remains the observed value. The scenario concentration is absent, and the scenario record is `SCENARIO`, not `OBSERVED`.
