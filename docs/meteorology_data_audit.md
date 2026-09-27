# Meteorology data audit

Source: every labelled 15-minute CPCB file in `data/raw/air_quality/` at audit time. Statistics are raw rows after numeric parsing. Empty cells stay empty. Units are the header units. No unit was converted. The saved forecast model was fit on the original six stations only; extra stations here are inventory, not a retrained model.

Headers in the CKAN datastore are `AT (degC)`, `RH (%)`, `WS (m/s)`, `WD (deg)`, `RF (mm)`, `TOT-RF (mm)`, `SR (W/mt2)`, `BP (mmHg)`.

## Field summary

| Field | Header unit | Non-null rows | Unique values | Min | Median | Max | Missing % | Stations with any value | First non-null | Last non-null |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| temperature | AT (degC) | 207479 | 3501 | 6.54 | 25.60 | 58.47 | 67.80 | 4 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:45:00+00:00 |
| humidity | RH (%) | 233656 | 8813 | 0.03 | 59.95 | 99.97 | 63.74 | 5 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:45:00+00:00 |
| wind_speed | WS (m/s) | 206146 | 2712 | 0.01 | 0.68 | 50.00 | 68.01 | 5 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:45:00+00:00 |
| wind_direction | WD (deg) | 197223 | 33676 | 0.01 | 197.90 | 359.99 | 69.39 | 5 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:45:00+00:00 |
| rainfall | RF (mm) | 210866 | 79 | 0.00 | 0.00 | 38.00 | 67.27 | 4 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:45:00+00:00 |
| solar_radiation | SR (W/mt2) | 160795 | 7576 | 0.00 | 14.60 | 893.10 | 75.05 | 4 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:45:00+00:00 |
| pressure | BP (mmHg) | 19587 | 4719 | 700.15 | 876.01 | 1099.37 | 96.96 | 1 | 2024-01-01 00:00:00+00:00 | 2025-03-12 10:45:00+00:00 |
| total_rainfall | TOT-RF (mm) | 350880 | 79 | 0.00 | 0.00 | 38.00 | 45.55 | 5 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:45:00+00:00 |

## Flags

- temperature: 207479 non-null values, 3501 distinct, missing 67.80%, stations with any value: Savitribai Phule Pune University, Pune - MPCB, Katraj Dairy, Pune - MPCB, Bhumkar Nagar, Pune - IITM, Panchawati_Pashan, Pune - IITM.
- humidity: 233656 non-null values, 8813 distinct, missing 63.74%, stations with any value: Savitribai Phule Pune University, Pune - MPCB, Katraj Dairy, Pune - MPCB, Bhumkar Nagar, Pune - IITM, Panchawati_Pashan, Pune - IITM, Karve Road, Pune - MPCB.
- wind_speed: 206146 non-null values, 2712 distinct, missing 68.01%, stations with any value: Savitribai Phule Pune University, Pune - MPCB, Katraj Dairy, Pune - MPCB, Karve Road, Pune - MPCB, Panchawati_Pashan, Pune - IITM, Bhumkar Nagar, Pune - IITM.
- wind_direction: 197223 non-null values, 33676 distinct, missing 69.39%, stations with any value: Savitribai Phule Pune University, Pune - MPCB, Katraj Dairy, Pune - MPCB, Panchawati_Pashan, Pune - IITM, Karve Road, Pune - MPCB, Bhumkar Nagar, Pune - IITM.
- rainfall: 210866 non-null values, 79 distinct, missing 67.27%, stations with any value: Savitribai Phule Pune University, Pune - MPCB, Katraj Dairy, Pune - MPCB, Bhumkar Nagar, Pune - IITM, Panchawati_Pashan, Pune - IITM.
- solar_radiation: 160795 non-null values, 7576 distinct, missing 75.05%, stations with any value: Savitribai Phule Pune University, Pune - MPCB, Katraj Dairy, Pune - MPCB, Bhumkar Nagar, Pune - IITM, Karve Road, Pune - MPCB.
- pressure: 19587 non-null values, 4719 distinct, missing 96.96%, stations with any value: Karve Road, Pune - MPCB.
- total_rainfall: 350880 non-null values, 79 distinct, missing 45.55%, stations with any value: Bhumkar Nagar, Pune - IITM, Savitribai Phule Pune University, Pune - MPCB, Katraj Dairy, Pune - MPCB, Karve Road, Pune - MPCB, Panchawati_Pashan, Pune - IITM.
- A field with no variation, or with values outside a physically plausible band for its labelled unit, is not a model input. Pressure is labelled mmHg. A usable mmHg series would sit near 700–760, or near 950–1020 if the values were actually hPa. A median near 880 is neither, so pressure is not converted and not used.
- Wind speed above 25 m/s was set to missing in the hourly modeling table for the original six stations and counted in `docs/cleaning_decisions.md`. Those spikes were not replaced.

## By station (percent of 15-minute rows non-null)

| Station | Rows | PM2.5 missing % | PM2.5 last timestamp | RH % | WS % | WD % | BP % | AT % | RF % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Alandi, Pune - IITM | 24884 | 3.38 | 2025-01-28 11:00:00+00:00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| Bhosari, Pune - IITM | 37599 | 3.78 | 2025-12-12 12:15:00+00:00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| Bhumkar Nagar, Pune - IITM | 70176 | 29.54 | 2025-12-31 23:30:00+00:00 | 66.59 | 4.33 | 6.39 | 0.00 | 66.59 | 66.59 |
| Dhankawadi, Pune - IITM | 17686 | 5.47 | 2025-12-31 09:30:00+00:00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| Hadapsar, Pune - IITM | 29796 | 7.20 | 2025-12-31 23:30:00+00:00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| Karve Road, Pune - MPCB | 70176 | 38.84 | 2025-05-23 21:00:00+00:00 | 37.30 | 61.23 | 46.47 | 27.91 | 0.00 | 0.00 |
| Katraj Dairy, Pune - MPCB | 70176 | 23.78 | 2025-12-31 23:45:00+00:00 | 78.17 | 77.37 | 77.45 | 0.00 | 78.16 | 78.41 |
| Mhada Colony, Pune - IITM | 63728 | 2.31 | 2025-12-31 23:30:00+00:00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| Panchawati_Pashan, Pune - IITM | 70176 | 38.83 | 2025-12-31 23:30:00+00:00 | 58.52 | 58.61 | 58.54 | 0.00 | 58.52 | 63.10 |
| Revenue Colony-Shivajinagar, Pune - IITM | 62593 | 6.35 | 2025-12-31 23:15:00+00:00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| Savitribai Phule Pune University, Pune - MPCB | 70176 | 11.16 | 2025-12-31 23:45:00+00:00 | 92.37 | 92.21 | 92.20 | 0.00 | 92.39 | 92.38 |
| Transport Nagar-Nigdi, Pune - IITM | 57184 | 2.36 | 2025-12-31 23:30:00+00:00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |

## Clock of the published timestamp

Timestamps were parsed with the `+0000` offset stored on the 15-minute files. They were not shifted to IST. The table below is the median of hourly observed PM2.5 by that published hour, across the six local stations.

| Published hour | Median PM2.5 (µg/m³) |
| --- | --- |
| 0 | 37.30 |
| 1 | 36.53 |
| 2 | 35.50 |
| 3 | 34.20 |
| 4 | 33.57 |
| 5 | 33.96 |
| 6 | 34.82 |
| 7 | 37.90 |
| 8 | 42.16 |
| 9 | 41.95 |
| 10 | 41.04 |
| 11 | 37.96 |
| 12 | 34.43 |
| 13 | 31.04 |
| 14 | 28.95 |
| 15 | 27.44 |
| 16 | 28.05 |
| 17 | 29.37 |
| 18 | 32.55 |
| 19 | 36.26 |
| 20 | 38.86 |
| 21 | 39.80 |
| 22 | 40.34 |
| 23 | 39.45 |

OpenCity and the file header do not state whether that clock is UTC or an IST clock written with a zero offset. The CAAQMS transmission protocol uses local civil time at the station. A third-party CPCB archive describes the 15-minute timestamp field as UTC. Those two statements disagree, and this file’s own offset does not settle it. No conversion is applied until a source note for this OpenCity export says which clock was used.

Weather alignment, if an external series is added later, has to record both clocks explicitly. See `docs/weather_source_evaluation.md`.
