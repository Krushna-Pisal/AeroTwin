# V2 model evaluation

Source: https://data.opencity.in/dataset/pune-hourly-air-quality-reports

V2 uses hourly means of labelled 15-minute CPCB observations. Alandi and Karve Road are not in the fit. Wide 2017–2023 files are not in the fit. No traffic, industry, dust, or citizen observations are used.

## Clock

Timestamps stay on the published `+0000` offset. They were not shifted to IST. The diurnal shape is consistent with Indian civil time, but that remains an inference. Lags, weather, and the train/validation/test cuts all use this same clock.

Train rows have target time before 2025-01-01. Validation targets run from 2025-01-01 up to, but not including, 2025-07-01. Test targets are on or after 2025-07-01. The earlier six-station score used issue time on or after 2025-07-01, so its MAE of 12.76 is not the V0 number in this table. V0 here is persistence on this 10-station test set.

## Stations excluded from the fit

- Alandi, Pune - IITM (site_5405): 24042 PM2.5 rows, last observation 2025-01-28 11:00:00+00:00. No PM2.5 observations on or after 2025-07-01, so the station cannot be scored on the test window.
- Karve Road, Pune - MPCB (site_292): 42919 PM2.5 rows, last observation 2025-05-23 21:00:00+00:00. No PM2.5 observations on or after 2025-07-01, so the station cannot be scored on the test window.

## Coverage

- Stations in the model: 10
- Hourly rows, including hours with missing PM2.5: 162450
- Hours with observed PM2.5: 119823
- Eligible rows (PM2.5 at T and at T+24h): train 49558, validation 31189, test 31022
- Series: 2024-01-01 00:00:00+00:00 to 2025-12-30 23:00:00+00:00

| Station | Hourly rows | PM2.5 % | AT % | RH % | WS % | WD % | RF % | SR % | PM2.5 last |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mhada Colony, Pune - IITM | 17544 | 90.78 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 2025-12-31 23:00:00+00:00 |
| Bhosari, Pune - IITM | 17077 | 54.28 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 2025-12-12 12:00:00+00:00 |
| Hadapsar, Pune - IITM | 14174 | 50.40 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 2025-12-31 23:00:00+00:00 |
| Transport Nagar-Nigdi, Pune - IITM | 17544 | 82.01 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 2025-12-31 23:00:00+00:00 |
| Revenue Colony-Shivajinagar, Pune - IITM | 17536 | 85.71 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 2025-12-31 23:00:00+00:00 |
| Katraj Dairy, Pune - MPCB | 17544 | 79.38 | 80.05 | 80.06 | 79.58 | 79.69 | 80.30 | 80.06 | 2025-12-31 23:00:00+00:00 |
| Savitribai Phule Pune University, Pune - MPCB | 17544 | 91.91 | 94.45 | 94.44 | 94.43 | 94.43 | 94.45 | 94.45 | 2025-12-31 23:00:00+00:00 |
| Bhumkar Nagar, Pune - IITM | 17544 | 72.76 | 67.93 | 67.93 | 0.49 | 10.17 | 67.93 | 60.70 | 2025-12-31 23:00:00+00:00 |
| Panchawati_Pashan, Pune - IITM | 17544 | 62.50 | 59.54 | 59.54 | 59.63 | 59.53 | 64.19 | 0.00 | 2025-12-31 23:00:00+00:00 |
| Dhankawadi, Pune - IITM | 8399 | 51.03 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 2025-12-31 09:00:00+00:00 |

Rows with PM2.5 at T and T+24h that also have all six weather fields: 27612 of 111769 (24.70%). V2-A, V2-B, and V2-C do not drop the incomplete rows. XGBoost leaves a missing weather value missing.

## Test metrics

| Model | Features | n | MAE | RMSE | R² |
| --- | --- | --- | --- | --- | --- |
| V0 | PM2.5(T+24h) = PM2.5(T) | 31022 | 11.52 | 22.17 | 0.699 |
| V2-A | PM2.5 lags only | 31022 | 11.88 | 22.74 | 0.683 |
| V2-B | lags + observed CPCB weather, missing left missing | 31022 | 12.41 | 23.55 | 0.660 |
| V2-C | lags + weather + calendar | 31022 | 13.94 | 26.13 | 0.582 |
| V2-D | lags + short-gap and train-only station median weather | 31022 | 12.30 | 23.50 | 0.662 |
| V2-E | lags + weather + station id | 31022 | 12.62 | 24.49 | 0.632 |

Validation MAE, not used to pick hyperparameters:

| Model | n | MAE | RMSE | R² |
| --- | --- | --- | --- | --- |
| V0 | 31189 | 10.70 | 18.81 | 0.552 |
| V2-A | 31189 | 9.99 | 16.65 | 0.649 |
| V2-B | 31189 | 9.97 | 16.42 | 0.659 |
| V2-C | 31189 | 10.87 | 17.36 | 0.619 |
| V2-D | 31189 | 9.96 | 16.42 | 0.659 |
| V2-E | 31189 | 9.94 | 16.37 | 0.661 |

## Station-wise test MAE

| Station | V0 | V2-A | V2-B | V2-C |
| --- | --- | --- | --- | --- |
| Mhada Colony, Pune - IITM | 11.76 | 13.26 | 14.14 | 15.86 |
| Bhosari, Pune - IITM | 5.23 | 4.25 | 4.33 | 4.01 |
| Hadapsar, Pune - IITM | 24.69 | 28.07 | 29.80 | 32.70 |
| Transport Nagar-Nigdi, Pune - IITM | 9.07 | 8.47 | 8.58 | 9.46 |
| Revenue Colony-Shivajinagar, Pune - IITM | 16.50 | 19.41 | 21.53 | 22.59 |
| Katraj Dairy, Pune - MPCB | 8.03 | 7.34 | 7.71 | 9.26 |
| Savitribai Phule Pune University, Pune - MPCB | 11.77 | 10.93 | 11.46 | 11.65 |
| Bhumkar Nagar, Pune - IITM | 15.15 | 15.49 | 15.31 | 18.49 |
| Panchawati_Pashan, Pune - IITM | 7.39 | 7.61 | 7.99 | 9.92 |
| Dhankawadi, Pune - IITM | 10.91 | 10.76 | 10.97 | 12.30 |

Station-wise test scores for persistence and the lags-only model:

| Station | n | V0 MAE | V0 RMSE | V0 R² | V2-A MAE | V2-A RMSE | V2-A R² |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mhada Colony, Pune - IITM | 4095 | 11.76 | 18.36 | 0.818 | 13.26 | 23.47 | 0.703 |
| Bhosari, Pune - IITM | 1756 | 5.23 | 18.91 | -9.077 | 4.25 | 5.49 | 0.151 |
| Hadapsar, Pune - IITM | 1739 | 24.69 | 44.65 | 0.576 | 28.07 | 49.68 | 0.475 |
| Transport Nagar-Nigdi, Pune - IITM | 3375 | 9.07 | 12.92 | 0.765 | 8.47 | 12.00 | 0.797 |
| Revenue Colony-Shivajinagar, Pune - IITM | 2229 | 16.50 | 24.18 | 0.728 | 19.41 | 29.27 | 0.601 |
| Katraj Dairy, Pune - MPCB | 3606 | 8.03 | 14.31 | 0.518 | 7.34 | 12.17 | 0.651 |
| Savitribai Phule Pune University, Pune - MPCB | 3428 | 11.77 | 30.13 | 0.146 | 10.93 | 24.75 | 0.424 |
| Bhumkar Nagar, Pune - IITM | 3996 | 15.15 | 25.67 | 0.734 | 15.49 | 27.38 | 0.698 |
| Panchawati_Pashan, Pune - IITM | 4041 | 7.39 | 11.67 | 0.786 | 7.61 | 11.78 | 0.782 |
| Dhankawadi, Pune - IITM | 2757 | 10.91 | 17.78 | 0.711 | 10.76 | 17.65 | 0.716 |

## October–December test scores

| Month | Model | n | MAE | RMSE | R² |
| --- | --- | --- | --- | --- | --- |
| 2025-10 | V0 | 5095 | 14.89 | 32.07 | 0.247 |
| 2025-10 | V2-A | 5095 | 14.35 | 28.41 | 0.409 |
| 2025-10 | V2-B | 5095 | 14.49 | 28.04 | 0.425 |
| 2025-10 | V2-C | 5095 | 18.68 | 31.49 | 0.274 |
| 2025-11 | V0 | 4946 | 14.63 | 21.36 | 0.598 |
| 2025-11 | V2-A | 4946 | 14.95 | 21.71 | 0.585 |
| 2025-11 | V2-B | 4946 | 15.59 | 22.40 | 0.558 |
| 2025-11 | V2-C | 4946 | 17.98 | 25.28 | 0.436 |
| 2025-12 | V0 | 5691 | 20.27 | 30.78 | 0.589 |
| 2025-12 | V2-A | 5691 | 24.25 | 38.29 | 0.364 |
| 2025-12 | V2-B | 5691 | 25.91 | 40.64 | 0.283 |
| 2025-12 | V2-C | 5691 | 29.30 | 45.42 | 0.105 |

## Test MAE by target month

| Month | V0 | V2-A | V2-B | V2-C |
| --- | --- | --- | --- | --- |
| 2025-07 | 6.14 | 5.50 | 5.67 | 5.33 |
| 2025-08 | 5.59 | 5.07 | 5.37 | 5.07 |
| 2025-09 | 6.75 | 5.89 | 5.99 | 5.63 |
| 2025-10 | 14.89 | 14.35 | 14.49 | 18.68 |
| 2025-11 | 14.63 | 14.95 | 15.59 | 17.98 |
| 2025-12 | 20.27 | 24.25 | 25.91 | 29.30 |

## Promotion

A V2 candidate is viable only if its overall test MAE is lower than persistence, no station is worse by more than 5 µg/m³, October–December together improve, and December is not worse by more than 3 µg/m³.

Production forecast: `V0_persistence`.
No V2 candidate met that bar. Persistence remains the production 24-hour forecast.

- V2-A: overall improvement -0.36 µg/m³, Oct–Dec improved: False, December gap (model − persistence): 3.98, stations worse by more than 5: 0, viable: False.
- V2-B: overall improvement -0.89 µg/m³, Oct–Dec improved: False, December gap (model − persistence): 5.64, stations worse by more than 5: 2, viable: False.
- V2-C: overall improvement -2.41 µg/m³, Oct–Dec improved: False, December gap (model − persistence): 9.03, stations worse by more than 5: 2, viable: False.
- V2-D: overall improvement -0.78 µg/m³, Oct–Dec improved: False, December gap (model − persistence): 5.58, stations worse by more than 5: 2, viable: False.
- V2-E: overall improvement -1.09 µg/m³, Oct–Dec improved: False, December gap (model − persistence): 7.00, stations worse by more than 5: 1, viable: False.

## Plots

- `C:\Users\Harshad Chavan\Desktop\AeroTwin\ml\models\figures\v2_test_mae.png`
- `C:\Users\Harshad Chavan\Desktop\AeroTwin\ml\models\figures\v2_monthly_mae.png`
