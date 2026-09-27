# Model diagnostics

Question: why the saved V1 XGBoost (test MAE 15.28 µg/m³) lost to 24-hour persistence (test MAE 12.76 µg/m³).

All fits use the same chronological cuts as the saved model: training labels end before 2025-01-01, validation labels end before 2025-07-01, test issues start at 2025-07-01. Rows need observed PM2.5 at T and at the target hour. Hyperparameters match the saved V1 fit and were not tuned on the test set.

The candidate feature set is the one with the lowest validation MAE among B, C, C1, C2, and D. Test numbers are reported after that choice.

## 24-hour results

| Model | What it uses | Val MAE | Test MAE | Test RMSE | Test R² |
| --- | --- | --- | --- | --- | --- |
| A_persistence | PM2.5(T+24h) = PM2.5(T) | 11.99 | 12.76 | 23.67 | 0.739 |
| B_lags | XGBoost, PM2.5 now and lags only | 11.96 | 14.29 | 25.80 | 0.690 |
| C_lags_calendar | lags + full calendar | 13.19 | 14.95 | 26.75 | 0.667 |
| C1_lags_clock | lags + hour and weekday | 12.08 | 14.31 | 26.10 | 0.683 |
| C2_lags_season | lags + day-of-year and month | 13.14 | 14.64 | 25.94 | 0.687 |
| D_lags_calendar_met | lags + calendar + RH, WS, WD | 14.65 | 14.52 | 26.17 | 0.681 |
| E_current_v1 | lags + calendar + RH, WS, WD + station id (the saved V1 recipe) | 16.65 | 15.28 | 27.93 | 0.637 |

Validation choice: `B_lags` with validation MAE 11.96.

## What helped and what hurt

- Persistence test MAE is 12.76. Lags-only test MAE is 14.29 (validation 11.96).
- Adding the full calendar moves test MAE from 14.29 to 14.95.
- Clock features alone (C1) test MAE 14.31. Seasonal features alone (C2) test MAE 14.64.
- Adding Karve Road humidity and wind (D) moves test MAE from 14.95 to 14.52. Those fields are missing for every test row, because Karve Road has no PM2.5 in the test window.
- The saved V1 recipe (E) test MAE is 15.28. That is the refit of lags, calendar, sparse weather, and station id.

## Test MAE by station

| Station | A_persistence | B_lags | C_lags_calendar | C1_lags_clock | C2_lags_season | D_lags_calendar_met | E_current_v1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mhada Colony, Pune - IITM | 11.79 | 13.33 | 14.13 | 13.41 | 13.56 | 13.89 | 15.58 |
| Bhosari, Pune - IITM | 5.25 | 4.49 | 4.20 | 4.42 | 4.27 | 4.07 | 3.95 |
| Hadapsar, Pune - IITM | 24.69 | 28.47 | 30.37 | 28.55 | 29.57 | 29.86 | 31.27 |
| Transport Nagar-Nigdi, Pune - IITM | 9.09 | 9.44 | 10.06 | 9.29 | 10.05 | 9.21 | 9.36 |
| Revenue Colony-Shivajinagar, Pune - IITM | 16.61 | 19.96 | 20.19 | 20.13 | 20.00 | 19.87 | 20.02 |

## Test MAE by month

| Month | A_persistence | B_lags | C_lags_calendar | C1_lags_clock | C2_lags_season | D_lags_calendar_met | E_current_v1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-07 | 7.12 | 6.55 | 5.98 | 6.46 | 6.06 | 5.86 | 5.80 |
| 2025-08 | 5.18 | 5.10 | 4.77 | 5.07 | 4.85 | 4.62 | 4.50 |
| 2025-09 | 7.04 | 6.50 | 6.67 | 6.42 | 6.87 | 6.06 | 6.09 |
| 2025-10 | 13.12 | 13.13 | 16.61 | 13.24 | 16.37 | 15.59 | 16.03 |
| 2025-11 | 16.44 | 18.27 | 18.85 | 18.17 | 18.79 | 18.53 | 19.29 |
| 2025-12 | 25.92 | 33.84 | 34.61 | 34.12 | 32.86 | 34.13 | 37.41 |

## Station strategies

These three fits use the validation-chosen feature columns (`B_lags`), not the weather columns, so the comparison is about station structure.

| Strategy | Val n | Val MAE | Test n | Test MAE | Test RMSE | Test R² |
| --- | --- | --- | --- | --- | --- | --- |
| Global, no station id | 19016 | 11.96 | 13100 | 14.29 | 25.80 | 0.690 |
| Global + station id | 19016 | 12.59 | 13100 | 14.88 | 27.85 | 0.639 |
| Separate model per station | 15953 | 12.55 | 13100 | 17.93 | 34.98 | 0.430 |

Per-station fit notes:

- Karve Road, Pune - MPCB: skipped (train 7188, test 0).
- Mhada Colony, Pune - IITM: trained on 7545 rows, tested on 4073.
- Bhosari, Pune - IITM: trained on 4282 rows, tested on 1732.
- Hadapsar, Pune - IITM: trained on 2384 rows, tested on 1739.
- Transport Nagar-Nigdi, Pune - IITM: trained on 6379 rows, tested on 3351.
- Revenue Colony-Shivajinagar, Pune - IITM: trained on 8093 rows, tested on 2205.

### Per-station test MAE

| Station | Global, no id | Global + id | Separate model | Persistence |
| --- | --- | --- | --- | --- |
| Mhada Colony, Pune - IITM | 13.33 | 14.47 | 17.84 | 11.79 |
| Bhosari, Pune - IITM | 4.49 | 4.24 | 4.58 | 5.25 |
| Hadapsar, Pune - IITM | 28.47 | 30.92 | 39.35 | 24.69 |
| Transport Nagar-Nigdi, Pune - IITM | 9.44 | 9.40 | 11.00 | 9.09 |
| Revenue Colony-Shivajinagar, Pune - IITM | 19.96 | 19.68 | 22.24 | 16.61 |

## Recommendation

Persistence remains the primary 24-hour forecast. No XGBoost variant in this run beat it on the test set. The closest was lags only (test MAE 14.29 versus 12.76). Validation MAE for that lags-only model was 11.96 against persistence at 11.99, so the small validation edge did not survive the test period.

The loss is not uniform. In July–September 2025 the trees beat persistence. In December 2025 persistence MAE is 25.92 and lags-only MAE is 33.84. The model is shrinking a level change that “same hour tomorrow” already carries. Correlation between PM2.5 at T and PM2.5 at T+24h on the test rows is 0.87, which is why persistence is hard to beat at one day and easy to beat at 12 hours (test MAE 14.48 versus 21.39), where that correlation falls to 0.65.

Full calendar features raised test MAE from 14.29 to 14.95. Adding the Karve Road weather fields then lowered it to 14.52, which is still worse than lags alone, and those fields are missing on every test row. Adding station id raised test MAE to 15.28. Separate models per station were worse still (test MAE 17.93).

The next fit, when approved, should stay chronological with the same cuts, start from PM2.5 lags only, add the stations that still have PM2.5 after 2025-07-01, and only then add CPCB meteorology from the stations that actually report it. It replaces persistence only if the test MAE, including October–December, improves by a margin that shows up station by station.

## Plots

- `C:\Users\Harshad Chavan\Desktop\AeroTwin\ml\models\figures\diagnostics_24h_mae.png`
- `C:\Users\Harshad Chavan\Desktop\AeroTwin\ml\models\figures\diagnostics_horizon_mae.png`
- `C:\Users\Harshad Chavan\Desktop\AeroTwin\ml\models\figures\diagnostics_station_strategy_mae.png`
