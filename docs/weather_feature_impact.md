# Weather feature impact

Comparison of V2-A (PM2.5 lags only) and V2-B (lags plus observed CPCB weather) on the same test rows. Missing weather was not filled and was not copied from another station.

This represents the contribution of model features to the prediction and is not direct causal source apportionment.

| | MAE | RMSE | R² |
| --- | --- | --- | --- |
| V2-A | 11.88 | 22.74 | 0.683 |
| V2-B | 12.41 | 23.55 | 0.660 |
| V2-A minus V2-B | -0.53 | -0.80 | 0.023 |

V2-A minus V2-B is negative here: adding the observed weather fields raised test MAE by 0.53 µg/m³ and RMSE by 0.80 µg/m³, and lowered R² by 0.023. Weather did not improve the held-out forecast.

## Model-derived contribution on V2-B

TreeExplainer mean absolute SHAP on a sample of test rows, in µg/m³ of the 24-hour prediction. This is not source apportionment.

| Feature | Mean abs SHAP |
| --- | --- |
| pm25_t | 12.793 |
| pm25_lag_1 | 2.885 |
| pm25_lag_72 | 2.196 |
| pm25_lag_48 | 1.920 |
| pm25_lag_12 | 1.516 |
| pm25_lag_2 | 1.290 |
| temperature | 1.247 |
| pm25_lag_24 | 1.234 |
| pm25_lag_3 | 1.009 |
| solar_radiation | 0.986 |
| pm25_lag_6 | 0.878 |
| humidity | 0.817 |
| wind_speed | 0.481 |
| rainfall | 0.255 |
| wind_direction | 0.218 |

## V2-D imputation experiment

V2-D fills weather only. PM2.5 is not filled. A gap of at most 2 hours is carried forward from the previous hour. Remaining gaps at a station use that station's own training-period median, and only if that station has at least 100 training weather observations. A station with no weather history stays missing. No value is taken from a different station.

V2-D test MAE 12.30, RMSE 23.50, R² 0.662.
V2-B test MAE 12.41.
V2-D has a lower test MAE than V2-B by 0.11 µg/m³. It is still higher than V2-A (11.88) and higher than persistence (11.52). The imputed-weather model is not used.
