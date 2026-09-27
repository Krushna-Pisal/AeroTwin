# Forecast horizon analysis

Feature set: `B_lags`, chosen by 24-hour validation MAE among the lags/calendar/weather ablations. Persistence is recomputed at every horizon as PM2.5(T+h) = PM2.5(T).

The product still needs a 24–48 hour forecast. This table only shows how error grows with the horizon. A shorter horizon is not a substitute for the 24-hour product target.

| Horizon | Test rows | Corr(PM2.5 at T, PM2.5 at T+h) | Persistence MAE | XGBoost MAE | Persistence RMSE | XGBoost RMSE | Persistence R² | XGBoost R² |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| +1h | 13920 | 0.972 | 6.57 | 7.76 | 10.89 | 14.89 | 0.944 | 0.895 |
| +6h | 13599 | 0.741 | 18.03 | 18.25 | 33.32 | 34.48 | 0.476 | 0.439 |
| +12h | 13373 | 0.651 | 21.39 | 14.48 | 38.72 | 27.25 | 0.301 | 0.654 |
| +24h | 13100 | 0.869 | 12.76 | 14.29 | 23.67 | 25.80 | 0.739 | 0.690 |

Validation MAE, same feature set:

| Horizon | Persistence MAE | XGBoost MAE |
| --- | --- | --- |
| +1h | 5.58 | 5.98 |
| +6h | 14.18 | 14.96 |
| +12h | 15.18 | 11.71 |
| +24h | 11.99 | 11.96 |

Split counts differ slightly by horizon because a row is kept only when the target hour exists, and training labels must end before the validation cut.
