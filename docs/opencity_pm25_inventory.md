# OpenCity labelled PM2.5 inventory

Dataset: https://data.opencity.in/dataset/pune-hourly-air-quality-reports

Scope: every CSV resource in the Pune package. Counts for 15-minute files are computed from the CSV on disk (non-null PM2.5 after numeric parsing). This CKAN site does not expose `datastore_search_sql`. Wide 2017–2023 files are listed separately and are not PM2.5.

The test window used here is timestamps at or after 2025-07-01, matching the current forecast test cut. That count is non-null PM2.5 rows in the 15-minute file, before hourly aggregation.

## Labelled 15-minute resources

| Station | Resource | Resolution | Rows | PM2.5 non-null | PM2.5 missing % | Start | End | PM2.5 rows from 2025-07-01 | Already local? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mhada Colony, Pune - IITM (site_5404) | Mhada Colony IITM 15 minute AQI Data for 2024-25 | 15-minute | 63728 | 62257 | 2.31 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:30:00+00:00 | 16607 | yes |
| Panchawati_Pashan, Pune - IITM (site_5996) | Panchawati_Pashan IITM 15 minute AQI Data for 2024-25 | 15-minute | 70176 | 42928 | 38.83 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:45:00+00:00 | 16526 | yes |
| Bhumkar Nagar, Pune - IITM (site_5988) | Bhumkar Nagar IITM 15 minute AQI Data for 2024-25 | 15-minute | 70176 | 49445 | 29.54 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:45:00+00:00 | 16123 | yes |
| Katraj Dairy, Pune - MPCB (site_5766) | Katraj Dairy MPCB 15 minute AQI Data for 2024-25 | 15-minute | 70176 | 53487 | 23.78 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:45:00+00:00 | 14725 | yes |
| Transport Nagar-Nigdi, Pune - IITM (site_5408) | Transport Nagar Nigdi 15 minute AQI Data for 2024-25 | 15-minute | 57184 | 55836 | 2.36 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:30:00+00:00 | 14293 | yes |
| Savitribai Phule Pune University, Pune - MPCB (site_5767) | Savitribai Phule Pune University MPCB 15 minute AQI Data for 2024-25 | 15-minute | 70176 | 62345 | 11.16 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:45:00+00:00 | 13865 | yes |
| Dhankawadi, Pune - IITM (site_6012) | Dhankawadi IITM 15 minute AQI Data for 2025 | 15-minute | 17686 | 16719 | 5.47 | 2025-01-15 11:15:00+00:00 | 2025-12-31 09:30:00+00:00 | 12796 | yes |
| Revenue Colony-Shivajinagar, Pune - IITM (site_5409) | Revenue Colony Shivajinagar 15 minute AQI Data for 2024-25 | 15-minute | 62593 | 58619 | 6.35 | 2024-01-01 08:30:00+00:00 | 2025-12-31 23:15:00+00:00 | 9310 | yes |
| Hadapsar, Pune - IITM (site_5407) | Hadapsar IITM 15 minute AQI Data for 2024-25 | 15-minute | 29796 | 27651 | 7.20 | 2024-05-20 10:00:00+00:00 | 2025-12-31 23:30:00+00:00 | 7416 | yes |
| Bhosari, Pune - IITM (site_5406) | Bhosari IITM 15 minute AQI Data for 2024-25 | 15-minute | 37599 | 36178 | 3.78 | 2024-01-01 00:00:00+00:00 | 2025-12-12 12:30:00+00:00 | 7118 | yes |
| Alandi, Pune - IITM (site_5405) | Alandi IITM 15 minute AQI Data for 2024-25 | 15-minute | 24884 | 24042 | 3.38 | 2024-01-01 00:00:00+00:00 | 2025-01-28 11:00:00+00:00 | 0 | yes |
| Karve Road, Pune - MPCB (site_292) | Karve Road MPCB 15 minute AQI Data for 2024-25 | 15-minute | 70176 | 42919 | 38.84 | 2024-01-01 00:00:00+00:00 | 2025-12-31 23:45:00+00:00 | 0 | yes |

## Unlabelled 2017–2023 resources

These are not PM2.5 inventories. See `docs/opencity_legacy_data_audit.md` for the seven files that were opened. Alandi, Katraj Dairy, and Savitribai Phule wide files were not downloaded. A datastore sample of the same package shows that this resource type is an hour-column matrix with no PM2.5 field. They are not counted as labelled PM2.5.

| Resource | Downloaded |
| --- | --- |
| Alandi IITM AQI Data 2017-2023 | no |
| Bhosari IITM AQI Data 2017-2023 | yes |
| Hadapsar IITM AQI Data 2017-2023 | yes |
| Karve Road MPCB AQI Data 2017-2023 | yes |
| Katraj Dairy MPCB AQI Data 2023 | no |
| Mhada Colony IITM AQI Data 2017-2023 | yes |
| MIT-Kothrud IITM AQI Data 2017-2023 | yes |
| Revenue Colony-Shivajinagar IITM AQI Data 2017-2023 | yes |
| Savitribai Phule University MPCB AQI Data 2023 | no |
| Transport Nagar-Nigdi IITM AQI Data 2017-2023 | yes |

## Stations that clear the coverage bar

A station is listed here when PM2.5 is present on at least half of its rows and at least 1,000 non-null PM2.5 rows fall on or after 2025-07-01. Being listed is not a decision to retrain.

- Mhada Colony, Pune - IITM (site_5404): 16607 PM2.5 rows from 2025-07-01, missing 2.31% overall. included in the saved six-station model.
- Panchawati_Pashan, Pune - IITM (site_5996): 16526 PM2.5 rows from 2025-07-01, missing 38.83% overall. CSV is on disk, not in the saved model.
- Bhumkar Nagar, Pune - IITM (site_5988): 16123 PM2.5 rows from 2025-07-01, missing 29.54% overall. CSV is on disk, not in the saved model.
- Katraj Dairy, Pune - MPCB (site_5766): 14725 PM2.5 rows from 2025-07-01, missing 23.78% overall. CSV is on disk, not in the saved model.
- Transport Nagar-Nigdi, Pune - IITM (site_5408): 14293 PM2.5 rows from 2025-07-01, missing 2.36% overall. included in the saved six-station model.
- Savitribai Phule Pune University, Pune - MPCB (site_5767): 13865 PM2.5 rows from 2025-07-01, missing 11.16% overall. CSV is on disk, not in the saved model.
- Dhankawadi, Pune - IITM (site_6012): 12796 PM2.5 rows from 2025-07-01, missing 5.47% overall. CSV is on disk, not in the saved model.
- Revenue Colony-Shivajinagar, Pune - IITM (site_5409): 9310 PM2.5 rows from 2025-07-01, missing 6.35% overall. included in the saved six-station model.
- Hadapsar, Pune - IITM (site_5407): 7416 PM2.5 rows from 2025-07-01, missing 7.20% overall. included in the saved six-station model.
- Bhosari, Pune - IITM (site_5406): 7118 PM2.5 rows from 2025-07-01, missing 3.78% overall. included in the saved six-station model.

Dhankawadi is 2025-only. It can help the test window only if its PM2.5 count above is large enough; it cannot extend training back into 2024.
