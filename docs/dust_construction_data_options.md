# Dust and construction data options

No construction or dust layer is in the model or the API. Construction activity is not filled in from neighbourhood names.

## What was looked for

A source that names a site, a time, and an observable activity: a building permission, a commencement notice, a mapped construction polygon, or a dust measurement. A land-cover class and a citizen report are recorded separately because they are not that.

## Candidates

### PMC building permissions

- The municipal open-data portal (`opendata.punecorporation.org`) is the place a permission extract would honestly come from.
- The Indian Express reported on 7 April 2025 that the portal had been down since about 2018 and was being restored (https://indianexpress.com/article/cities/pune/pune-open-data-portal-updated-june-pmc-rahul-jagtap-9929928/).
- This project did not download a permission table. Until a file with application dates and locations is in hand, there is no construction series.

### OpenStreetMap `landuse=construction` and construction points

- Source: the same OSM extract as the road network (https://download.geofabrik.de/asia/india.html).
- Geography: Only features someone mapped. Absence of a tag is not evidence that a site does not exist.
- Time: The date of the map snapshot, not an excavation schedule.
- Status if used: `PROXY`. Incomplete volunteered geometry, not a permit.

### Bhuvan / remote-sensing land cover

- Bare soil or built-up change from NRSC Bhuvan, or from a later satellite difference, is a land-cover signal.
- Status if used: `MODELED` or `PROXY`, and the sensor, date, and class definition have to be written on the feature.
- It is not a list of construction sites and it is not a dust emission.

### CPCB meteorology already in the hourly table

- Rainfall, wind speed, and humidity exist only at the stations that report them (Katraj, SPPU, parts of Bhumkar and Pashan).
- Those fields are weather. They are not a dust source and they are not a construction inventory. They stay on the observation record.

### Citizen dust reports

- Designed in `docs/citizen_observation_design.md` as `CITIZEN_REPORTED`.
- One report does not create a construction site and does not change PM2.5.

## Decision

No dust or construction values are created. The first real series to pursue is a PMC permission or commencement extract with dates and locations. Until that file exists, the layer stays empty.
