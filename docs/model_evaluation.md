# Model evaluation

Target: observed PM2.5 at T+24 hours, in ug/m3.

V0 predicts that value with the observed PM2.5 at the issue time T (persistence).
V1 is one global XGBoost model for all stations in the processed table. It is not a separate model per station.

This represents the contribution of model features to the prediction and is not direct causal source apportionment.

## Split

- Rule: `calendar`
- Labelled series: 2024-01-01 00:00:00+00:00 to 2025-12-30 23:00:00+00:00
- Validation issues start: 2025-01-01 00:00:00+00:00
- Test issues start: 2025-07-01 00:00:00+00:00
- Rows: train 35871, validation 19016, test 13100, buffer 160

Training labels end before 2025-01-01 00:00:00+00:00. Validation labels end before 2025-07-01 00:00:00+00:00. Issue times whose target would fall across a cut stay in 'buffer' (about 24 hours on each side of a cut).

The 2017-2021 / 2022 / 2023 split was not used. The OpenCity files for those years do not contain a PM2.5 column, so there is no observed target to train on. The cuts above are inside the labelled 2024-2025 series.

Rows are assigned by time, not at random. Training labels (`target_timestamp`) end before the validation cut. Validation labels end before the test cut.

## Features actually used in V1

- `pm25`
- `pm25_lag_1`
- `pm25_lag_2`
- `pm25_lag_3`
- `pm25_lag_6`
- `pm25_lag_12`
- `pm25_lag_24`
- `pm25_lag_48`
- `pm25_lag_72`
- `hour`
- `day_of_week`
- `day_of_year`
- `month`
- `is_weekend`
- `target_hour`
- `target_day_of_week`
- `target_month`
- `target_is_weekend`
- `humidity`
- `wind_speed`
- `wind_direction`
- `station_site_292`
- `station_site_5404`
- `station_site_5406`
- `station_site_5407`
- `station_site_5408`
- `station_site_5409`

## Features present in the table but not used

- `temperature`: no usable variation (non-null fraction 0.0000, distinct values 0). Not imputed.
- `rainfall`: no usable variation (non-null fraction 0.0000, distinct values 0). Not imputed.
- `solar_radiation`: no usable variation (non-null fraction 0.0000, distinct values 1). Not imputed.
- `pressure`: median of non-null values is 880.4. The file labels BP as mmHg, but that median is outside a plausible ambient band for mmHg (about 680-780) and for hPa (about 940-1050). Values were not unit-converted and were not used.
- `total_rainfall`: TOT-RF does not vary (the only populated station is constant). It was not used as rainfall.

Station identity is one-hot encoded from `station_id` (columns starting with `station_`).

No traffic, industrial, or dust proxy is in this model. V2 and V3 were not trained.

## Test metrics

| model | n | MAE | RMSE | R2 |
| --- | --- | --- | --- | --- |
| V0 persistence | 13100 | 12.76 | 23.67 | 0.739 |
| V1 XGBoost | 13100 | 15.52 | 28.77 | 0.614 |

On the test period, V1 MAE is 15.52 ug/m3 and V0 MAE is 12.76 ug/m3. V1 does not beat persistence on MAE.

Validation metrics (not used to pick the model; hyperparameters were fixed before looking at test):

| model | n | MAE | RMSE | R2 |
| --- | --- | --- | --- | --- |
| V0 persistence | 19016 | 11.99 | 20.75 | 0.547 |
| V1 XGBoost | 19016 | 15.95 | 23.81 | 0.403 |

## Test metrics by station

| station | n | V0 MAE | V1 MAE | V0 RMSE | V1 RMSE | V0 R2 | V1 R2 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mhada Colony, Pune - IITM | 4073 | 11.79 | 15.64 | 18.40 | 27.22 | 0.818 | 0.601 |
| Bhosari, Pune - IITM | 1732 | 5.25 | 3.97 | 19.04 | 5.15 | -9.390 | 0.240 |
| Hadapsar, Pune - IITM | 1739 | 24.69 | 32.09 | 44.65 | 54.42 | 0.576 | 0.370 |
| Transport Nagar-Nigdi, Pune - IITM | 3351 | 9.09 | 9.44 | 12.95 | 12.99 | 0.765 | 0.763 |
| Revenue Colony-Shivajinagar, Pune - IITM | 2205 | 16.61 | 20.53 | 24.30 | 30.60 | 0.725 | 0.564 |

Stations with labelled history but no scored test rows:

- Karve Road, Pune - MPCB: last hour with both PM2.5(T) and PM2.5(T+24h) is 2025-05-22 21:00:00+00:00. No test rows.

Where R2 is largely negative, that station's test PM2.5 varies little compared with the size of the errors. MAE is the comparison between V0 and V1.

## SHAP

This represents the contribution of model features to the prediction and is not direct causal source apportionment.

TreeExplainer on a random sample of 1500 test rows. Values are mean absolute SHAP in ug/m3 of the predicted concentration.

| feature | mean abs SHAP |
| --- | --- |
| pm25 | 10.320 |
| pm25_lag_1 | 4.327 |
| day_of_year | 4.323 |
| pm25_lag_72 | 1.596 |
| pm25_lag_48 | 1.373 |
| pm25_lag_2 | 1.353 |
| pm25_lag_24 | 1.352 |
| station_site_5409 | 1.227 |
| hour | 1.029 |
| pm25_lag_6 | 0.884 |
| pm25_lag_12 | 0.804 |
| pm25_lag_3 | 0.778 |
| day_of_week | 0.654 |
| wind_direction | 0.498 |
| target_month | 0.396 |

## Plots

- `D:\AeroTwin\ml\models\figures\test_actual_vs_predicted_scatter.png`
- `D:\AeroTwin\ml\models\figures\test_daily_mean_actual_vs_predicted.png`
- `D:\AeroTwin\ml\models\figures\shap_mean_abs.png`

The daily-mean figure averages hourly predictions and hourly observations inside each UTC day so the series is readable. It is not a separately trained daily model.

## Data-quality limits that affect this score

- Training data are hourly means of labelled 15-minute CPCB observations from 2024 onward, not the 2017-2023 wide matrices.
- Timestamps follow the +0000 offset in the source files and were not converted to IST.
- Missing PM2.5 was not imputed. Rows without PM2.5 at T or at T+24h are excluded from scoring.
- Meteorological inputs are observed CPCB fields, not an external weather product: humidity, wind_speed, wind_direction. Other stations in this extract leave those fields empty.
- humidity: on training rows, non-null fraction 0.1319; best station site_292 fraction 0.6585. Missing station-hours stay missing.
- wind_speed: on training rows, non-null fraction 0.1998; best station site_292 fraction 0.9972. Missing station-hours stay missing.
- wind_direction: on training rows, non-null fraction 0.1757; best station site_292 fraction 0.8767. Missing station-hours stay missing.
- temperature non-null fraction on the full hourly table (including hours with no PM2.5) is 0.0000.
- humidity non-null fraction on the full hourly table (including hours with no PM2.5) is 0.0666.
- wind_speed non-null fraction on the full hourly table (including hours with no PM2.5) is 0.1081.
- wind_direction non-null fraction on the full hourly table (including hours with no PM2.5) is 0.0832.
- rainfall non-null fraction on the full hourly table (including hours with no PM2.5) is 0.0000.
- solar_radiation non-null fraction on the full hourly table (including hours with no PM2.5) is 0.0000.
- pressure non-null fraction on the full hourly table (including hours with no PM2.5) is 0.0499.
- Humidity, wind speed, and wind direction in this extract are reported at Karve Road only. If Karve Road has no test rows, those weather inputs are missing for every test prediction.
