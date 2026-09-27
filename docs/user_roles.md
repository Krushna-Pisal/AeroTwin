# Citizen and municipal use

There is one backend, one hourly table, one forecast method, and one hotspot rule. The citizen portal and the municipal portal are two views of that service. They are not two applications and not two models.

## Citizen

The citizen view shows:

- Current PM2.5 at the stations, labelled `OBSERVED`
- The station or stations nearest the place the person asked about, without inventing a street value
- The 24-hour forecast, labelled persistence / `observed_baseline`
- The hotspot map, labelled as station hotspots, not as a continuous surface
- A short statement of what the number is: the latest hourly mean, and a forecast that repeats it 24 hours ahead
- The citizen report form described in `docs/citizen_observation_design.md`

The citizen view does not show feature-attribution charts, scenario parameters, or activity layers that do not exist yet.

## Municipal

The municipal view shows everything the citizen view shows, and also:

- The full station registry, including stations with no coordinates and stations held out of the serving table
- Hotspot diagnostics: latest value, 24-hour mean, percentile, trend, and whether the station was eligible
- The forecast method and the fact that V2 was not promoted
- Model-derived feature notes from the V2 research evaluation, with the statement that they are not causal source apportionment
- Activity layers when a real file exists, with `OBSERVED`, `MODELED`, or `PROXY` on each feature
- Citizen observations as `CITIZEN_REPORTED`, separate from the sensors
- The scenario screen described in `docs/intervention_engine_design.md`, which does not yet emit a reduction
- Historical station series for validation
- The clock note and the other assumptions in `docs/timestamp_semantics.md` and `docs/environmental_data_model.md`

## Shared engine

Both views call the same routes:

- `GET /api/stations`
- `GET /api/observations/latest`
- `GET /api/observations/history`
- `GET /api/forecast`
- `GET /api/hotspots`

A municipal screen may request more fields from those payloads. It does not query a different model.
