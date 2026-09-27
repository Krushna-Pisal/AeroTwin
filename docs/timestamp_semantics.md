# Timestamp semantics

Frozen on 2026-09-28. Later scripts and the API use this convention. They do not shift the clock.

## What the files contain

The labelled OpenCity CSVs store `Timestamp` values such as `2024-01-01T00:00:00.000000+0000`. Pandas parses that offset as UTC. The project keeps that timezone-aware value.

OpenCity dataset page: https://data.opencity.in/dataset/pune-hourly-air-quality-reports

Resource example (Dhankawadi): https://data.opencity.in/dataset/pune-hourly-air-quality-reports/resource/d62efc0d-c847-4c24-a5aa-a4dd2cf8b925

The dataset additional info names the source as `airquality.cpcb.gov.in`. The resource source URL is the CPCB CCR data repository:

https://airquality.cpcb.gov.in/ccr/#/caaqm-dashboard-all/caaqm-landing/caaqm-data-repository

The OpenCity page, the resource data dictionary, and the file header do not say whether the timestamp is UTC or Indian civil time. The dictionary field is only `Timestamp`.

## Evidence

1. CPCB CAAQMS transmission protocol, Annexure I, records each 15-minute value with `Date from` and `Date to` as local clock strings with no offset. The published example is `27-04-2015 13:00` to `27-04-2015 13:15`. The protocol does not call that field UTC.

   https://app.cpcbccr.com/ccr_docs/Protocol_CAAQM.pdf

2. The OpenCity export of the same repository attaches `+0000` to every timestamp. That suffix is in the file. No accompanying note says a conversion from IST was applied, or that the suffix was added without a conversion.

3. A third-party archive of CPCB 15-minute files, Vonter/india-cpcb-aqi `DATA.md`, describes the timestamp as UTC. That is a downstream description of a similar extract. It is not a field definition on the OpenCity resource or in the CAAQMS protocol.

   https://github.com/Vonter/india-cpcb-aqi/blob/main/DATA.md

4. On the six-station hourly table, median PM2.5 by the published hour peaks near hour 8 (42.16 µg/m³) and hours 21–22 (39.80 and 40.34) and bottoms at hour 15 (27.44). The table is in `docs/meteorology_data_audit.md`. That shape matches a local morning peak, afternoon low, and evening rise. It would not match that local cycle if the numbers were UTC and the local clock were 5 hours 30 minutes later. This is evidence about the diurnal pattern. It is not a CPCB statement.

## Conclusion

`+0000` is the offset written in the OpenCity file. It has not been shown to be a real UTC conversion of an IST measurement, and it has not been shown to be only a formatting suffix.

Conversion to IST is not justified. No source note for this export says the numbers were shifted, and no source note says they must be shifted.

## Uncertainty

Unresolved. The station protocol implies civil time at the station and shows no offset. The file shows `+0000`. A third-party archive calls the 15-minute field UTC. Those statements disagree. The diurnal pattern supports reading the hour numbers as Indian civil time, and that remains an inference.

## Treatment used by the project

- Parse the published offset and store timezone-aware `+0000` timestamps.
- Do not add or subtract 5 hours 30 minutes.
- Do not relabel the column as confirmed IST or as confirmed UTC.
- Use this same clock for air quality, meteorology stored in these files, lag creation, train/validation/test cuts, the forecast service, and the API.
- API responses include `"clock": "published_+0000"`.
- If an external series is joined later, its clock is recorded separately. It is not assumed to match this one.
