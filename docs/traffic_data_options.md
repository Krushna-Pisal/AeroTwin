# Traffic data options

No traffic series is in the model and none is in the API. This note separates a road map, a measured count, a probe-derived speed, and a modeled volume. A proxy is not created here.

## What would count as each kind

| Kind | Status | Example |
| --- | --- | --- |
| Real traffic observation | `OBSERVED` | A roadside counter, toll plaza, or signal detector with a stated location and time |
| Probe speed or density | `OBSERVED` only for the probe sample; coverage is not a traffic census | Anonymised floating-car speeds with a sample size |
| Modeled volume | `MODELED` | A vendor estimate of vehicles per hour expanded from probes |
| Road geometry or class | Neither volume nor congestion | OpenStreetMap `highway=*` |
| Traffic proxy | `PROXY` | Anything substituted for volume, such as road class alone or a citizen congestion report |

## Candidates

### OpenStreetMap via Geofabrik

- Source: OpenStreetMap, India extracts at https://download.geofabrik.de/asia/india.html (Western Zone contains Maharashtra). Geofabrik also documents the India extract.
- Geography: Pune is inside the national and western extracts. A Pune subset has to be clipped. It is not a separate official city file on that index page.
- Time: The extract is a current map snapshot, normally updated daily. It is not a historical traffic series. OSM history can show when a road was edited. That is not vehicle flow.
- Resolution: Individual road ways, with `highway` classification (motorway, trunk, primary, and so on).
- Access: Free download of the `.osm.pbf`.
- Licence: Open Database Licence (ODbL). Attribution and share-alike apply. Geofabrik strips user names from the public extracts.
- Historical traffic: No.
- Use later: Road network and road class only. Not a traffic volume.

### TomTom Traffic Stats

- Source: https://developer.tomtom.com/traffic-stats/documentation/product-information/introduction and https://www.tomtom.com/products/traffic-stats/
- Geography: TomTom states coverage across its traffic network in more than 70 countries. A Pune extract was not downloaded in this pass, so city coverage is not confirmed by a local file.
- Time: Historical speeds and travel times from floating-car probes. The product page describes archive analysis for a chosen date range and time slices.
- Resolution: Road segment, by direction, inside a route or an area.
- Access: Commercial API and the MOVE portal. A short evaluation trial is advertised. It is not an open download.
- Licence: Proprietary. Redistribution of the probe data is limited by the TomTom agreement.
- Historical traffic: Yes, as probe-derived speed and travel time, not as a municipal counter.
- Label if used: probe observation for speed where the sample size is published; not a complete traffic count.

### TomTom Historical Traffic Volumes

- Source: https://www.tomtom.com/products/historical-traffic-volumes/
- What it is: Estimated vehicles on a segment (annual, monthly, daily, or hourly average). The product sheet says volumes are produced by data modeling on floating-car data, not by a roadside census.
- Geography and access: Same commercial constraint as Traffic Stats. Not downloaded here.
- Label if used: `MODELED`. Not `OBSERVED` traffic, and not a proxy we invent ourselves.

### Pune Municipal Corporation open data

- Source: `opendata.punecorporation.org`, as reported by The Indian Express on 7 April 2025: https://indianexpress.com/article/cities/pune/pune-open-data-portal-updated-june-pmc-rahul-jagtap-9929928/
- Reported state: The portal had been unusable since about 2018. The municipal chief data officer said it was being restored, with a target of mid-May to 1 June 2025, and that a move to `smartcities.data.gov.in` had been discussed and had not happened.
- This project did not retrieve a working PMC traffic-count file.
- If a later file is a detector count with a location and a time, it can be `OBSERVED`. A road list without counts stays geometry only.

### Not used

- Google traffic tiles and the Roads API are not an open historical archive and are not licensed for this store.
- Uber Movement is discontinued and is not a current feed.
- No congestion index is synthesised from PM2.5.

## Decision

The first real layer that can be added without a vendor contract is the OSM road network, labelled as road geometry and class. It is not traffic. Measured or probe traffic waits until a file or API response is actually in hand, with its licence written next to it.
