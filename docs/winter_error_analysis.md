# Winter error analysis

Test rows whose target hour falls in October, November, or December 2025. The model column is `pred_v2a`, the V2 candidate with the lowest overall test MAE among V2-A, V2-B, and V2-C.

Figures below are computed from the test predictions. They are not a causal account of winter pollution.

| Month | n | Mean actual | Mean PM2.5 at T | Mean (actual − PM2.5 at T) | V0 MAE | Model MAE | Share of hours with actual > 90 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-10 | 5095 | 36.03 | 35.50 | 0.53 | 14.89 | 14.35 | 5.91% |
| 2025-11 | 4946 | 57.10 | 55.57 | 1.53 | 14.63 | 14.95 | 15.33% |
| 2025-12 | 5691 | 89.41 | 89.57 | -0.16 | 20.27 | 24.25 | 39.68% |

Mean (actual − PM2.5 at T) is the average bias of persistence. A positive value means the target hour was higher than the issue hour.

## December by published hour

| Hour | n | Mean actual | V0 MAE | Model MAE |
| --- | --- | --- | --- | --- |
| 0 | 230 | 109.38 | 22.68 | 28.37 |
| 1 | 235 | 113.23 | 22.74 | 32.58 |
| 2 | 236 | 111.94 | 22.03 | 34.67 |
| 3 | 231 | 109.85 | 22.60 | 35.52 |
| 4 | 229 | 106.55 | 23.97 | 35.04 |
| 5 | 229 | 102.71 | 25.07 | 32.97 |
| 6 | 231 | 105.04 | 27.22 | 33.94 |
| 7 | 220 | 106.67 | 27.72 | 33.50 |
| 8 | 218 | 112.44 | 27.96 | 34.14 |
| 9 | 229 | 111.87 | 21.70 | 29.71 |
| 10 | 236 | 100.49 | 20.58 | 25.61 |
| 11 | 245 | 87.01 | 18.24 | 21.05 |
| 12 | 245 | 74.22 | 15.86 | 17.10 |
| 13 | 238 | 65.34 | 13.62 | 13.92 |
| 14 | 243 | 58.39 | 14.58 | 13.65 |
| 15 | 247 | 55.67 | 15.02 | 13.63 |
| 16 | 250 | 55.71 | 14.40 | 13.86 |
| 17 | 249 | 58.05 | 16.38 | 14.61 |
| 18 | 249 | 61.62 | 17.63 | 16.22 |
| 19 | 252 | 70.28 | 16.84 | 15.70 |
| 20 | 244 | 82.65 | 17.72 | 17.84 |
| 21 | 239 | 95.15 | 20.09 | 21.81 |
| 22 | 236 | 103.44 | 23.18 | 26.76 |
| 23 | 230 | 104.37 | 21.95 | 26.20 |

## December by PM2.5 at the issue hour

| Level at T | n | Mean actual at T+24h | V0 MAE | Model MAE |
| --- | --- | --- | --- | --- |
| pm25_t <= 30 | 200 | 33.86 | 14.03 | 11.68 |
| 30 < pm25_t <= 60 | 1442 | 53.17 | 12.75 | 12.84 |
| 60 < pm25_t <= 90 | 1805 | 76.56 | 16.01 | 16.79 |
| pm25_t > 90 | 2244 | 127.97 | 29.08 | 38.70 |

## Largest persistence errors in Oct–Dec

| Target time | Station | Actual | PM2.5 at T | V0 | Model | AT | RH | WS | RF | SR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-10-11 21:00 | Savitribai Phule Pune University, Pune - MPCB | 49.32 | 538.46 | 538.46 | 75.05 | 24.19 | 75.98 | 0.35 | 0.00 | 0.00 |
| 2025-10-10 21:00 | Savitribai Phule Pune University, Pune - MPCB | 538.46 | 76.07 | 76.07 | 71.78 | 24.21 | 80.53 | 0.16 | 0.00 | 0.00 |
| 2025-10-11 22:00 | Savitribai Phule Pune University, Pune - MPCB | 53.29 | 493.53 | 493.53 | 57.41 | 23.61 | 79.97 | 0.44 | 0.00 | 0.00 |
| 2025-10-10 03:00 | Savitribai Phule Pune University, Pune - MPCB | 536.81 | 105.17 | 105.17 | 38.24 | 22.84 | 85.37 | 0.29 | 0.00 | 0.00 |
| 2025-10-21 22:00 | Hadapsar, Pune - IITM | 442.74 | 18.33 | 18.33 | 23.25 | n/a | n/a | n/a | n/a | n/a |
| 2025-10-11 03:00 | Savitribai Phule Pune University, Pune - MPCB | 114.86 | 536.81 | 536.81 | 110.88 | 22.18 | 85.42 | 0.43 | 0.00 | 0.00 |
| 2025-10-10 22:00 | Savitribai Phule Pune University, Pune - MPCB | 493.53 | 74.84 | 74.84 | 64.23 | 23.96 | 82.03 | 0.35 | 0.00 | 0.00 |
| 2025-10-21 23:00 | Hadapsar, Pune - IITM | 444.61 | 29.63 | 29.63 | 24.73 | n/a | n/a | n/a | n/a | n/a |
| 2025-10-22 23:00 | Hadapsar, Pune - IITM | 54.94 | 444.61 | 444.61 | 56.43 | n/a | n/a | n/a | n/a | n/a |
| 2025-10-22 22:00 | Hadapsar, Pune - IITM | 71.14 | 442.74 | 442.74 | 91.28 | n/a | n/a | n/a | n/a | n/a |
| 2025-12-26 22:00 | Hadapsar, Pune - IITM | 541.21 | 174.54 | 174.54 | 213.86 | n/a | n/a | n/a | n/a | n/a |
| 2025-10-09 04:00 | Savitribai Phule Pune University, Pune - MPCB | 395.72 | 31.41 | 31.41 | 27.45 | 21.57 | 84.13 | 0.41 | 0.00 | 0.00 |

## Largest model errors in Oct–Dec

| Target time | Station | Actual | PM2.5 at T | V0 | Model | AT | RH | WS | RF | SR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2025-10-10 03:00 | Savitribai Phule Pune University, Pune - MPCB | 536.81 | 105.17 | 105.17 | 38.24 | 22.84 | 85.37 | 0.29 | 0.00 | 0.00 |
| 2025-10-10 21:00 | Savitribai Phule Pune University, Pune - MPCB | 538.46 | 76.07 | 76.07 | 71.78 | 24.21 | 80.53 | 0.16 | 0.00 | 0.00 |
| 2025-10-10 22:00 | Savitribai Phule Pune University, Pune - MPCB | 493.53 | 74.84 | 74.84 | 64.23 | 23.96 | 82.03 | 0.35 | 0.00 | 0.00 |
| 2025-10-21 23:00 | Hadapsar, Pune - IITM | 444.61 | 29.63 | 29.63 | 24.73 | n/a | n/a | n/a | n/a | n/a |
| 2025-10-21 22:00 | Hadapsar, Pune - IITM | 442.74 | 18.33 | 18.33 | 23.25 | n/a | n/a | n/a | n/a | n/a |
| 2025-10-10 04:00 | Savitribai Phule Pune University, Pune - MPCB | 432.46 | 395.72 | 395.72 | 59.29 | 22.50 | 85.41 | 0.38 | 0.00 | 0.00 |
| 2025-10-09 04:00 | Savitribai Phule Pune University, Pune - MPCB | 395.72 | 31.41 | 31.41 | 27.45 | 21.57 | 84.13 | 0.41 | 0.00 | 0.00 |
| 2025-12-26 22:00 | Hadapsar, Pune - IITM | 541.21 | 174.54 | 174.54 | 213.86 | n/a | n/a | n/a | n/a | n/a |
| 2025-10-11 06:00 | Savitribai Phule Pune University, Pune - MPCB | 365.69 | 78.44 | 78.44 | 60.48 | 21.59 | 85.44 | 0.35 | 0.00 | 0.00 |
| 2025-10-09 05:00 | Savitribai Phule Pune University, Pune - MPCB | 324.06 | 31.19 | 31.19 | 27.08 | 21.48 | 84.37 | 0.34 | 0.00 | 0.00 |
| 2025-12-11 23:00 | Hadapsar, Pune - IITM | 353.43 | 294.28 | 294.28 | 92.15 | n/a | n/a | n/a | n/a | n/a |
| 2025-10-21 23:00 | Bhumkar Nagar, Pune - IITM | 370.25 | 213.25 | 213.25 | 113.43 | 26.30 | 19.00 | n/a | 0.00 | 28.50 |
