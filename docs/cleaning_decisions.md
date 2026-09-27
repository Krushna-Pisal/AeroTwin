# Cleaning decisions

Source: https://data.opencity.in/dataset/pune-hourly-air-quality-reports

Input: labelled 15-minute CPCB CSVs in `data/raw/air_quality/`.
Output: `data/processed/air_quality_hourly.parquet` and `data/processed/model_dataset.parquet`.

## Files used

- `bhosari-iitm-15-minute-aqi-data-for-2024-25__15min.csv`
- `hadapsar-iitm-15-minute-aqi-data-for-2024-25__15min.csv`
- `karve-road-mpcb-15-minute-aqi-data-for-2024-25__15min.csv`
- `mhada-colony-iitm-15-minute-aqi-data-for-2024-25__15min.csv`
- `revenue-colony-shivajinagar-15-minute-aqi-data-for-2024-25__15min.csv`
- `transport-nagar-nigdi-15-minute-aqi-data-for-2024-25__15min.csv`

## Files skipped

Skipped files do not have both a timestamp column and a PM2.5 column. Their cells are not converted into PM2.5.

- `bhosari-iitm-aqi-data-2017-2023__hourly_wide.csv`
- `hadapsar-iitm-aqi-data-2017-2023__hourly_wide.csv`
- `karve-road-mpcb-aqi-data-2017-2023__hourly_wide.csv`
- `mhada-colony-iitm-aqi-data-2017-2023__hourly_wide.csv`
- `mit-kothrud-iitm-aqi-data-2017-2023__hourly_wide.csv`
- `revenue-colony-shivajinagar-iitm-aqi-data-2017-2023__hourly_wide.csv`
- `transport-nagar-nigdi-iitm-aqi-data-2017-2023__hourly_wide.csv`

## Decisions

1. Timestamps are parsed with the offset published in the file (`+0000`). They are stored as timezone-aware UTC. They are not shifted to IST, because the file does not say the clock is IST.
2. Rows are sorted by station and timestamp.
3. Exact duplicate rows removed: 0.
4. Unparseable timestamps dropped: 6.
5. Numeric columns are coerced with `to_numeric`. Non-numeric tokens become NaN. Nothing is put in their place.
6. Values outside the sentinel bounds below are set to NaN and counted. They are not replaced with a typical value. Wind speed above 25 m/s is treated as an implausible spike for these Pune stations.
4b. Rows whose station id does not start with `site_` removed: 0. These were malformed file footers, not stations.
7. PM2.5 is not forward-filled and not interpolated. A missing hour stays missing.
8. When two rows share a station and timestamp but are not exact duplicates, the first after sorting by source file is kept. The extra rows are dropped, not averaged.
   Conflicting key rows seen: 0. Extra rows removed: 0.
9. Each station is placed on a regular hourly grid from its first to its last timestamp. Hours inside that span with no 15-minute sample remain, with PM2.5 left as NaN, so lags cannot skip a gap and pretend it was the previous hour.
10. Hourly bin: left-labelled, left-closed. Samples at 00:00, 00:15, 00:30, and 00:45 belong to the hour starting at 00:00.
11. PM2.5, other pollutants, temperature, humidity, wind speed, solar radiation, pressure, and vertical wind speed use the hourly mean of the valid 15-minute samples. If a hour has no valid sample, the hourly value is NaN, not zero.
12. Rainfall (RF) uses the hourly sum. A hour with no rainfall samples is NaN, not 0. A recorded 0 stays 0.
13. Total rainfall (TOT-RF) uses the last valid 15-minute value in the hour. It is not summed, because the field is cumulative on many CPCB exports.
14. Wind direction uses the circular mean: the direction of the mean sine and cosine. Arithmetic averaging of degrees is not used. A hour with no wind-direction samples is NaN.
15. `pm25_obs_count` is how many valid 15-minute PM2.5 samples fell in that hour. It is kept for audit and is not a model feature in V1.
16. Lag features are shifts on that hourly grid: `pm25_lag_k` is PM2.5 at T-k hours. `target_pm25_24h` is PM2.5 at T+24 hours. The target column is not a feature.
17. Calendar fields `hour`, `day_of_week`, `day_of_year`, `month`, and `is_weekend` are taken from timestamp T in the published UTC offset. `target_hour`, `target_day_of_week`, `target_month`, and `target_is_weekend` are the calendar of T+24h, which is known when the forecast is issued.
18. No traffic, industrial, or dust values are created.

## Sentinel bounds set to NaN

| column | lower | upper | cells set to NaN |
| --- | --- | --- | --- |
| pm25 | 0 | 5000 | 0 |
| pm10 | 0 | 5000 | 0 |
| no | 0 | 5000 | 0 |
| no2 | 0 | 5000 | 0 |
| nox | 0 | 5000 | 0 |
| nh3 | 0 | 5000 | 0 |
| so2 | 0 | 5000 | 0 |
| co | 0 | 100 | 0 |
| ozone | 0 | 5000 | 0 |
| benzene | 0 | 5000 | 0 |
| toluene | 0 | 5000 | 0 |
| xylene | 0 | 5000 | 0 |
| temperature | -20 | 60 | 0 |
| humidity | 0 | 100 | 0 |
| wind_speed | 0 | 25 | 64 |
| wind_direction | 0 | 360 | 0 |
| rainfall | 0 | 500 | 0 |
| total_rainfall | 0 | 5000 | 0 |
| solar_radiation | 0 | 2000 | 0 |
| pressure | 0 | 1200 | 0 |
| vertical_wind_speed | -20 | 20 | 0 |

Negative concentrations are inside this rule. The upper ends are there for instrument sentinels, not as a claim that every value below the cap is accurate.

## Hourly result

- Hourly rows (including hours with missing PM2.5): 101419
- Hours with observed PM2.5: 72731
- Share of hourly rows with PM2.5: 71.71%
- Timestamp range: 2024-01-01 00:00:00+00:00 to 2025-12-31 23:00:00+00:00

### Meteorology still missing after aggregation

Coverage is the share of hourly rows with a non-missing value. Low coverage means the CPCB file did not report that field, not that a value was invented.

| field | non-missing % |
| --- | --- |
| temperature | 0.00 |
| humidity | 6.66 |
| wind_speed | 10.81 |
| wind_direction | 8.32 |
| rainfall | 0.00 |
| solar_radiation | 0.00 |
| pressure | 4.99 |

Coverage is not spread evenly. Most stations in this download do not report meteorology at all. The rates below are the share of hourly rows with a value.

- Karve Road, Pune - MPCB: temperature 0.0%, humidity 38.5%, wind_speed 62.5%, wind_direction 48.1%, rainfall 0.0%, solar_radiation 0.0%, pressure 28.8%
- Mhada Colony, Pune - IITM: temperature 0.0%, humidity 0.0%, wind_speed 0.0%, wind_direction 0.0%, rainfall 0.0%, solar_radiation 0.0%, pressure 0.0%
- Bhosari, Pune - IITM: temperature 0.0%, humidity 0.0%, wind_speed 0.0%, wind_direction 0.0%, rainfall 0.0%, solar_radiation 0.0%, pressure 0.0%
- Hadapsar, Pune - IITM: temperature 0.0%, humidity 0.0%, wind_speed 0.0%, wind_direction 0.0%, rainfall 0.0%, solar_radiation 0.0%, pressure 0.0%
- Transport Nagar-Nigdi, Pune - IITM: temperature 0.0%, humidity 0.0%, wind_speed 0.0%, wind_direction 0.0%, rainfall 0.0%, solar_radiation 0.0%, pressure 0.0%
- Revenue Colony-Shivajinagar, Pune - IITM: temperature 0.0%, humidity 0.0%, wind_speed 0.0%, wind_direction 0.0%, rainfall 0.0%, solar_radiation 0.0%, pressure 0.0%

### PM2.5 by station (hourly observed values)

| station | hourly rows | hours with PM2.5 | median ug/m3 | first PM2.5 | last PM2.5 |
| --- | --- | --- | --- | --- | --- |
| Karve Road, Pune - MPCB (site_292) | 17544 | 10974 | 38.67 | 2024-01-01 00:00:00+00:00 | 2025-05-23 21:00:00+00:00 |
| Mhada Colony, Pune - IITM (site_5404) | 17544 | 15927 | 35.16 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:00:00+00:00 |
| Bhosari, Pune - IITM (site_5406) | 17077 | 9269 | 20.39 | 2024-01-01 00:00:00+00:00 | 2025-12-12 12:00:00+00:00 |
| Hadapsar, Pune - IITM (site_5407) | 14174 | 7144 | 43.90 | 2024-05-20 10:00:00+00:00 | 2025-12-31 23:00:00+00:00 |
| Transport Nagar-Nigdi, Pune - IITM (site_5408) | 17544 | 14387 | 28.57 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:00:00+00:00 |
| Revenue Colony-Shivajinagar, Pune - IITM (site_5409) | 17536 | 15030 | 45.00 | 2024-01-01 08:00:00+00:00 | 2025-12-31 23:00:00+00:00 |

`source_resolution` is `15min_mean_to_hourly`. `data_origin` is `observed_cpcb`.
