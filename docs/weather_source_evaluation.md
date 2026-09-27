# Weather source evaluation

The first six stations did not provide a citywide meteorology series. After the remaining labelled 15-minute files were read, four stations do: Savitribai Phule Pune University, Katraj Dairy, Panchawati Pashan, and Bhumkar Nagar. They report temperature, humidity, wind, rainfall, and solar radiation, with units in the CPCB header, and they still have PM2.5 in the July–December 2025 window. Those fields are observed CPCB values. They were not in the saved model. Pressure remains unusable (Karve Road only, median 876 against an mmHg label). Details are in `docs/meteorology_data_audit.md`.

The published hour-of-day curve peaks near hours 8 and 21–22 and bottoms at hour 15. That shape matches a local morning peak, afternoon low, and evening rise. It does not match the same cycle shifted by 5 hours 30 minutes. The more consistent reading is that the clock is Indian civil time and the `+0000` suffix was attached without a zone conversion. That is an inference from the diurnal cycle, not a conversion applied to the data.

No external weather file was downloaded for this review. Nothing here was imputed into the model.

## How a later join would be aligned

| Item | Current rule |
| --- | --- |
| Air-quality timestamp | Parsed from the OpenCity/CPCB `Timestamp` field with the published offset `+0000`. Not shifted. |
| Weather timestamp | Must be stored with an explicit offset from the weather provider. Not assumed to match the air-quality clock. |
| Timezone | Unresolved. The file offset is `+0000`. The CAAQMS station protocol uses local civil time. A third-party CPCB archive calls the 15-minute timestamp UTC. Those statements disagree. The median PM2.5 by published hour is in `docs/meteorology_data_audit.md`. It is evidence about the diurnal cycle, not a licence to relabel the clock. |
| Station coordinates | Not present in the OpenCity CSVs. A join to station-level weather needs coordinates from CPCB station metadata, cited, not guessed. |
| Weather location | Either one documented point per monitor, or one city reference point. A city point is a city-level series and must be labelled that way. |
| Resampling | Hourly mean for temperature, humidity, wind speed, solar radiation, and pressure. Hourly sum for rainfall, with an all-missing hour left missing rather than zero. Wind direction: circular mean. Join on the hour after both series are in the same documented clock. |
| Leakage | For a forecast issued at T, use weather observed at or before T, or a forecast that would have been available at T. Weather at T+24h from the historical record is not an input. |

## Candidates

### NASA POWER hourly (recommended practical source)

- What it is: NASA analysis-ready meteorology and solar data on a global grid (MERRA-2 and related products), not a CPCB sensor.
- Resolution: hourly. A point request uses one latitude/longitude. The native grid is coarse relative to the distance between Pune monitors, so this is a city-area series, not a reading in Bhosari or Hadapsar.
- Coverage: hourly meteorology from 1981 through near-real time, which covers 2024–2025.
- Variables and units: `T2M` °C, `RH2M` %, `WS10M` m/s, `WD10M` degrees, `PRECTOTCORR` mm/hour, `PS` kPa, `ALLSKY_SFC_SW_DWN` W/m². These line up with the empty CPCB fields.
- Clock: the API can return LST or UTC. The choice has to be written down next to the air-quality clock. Defaulting silently to either one is not acceptable.
- Access: HTTPS API, no key, CSV or JSON. Suitable for a hackathon.
- Licence: NASA POWER data is openly served for reuse. Cite NASA POWER. It is not an IMD or CPCB observation.
- Label required in the model card: reanalysis / NASA POWER, not “observed station weather”.
- Why it is first: it actually contains temperature, humidity, wind, rain, pressure, and solar radiation for every hour of the training and test period. The CPCB extract does not.

### NOAA GHCNh (observed station alternative)

- What it is: NOAA’s hourly land-station archive. It replaces ISD / Global Hourly. ISD itself is no longer updated past August 2025.
- Resolution: hourly or synoptic, depending on the station.
- Coverage: a Pune airport station is the likely series (Lohegaon). That is not the location of the CPCB monitors. The distance has to be stated once coordinates are in hand.
- Variables: temperature, dew point or humidity, wind, pressure, precipitation. Solar radiation is not part of the standard synoptic report.
- Access: NOAA NCEI / NODD bulk files. Usable in a hackathon, more awkward than POWER.
- Licence: NOAA publications are in the public domain. Non-US observations inside the older ISD product were under WMO Resolution 40, which restricts redistribution of another country’s data. GHCNh is the current product; keep the NOAA attribution and do not republish the raw file as if AeroTwin owned it.
- Use this if the project needs a surface observation rather than a gridded reanalysis, and accept the airport-versus-monitor mismatch.

### Meteostat

- Convenient hourly API and a Python client. Pune stations are in the catalog.
- The project site’s legal page distributes Meteostat data under CC BY-NC 4.0. The developer docs currently say CC BY 4.0. Those two statements conflict. Do not build the training set on Meteostat until that is resolved.
- Meteostat fills missing hours with model data unless that behaviour is turned off. Filled hours would violate the rule against unlabelled substitute observations.
- Not the source for V2.

### IMD

- The India Meteorological Department is the authoritative surface network.
- Hourly extracts are not a simple open download for a hackathon. `data.gov.in` holdings that turn up in search are mostly daily or station summaries, not a ready hourly join to these CPCB timestamps.
- Prefer IMD later if a documented bulk extract appears. Do not scrape a dashboard into the training table.

## Decision

Use the CPCB meteorology that is actually populated before calling an external API. The next weather experiment, when implementation is approved, is the stations that report both PM2.5 through the test window and AT/RH/WS/RF/SR: Savitribai Phule, Katraj Dairy, Pashan, and Bhumkar Nagar. Exclude BP. Do not fill the stations that left those columns empty.

NASA POWER is the fallback for a citywide series at the stations that report no meteorology (Mhada Colony, Nigdi, Shivajinagar, Hadapsar, Bhosari, Dhankawadi, Alandi). It has to be labelled reanalysis, with its clock written down next to the CPCB timestamp. It is not the first series to add.

Neither source becomes the primary 24-hour forecast unless the resulting model beats persistence on the held-out test, including the October–December months. See `docs/model_diagnostics.md`.
