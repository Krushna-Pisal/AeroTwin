# OpenCity legacy file audit (2017–2023 wide matrices)

Dataset: https://data.opencity.in/dataset/pune-hourly-air-quality-reports

These seven files were already on disk. This audit reads the files and the CKAN resource records. It does not relabel any cell as PM2.5.

Dataset note published by OpenCity: “Hourly air quality reports from 2017 to 2023 for 10 stations in Pune.” Each resource description is only “Daily hourly data from 2017 to 2023.” The file names say “AQI Data”. None of those texts name PM2.5 or a unit.

The CKAN datastore for these resources has the same shape as the CSV: one field taken from the first month header (for example `January-2017`) and twenty-four fields named `00:00:00` through `23:00:00`. There is no pollutant field and no unit field.

## Shared structure

Every file is a stack of blocks:

1. `Year,YYYY`
2. `Month-YYYY` followed by columns `00:00:00` … `23:00:00`
3. Two lines whose entire content is a double-quote character
4. Rows whose first cell is a day number and whose remaining cells are blank or a number

The quote lines are where a parameter name and a unit would normally sit in a CPCB hourly export. In these files they are empty. The measured quantity is therefore not in the file.

A timestamp can be rebuilt from the year header, the month header, the day number, and the hour column. That produces a time grid. It does not establish that the number is PM2.5 in µg/m³. This audit does not write that grid into the modeling table.

## Summary

| File | Station | Structure | Likely meaning | PM2.5 usable? | Reason |
| --- | --- | --- | --- | --- | --- |
| `bhosari-iitm-aqi-data-2017-2023__hourly_wide.csv` | Bhosari, IITM | Wide day-by-hour matrix, 1151 day rows, 11685 numeric cells | Integers capped at 500. Consistent with an AQI index. Not identified as PM2.5. | No | No pollutant name or unit. Values do not match the labelled PM2.5 series. |
| `hadapsar-iitm-aqi-data-2017-2023__hourly_wide.csv` | Hadapsar, IITM | Wide day-by-hour matrix, 1151 day rows, 11059 numeric cells | Integers capped at 500. Consistent with an AQI index. Not identified as PM2.5. | No | No pollutant name or unit. Values do not match the labelled PM2.5 series. |
| `karve-road-mpcb-aqi-data-2017-2023__hourly_wide.csv` | Karve Road, MPCB | Wide day-by-hour matrix, 2280 day rows, 38796 numeric cells | Integers capped at 500. Consistent with an AQI index. Not identified as PM2.5. | No | No pollutant name or unit. Values do not match the labelled PM2.5 series. |
| `mhada-colony-iitm-aqi-data-2017-2023__hourly_wide.csv` | Mhada Colony, IITM | Wide day-by-hour matrix, 1151 day rows, 22946 numeric cells | Integers capped at 500. Consistent with an AQI index. Not identified as PM2.5. | No | No pollutant name or unit. Values do not match the labelled PM2.5 series. |
| `mit-kothrud-iitm-aqi-data-2017-2023__hourly_wide.csv` | MIT-Kothrud, IITM | Wide day-by-hour matrix, 1151 day rows, 12891 numeric cells | Integers capped at 500. Consistent with an AQI index. Not identified as PM2.5. | No | No pollutant name or unit. Values do not match the labelled PM2.5 series. |
| `revenue-colony-shivajinagar-iitm-aqi-data-2017-2023__hourly_wide.csv` | Revenue Colony-Shivajinagar, IITM | Wide day-by-hour matrix, 1151 day rows, 19822 numeric cells | Integers capped at 500. Consistent with an AQI index. Not identified as PM2.5. | No | No pollutant name or unit. Values do not match the labelled PM2.5 series. |
| `transport-nagar-nigdi-iitm-aqi-data-2017-2023__hourly_wide.csv` | Transport Nagar-Nigdi, IITM | Wide day-by-hour matrix, 1151 day rows, 13927 numeric cells | Integers capped at 500. Consistent with an AQI index. Not identified as PM2.5. | No | No pollutant name or unit. Values do not match the labelled PM2.5 series. |

Every numeric cell in these seven files is a whole number. The maximum in every file is 500, and no cell is above 500. The labelled 15-minute PM2.5 series from the same dataset is fractional and reaches about 995 µg/m³. A ceiling of 500 is how CPCB publishes the AQI index. It is not how PM2.5 concentrations behave. The file name says “AQI”, and the resource text never says PM2.5. The cells are therefore not converted into a PM2.5 training series.

## `bhosari-iitm-aqi-data-2017-2023__hourly_wide.csv`

- Bytes: 101772
- Lines: 1410
- Nominal columns: 1 label column + 24 hour columns
- Year headers: 2017, 2018, 2019, 2020, 2021, 2022, 2023
- Month-header rows: 84
- Day-number rows: 1151
- Numeric cells: 11685
- Empty hour cells on day rows: 15939
- Min / median / p95 / max: 5.00 / 84.00 / 287.00 / 500.00
- Share of numeric cells that are whole numbers: 100.00%
- Cells above 500: 0
- Contains the text PM2.5: False
- Contains a unit token: False
- Quote-only lines look like: '"', '"', '"'

First lines:

```text
Year,2017
January-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,
"
"
February-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00
"
"
March-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
"
April-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
```

Example day rows:

```text
1,,,,,,,,,,,,,,,,,,,,,,,,
2,,,,,,,,,,,,,,,,,,,,,,,,
3,,,,,,,,,,,,,,,,,,,,,,,,
4,,,,,,,,,,,,,,,,,,,,,,,,
5,,,,,,,,,,,,,,,,,,,,,,,,
6,,,,,,,,,,,,,,,,,,,,,,,,
```

Pollutant information: not present. PM2.5 information: not present. Date information: year header, month header, and a day number, with no full calendar date column. Hour information: column names `00:00:00`–`23:00:00`. Units: not present.

Reconstruction into timestamped observations: the grid can be reshaped, but the number has no documented identity, so the reshaped series would not be a PM2.5 observation.

## `hadapsar-iitm-aqi-data-2017-2023__hourly_wide.csv`

- Bytes: 93649
- Lines: 1410
- Nominal columns: 1 label column + 24 hour columns
- Year headers: 2017, 2018, 2019, 2020, 2021, 2022, 2023
- Month-header rows: 84
- Day-number rows: 1151
- Numeric cells: 11059
- Empty hour cells on day rows: 16565
- Min / median / p95 / max: 2.00 / 70.00 / 186.00 / 500.00
- Share of numeric cells that are whole numbers: 100.00%
- Cells above 500: 0
- Contains the text PM2.5: False
- Contains a unit token: False
- Quote-only lines look like: '"', '"', '"'

First lines:

```text
Year,2017
January-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,
"
"
February-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00
"
"
March-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
"
April-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
```

Example day rows:

```text
1,,,,,,,,,,,,,,,,,,,,,,,,
2,,,,,,,,,,,,,,,,,,,,,,,,
3,,,,,,,,,,,,,,,,,,,,,,,,
4,,,,,,,,,,,,,,,,,,,,,,,,
5,,,,,,,,,,,,,,,,,,,,,,,,
6,,,,,,,,,,,,,,,,,,,,,,,,
```

Pollutant information: not present. PM2.5 information: not present. Date information: year header, month header, and a day number, with no full calendar date column. Hour information: column names `00:00:00`–`23:00:00`. Units: not present.

Reconstruction into timestamped observations: the grid can be reshaped, but the number has no documented identity, so the reshaped series would not be a PM2.5 observation.

## `karve-road-mpcb-aqi-data-2017-2023__hourly_wide.csv`

- Bytes: 221666
- Lines: 2540
- Nominal columns: 1 label column + 24 hour columns
- Year headers: 2017, 2018, 2019, 2020, 2021, 2022, 2023
- Month-header rows: 84
- Day-number rows: 2280
- Numeric cells: 38796
- Empty hour cells on day rows: 15924
- Min / median / p95 / max: 3.00 / 77.00 / 311.00 / 500.00
- Share of numeric cells that are whole numbers: 100.00%
- Cells above 500: 0
- Contains the text PM2.5: False
- Contains a unit token: False
- Quote-only lines look like: '"', '"', '"'

First lines:

```text
Year,2017
January-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,
"
"
February-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00
"
"
March-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
"
April-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
```

Example day rows:

```text
1,,,,,,,,,,,,,,,,,,,,,,,,
2,,,,,,,,,,,,,,,,,,,,,,,,
1,,,,,,,,,,,,,,,,,,,,,,,,
2,,,,,,,,,,,,,,,,,,,,,,,,
3,,,,,,,,,,,,,,,,,,,,,,,,
4,,,,,,,,,,,,,,,,,,,,,,,,
```

Pollutant information: not present. PM2.5 information: not present. Date information: year header, month header, and a day number, with no full calendar date column. Hour information: column names `00:00:00`–`23:00:00`. Units: not present.

Reconstruction into timestamped observations: the grid can be reshaped, but the number has no documented identity, so the reshaped series would not be a PM2.5 observation.

## `mhada-colony-iitm-aqi-data-2017-2023__hourly_wide.csv`

- Bytes: 145157
- Lines: 1410
- Nominal columns: 1 label column + 24 hour columns
- Year headers: 2017, 2018, 2019, 2020, 2021, 2022, 2023
- Month-header rows: 84
- Day-number rows: 1151
- Numeric cells: 22946
- Empty hour cells on day rows: 4678
- Min / median / p95 / max: 3.00 / 87.00 / 219.00 / 500.00
- Share of numeric cells that are whole numbers: 100.00%
- Cells above 500: 0
- Contains the text PM2.5: False
- Contains a unit token: False
- Quote-only lines look like: '"', '"', '"'

First lines:

```text
Year,2017
January-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,
"
"
February-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00
"
"
March-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
"
April-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
```

Example day rows:

```text
1,,,,,,,,,,,,,,,,,,,,,,,,
2,,,,,,,,,,,,,,,,,,,,,,,,
3,,,,,,,,,,,,,,,,,,,,,,,,
4,,,,,,,,,,,,,,,,,,,,,,,,
5,,,,,,,,,,,,,,,,,,,,,,,,
6,,,,,,,,,,,,,,,,,,,,,,,,
```

Pollutant information: not present. PM2.5 information: not present. Date information: year header, month header, and a day number, with no full calendar date column. Hour information: column names `00:00:00`–`23:00:00`. Units: not present.

Reconstruction into timestamped observations: the grid can be reshaped, but the number has no documented identity, so the reshaped series would not be a PM2.5 observation.

## `mit-kothrud-iitm-aqi-data-2017-2023__hourly_wide.csv`

- Bytes: 101861
- Lines: 1410
- Nominal columns: 1 label column + 24 hour columns
- Year headers: 2017, 2018, 2019, 2020, 2021, 2022, 2023
- Month-header rows: 84
- Day-number rows: 1151
- Numeric cells: 12891
- Empty hour cells on day rows: 14733
- Min / median / p95 / max: 4.00 / 55.00 / 185.00 / 500.00
- Share of numeric cells that are whole numbers: 100.00%
- Cells above 500: 0
- Contains the text PM2.5: False
- Contains a unit token: False
- Quote-only lines look like: '"', '"', '"'

First lines:

```text
Year,2017
January-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,
"
"
February-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00
"
"
March-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
"
April-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
```

Example day rows:

```text
1,,,,,,,,,,,,,,,,,,,,,,,,
2,,,,,,,,,,,,,,,,,,,,,,,,
3,,,,,,,,,,,,,,,,,,,,,,,,
4,,,,,,,,,,,,,,,,,,,,,,,,
5,,,,,,,,,,,,,,,,,,,,,,,,
6,,,,,,,,,,,,,,,,,,,,,,,,
```

Pollutant information: not present. PM2.5 information: not present. Date information: year header, month header, and a day number, with no full calendar date column. Hour information: column names `00:00:00`–`23:00:00`. Units: not present.

Reconstruction into timestamped observations: the grid can be reshaped, but the number has no documented identity, so the reshaped series would not be a PM2.5 observation.

## `revenue-colony-shivajinagar-iitm-aqi-data-2017-2023__hourly_wide.csv`

- Bytes: 136965
- Lines: 1410
- Nominal columns: 1 label column + 24 hour columns
- Year headers: 2017, 2018, 2019, 2020, 2021, 2022, 2023
- Month-header rows: 84
- Day-number rows: 1151
- Numeric cells: 19822
- Empty hour cells on day rows: 7802
- Min / median / p95 / max: 6.00 / 158.00 / 305.00 / 500.00
- Share of numeric cells that are whole numbers: 100.00%
- Cells above 500: 0
- Contains the text PM2.5: False
- Contains a unit token: False
- Quote-only lines look like: '"', '"', '"'

First lines:

```text
Year,2017
January-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,
"
"
February-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00
"
"
March-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
"
April-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
```

Example day rows:

```text
1,,,,,,,,,,,,,,,,,,,,,,,,
2,,,,,,,,,,,,,,,,,,,,,,,,
3,,,,,,,,,,,,,,,,,,,,,,,,
4,,,,,,,,,,,,,,,,,,,,,,,,
5,,,,,,,,,,,,,,,,,,,,,,,,
6,,,,,,,,,,,,,,,,,,,,,,,,
```

Pollutant information: not present. PM2.5 information: not present. Date information: year header, month header, and a day number, with no full calendar date column. Hour information: column names `00:00:00`–`23:00:00`. Units: not present.

Reconstruction into timestamped observations: the grid can be reshaped, but the number has no documented identity, so the reshaped series would not be a PM2.5 observation.

## `transport-nagar-nigdi-iitm-aqi-data-2017-2023__hourly_wide.csv`

- Bytes: 108982
- Lines: 1410
- Nominal columns: 1 label column + 24 hour columns
- Year headers: 2017, 2018, 2019, 2020, 2021, 2022, 2023
- Month-header rows: 84
- Day-number rows: 1151
- Numeric cells: 13927
- Empty hour cells on day rows: 13697
- Min / median / p95 / max: 5.00 / 77.00 / 224.00 / 500.00
- Share of numeric cells that are whole numbers: 100.00%
- Cells above 500: 0
- Contains the text PM2.5: False
- Contains a unit token: False
- Quote-only lines look like: '"', '"', '"'

First lines:

```text
Year,2017
January-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,
"
"
February-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00
"
"
March-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
"
April-2017,00:00:00,01:00:00,02:00:00,03:00:00,04:00:00,05:00:00,06:00:00,07:00:00,08:00:00,09:00:00,10:00:00,11:00:00,12:00:00,13:00:00,14:00:00,15:00:00,16:00:00,17:00:00,18:00:00,19:00:00,20:00:00,21:00:00,22:00:00,23
"
```

Example day rows:

```text
1,,,,,,,,,,,,,,,,,,,,,,,,
2,,,,,,,,,,,,,,,,,,,,,,,,
3,,,,,,,,,,,,,,,,,,,,,,,,
4,,,,,,,,,,,,,,,,,,,,,,,,
5,,,,,,,,,,,,,,,,,,,,,,,,
6,,,,,,,,,,,,,,,,,,,,,,,,
```

Pollutant information: not present. PM2.5 information: not present. Date information: year header, month header, and a day number, with no full calendar date column. Hour information: column names `00:00:00`–`23:00:00`. Units: not present.

Reconstruction into timestamped observations: the grid can be reshaped, but the number has no documented identity, so the reshaped series would not be a PM2.5 observation.

## Decision

Do not train on these seven files. A smaller labelled 15-minute record is the PM2.5 source. MIT-Kothrud exists in this set and still has no labelled PM2.5 series.
