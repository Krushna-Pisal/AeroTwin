# Data quality report

Source dataset: https://data.opencity.in/dataset/pune-hourly-air-quality-reports

Primary target: PM2.5 from observed CPCB station files republished by OpenCity.

Download metadata: `data/raw/air_quality/download_metadata.json`.

No synthetic PM2.5, weather, traffic, industrial, or dust values are created in this inspection.

## Decision for the first model

Use one temporal resolution. The labelled source is 15-minute. The modeling table is an hourly aggregation of those observations (see `docs/cleaning_decisions.md`). The 2017-2023 wide files are a different, unlabelled layout and are not mixed in.

MIT-Kothrud is in the requested starting list, but OpenCity has no 15-minute MIT-Kothrud resource. Only its unlabelled 2017-2023 wide file exists, so MIT-Kothrud is not in the training table.

## Labelled 15-minute files (observed CPCB)

These files have a `Timestamp` column and a `PM2.5` column. Statistics below are computed from the raw files after numeric parsing. Missing cells stay missing.

- Rows: 321082
- Columns kept: station_id, station_name, timestamp, pm25, pm10, no, no2, nox, nh3, so2, co, ozone, benzene, toluene, xylene, temperature, humidity, wind_speed, wind_direction, rainfall, total_rainfall, solar_radiation, pressure, vertical_wind_speed, source_file
- Stations: 7
- Timestamp range (published offset, UTC): 2024-01-01 00:00:00+00:00 to 2025-12-31 23:45:00+00:00
- Unparseable timestamps: 6

### Dtypes

| column | dtype | missing % |
| --- | --- | --- |
| station_id | str | 0.00 |
| station_name | str | 0.00 |
| timestamp | datetime64[us, UTC] | 0.00 |
| pm25 | float64 | 11.72 |
| pm10 | float64 | 14.14 |
| no | float64 | 15.27 |
| no2 | float64 | 15.12 |
| nox | float64 | 14.10 |
| nh3 | float64 | 100.00 |
| so2 | float64 | 69.22 |
| co | float64 | 12.89 |
| ozone | float64 | 12.12 |
| benzene | float64 | 25.69 |
| toluene | float64 | 53.87 |
| xylene | float64 | 54.83 |
| temperature | float64 | 100.00 |
| humidity | float64 | 91.85 |
| wind_speed | float64 | 86.62 |
| wind_direction | float64 | 89.84 |
| rainfall | float64 | 100.00 |
| total_rainfall | float64 | 78.14 |
| solar_radiation | float64 | 100.00 |
| pressure | float64 | 93.90 |
| vertical_wind_speed | float64 | 100.00 |

- Exact duplicate rows: 0
- Duplicate station_id + timestamp keys: 5

### PM2.5 (raw 15-minute observations)

- Valid observations: 283460 (88.28% of rows)
- Min / median / mean / p95 / max (ug/m3): 0.01 / 35.29 / 42.85 / 101.05 / 994.79
- These figures describe observed values only. They are not gap-filled.

| station | rows | valid PM2.5 % | median PM2.5 | start | end |
| --- | --- | --- | --- | --- | --- |
| nan (2025) | 6 | 0.00 | n/a | n/a | n/a |
| Karve Road, Pune - MPCB (site_292) | 70176 | 61.16 | 39.22 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:45:00+00:00 |
| Mhada Colony, Pune - IITM (site_5404) | 63728 | 97.69 | 35.17 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:30:00+00:00 |
| Bhosari, Pune - IITM (site_5406) | 37599 | 96.22 | 20.30 | 2024-01-01 00:00:00+00:00 | 2025-12-12 12:30:00+00:00 |
| Hadapsar, Pune - IITM (site_5407) | 29796 | 92.80 | 43.76 | 2024-05-20 10:00:00+00:00 | 2025-12-31 23:30:00+00:00 |
| Transport Nagar-Nigdi, Pune - IITM (site_5408) | 57184 | 97.64 | 28.71 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:30:00+00:00 |
| Revenue Colony-Shivajinagar, Pune - IITM (site_5409) | 62593 | 93.65 | 44.96 | 2024-01-01 08:30:00+00:00 | 2025-12-31 23:15:00+00:00 |

### Weather-field availability

Meteorological fields are used only where the file actually contains values. An empty column is left empty.

| field | CPCB header | non-missing % |
| --- | --- | --- |
| temperature | AT | 0.00 |
| humidity | RH | 8.15 |
| wind_speed | WS | 13.38 |
| wind_direction | WD | 10.16 |
| rainfall | RF | 0.00 |
| solar_radiation | SR | 0.00 |
| pressure | BP | 6.10 |

### Valid PM2.5 by month

| month | valid PM2.5 rows |
| --- | --- |
| 2024-01 | 13776 |
| 2024-02 | 12816 |
| 2024-03 | 14167 |
| 2024-04 | 13401 |
| 2024-05 | 14212 |
| 2024-06 | 13719 |
| 2024-07 | 14924 |
| 2024-08 | 8580 |
| 2024-09 | 8317 |
| 2024-10 | 11139 |
| 2024-11 | 12290 |
| 2024-12 | 11787 |
| 2025-01 | 13436 |
| 2025-02 | 11829 |
| 2025-03 | 15930 |
| 2025-04 | 15143 |
| 2025-05 | 12894 |
| 2025-06 | 10356 |
| 2025-07 | 10984 |
| 2025-08 | 8682 |
| 2025-09 | 6550 |
| 2025-10 | 8645 |
| 2025-11 | 9778 |
| 2025-12 | 10105 |

## 2017-2023 hourly resources (not used for training)

These OpenCity files are wide matrices: a year header, a row of clock hours, then day-number rows. The pollutant name is not in the file. There is no `PM2.5` column and no station timestamp column.

The numbers therefore cannot be treated as PM2.5 concentrations. They are not reshaped into a training series, not gap-filled, and not passed to the model. A 2017-2021 / 2022 / 2023 chronological split is not possible from these files.

External descriptions of this export (CPCB hourly AQI matrices) indicate hour columns of an air-quality index, which is a different quantity from PM2.5 ug/m3. This pipeline does not relabel those cells as PM2.5.

### bhosari-iitm-aqi-data-2017-2023__hourly_wide.csv

- Bytes: 101772
- Lines: 1410
- Hour-header rows: 84
- Contains a PM2.5 label: False
- Year headers: Year,2017, Year,2018, Year,2019, Year,2020, Year,2021, Year,2022
- Example data line (unlabelled): `10,316.0,314.0,287.0,219.0,189.0,178.0,176.0,131.0,113.0,125.0,100.0,82.0,61.0,62.0,58.0,53.0,48.0,48.0,45.0,46.0,64.0,131.0,,`

### hadapsar-iitm-aqi-data-2017-2023__hourly_wide.csv

- Bytes: 93649
- Lines: 1410
- Hour-header rows: 84
- Contains a PM2.5 label: False
- Year headers: Year,2017, Year,2018, Year,2019, Year,2020, Year,2021, Year,2022
- Example data line (unlabelled): `12,,,,,,,,,,,,,,,,,153.0,140.0,100.0,118.0,96.0,124.0,137.0,197.0`

### karve-road-mpcb-aqi-data-2017-2023__hourly_wide.csv

- Bytes: 221666
- Lines: 2540
- Hour-header rows: 84
- Contains a PM2.5 label: False
- Year headers: Year,2017, Year,2018, Year,2019, Year,2020, Year,2021, Year,2022
- Example data line (unlabelled): `17,,32.0,,,,,,,,,,,,,,,,,,,,,,`

### mhada-colony-iitm-aqi-data-2017-2023__hourly_wide.csv

- Bytes: 145157
- Lines: 1410
- Hour-header rows: 84
- Contains a PM2.5 label: False
- Year headers: Year,2017, Year,2018, Year,2019, Year,2020, Year,2021, Year,2022
- Example data line (unlabelled): `10,172.0,215.0,218.0,231.0,236.0,240.0,186.0,147.0,128.0,140.0,121.0,96.0,88.0,85.0,76.0,83.0,76.0,83.0,68.0,43.0,82.0,88.0,103.0,108.0`

### mit-kothrud-iitm-aqi-data-2017-2023__hourly_wide.csv

- Bytes: 101861
- Lines: 1410
- Hour-header rows: 84
- Contains a PM2.5 label: False
- Year headers: Year,2017, Year,2018, Year,2019, Year,2020, Year,2021, Year,2022
- Example data line (unlabelled): `12,,,,,,,,,,,,,,,,,102.0,90.0,116.0,248.0,102.0,149.0,124.0,105.0`

### revenue-colony-shivajinagar-iitm-aqi-data-2017-2023__hourly_wide.csv

- Bytes: 136965
- Lines: 1410
- Hour-header rows: 84
- Contains a PM2.5 label: False
- Year headers: Year,2017, Year,2018, Year,2019, Year,2020, Year,2021, Year,2022
- Example data line (unlabelled): `10,263.0,285.0,278.0,232.0,126.0,87.0,119.0,77.0,126.0,,,,,,,,,,,,,,,`

### transport-nagar-nigdi-iitm-aqi-data-2017-2023__hourly_wide.csv

- Bytes: 108982
- Lines: 1410
- Hour-header rows: 84
- Contains a PM2.5 label: False
- Year headers: Year,2017, Year,2018, Year,2019, Year,2020, Year,2021, Year,2022
- Example data line (unlabelled): `10,168.0,112.0,78.0,77.0,59.0,67.0,62.0,57.0,55.0,82.0,86.0,86.0,49.0,33.0,40.0,36.0,37.0,35.0,35.0,33.0,50.0,70.0,138.0,97.0`

## What this report does not claim

- It does not claim the 2017-2023 cells are PM2.5.
- It does not fill missing meteorology.
- Timestamps are parsed with the offset stored in the file (`+0000`). They are not rewritten as IST.
