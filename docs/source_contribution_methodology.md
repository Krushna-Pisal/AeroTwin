# Source contribution methodology

The estimate is an **evidence-weighted contribution estimate**.

It is not causal source apportionment. It does not say what percent of PM2.5 comes from traffic, industry, or dust.

## What is calculated

For each station the API returns three categories, in this order: `TRAFFIC`, `INDUSTRIAL`, `DUST_CONSTRUCTION`.

| Field | Meaning |
| --- | --- |
| `score` | Unitless evidence score from 0 to 1, or null. It is not micrograms and not a percent of PM2.5. |
| `normalized_share` | Share of the evidence scores, or null. It is filled only when at least two categories have a score. |
| `confidence` | `LOW` when the score is road or polygon proximity. Null when the category is unavailable. `MEDIUM` and `HIGH` are not used. |
| `status` | `PROXY` when the score comes from map proximity. `DATA_UNAVAILABLE` when that category has no usable evidence. |
| `evidence` | The inputs that were actually present or explicitly missing. |
| `limitations` | What the row does not support. |

`normalized_share` values, when they exist, sum to 1 across the categories that have a score. A category with no score keeps a null share. One available score is left unnormalized so it cannot be read as 100% of pollution.

The proximity score is `1 / (1 + distance_m / 500)`. It is 1 on the mapped feature and 0.5 at 500 metres. The same function is used for every category that has geometry.

## Evidence used

- Station coordinates, where the registry has them.
- Distance to the OpenStreetMap road centerlines in `data/processed/map/road_network.geojson` (motorway, trunk, primary, secondary). Those lines are `ROAD_NETWORK` / `CONTEXT`. They are not traffic volume and not congestion.
- Distance to `industrial_activity_proxy` polygons, only if that file is loaded. It is not loaded in the current repository. The label remains **Industrial activity proxy**. It is not emissions and not a source contribution.
- The dust/construction provider. It returns `DATA_UNAVAILABLE`. No sites are created.
- The traffic-volume provider. It returns `DATA_UNAVAILABLE`. The road distance does not replace a count.

Observed PM2.5 at the requested hour, or the latest hour if no timestamp is given, is included beside the categories as context. It is not split across them. The timestamp does not change the proximity scores, because the road and industrial layers are snapshots rather than hourly activity.

## Evidence not used

- Weather. It is not a source category, and it is not used to push PM2.5 onto a category.
- V2 feature importances. Those values describe a forecast model that was not promoted. They are importances of lags and meteorology, not shares for these three categories.
- Citizen reports. None are loaded.
- GatiShakti boundaries, MIDC parcels, traffic counts, and construction permits. They were not retrieved.

## Assumptions

- A nearer mapped road or industrial polygon is stronger context than a farther one. That is a scale choice of 500 metres, not a measured emissions factor.
- Major-road classes stand in for the road network that was downloaded. Residential streets are not in the file.
- Absence of an industrial or dust layer means the category is unavailable, not that the category's contribution is zero.

## Limitations

There are no ground-truth source-apportionment measurements in this project. Proximity is not causal proof. A `normalized_share` is not a statement of the form "X% of pollution comes from traffic". With the files currently loaded, only road proximity can produce a score, so the API reports that score with confidence `LOW` and leaves every `normalized_share` null.
