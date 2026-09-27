# Industrial data options

No industrial layer is in the model or the API. A future variable is named `industrial_activity_proxy`. It is not named industrial emissions, and a facility point is not an emission rate.

## Candidates

### OpenStreetMap industrial land use and points

- Source: OpenStreetMap tags such as `landuse=industrial` and industrial `building` or `man_made` features, from the same Geofabrik India extract as the road network (https://download.geofabrik.de/asia/india.html).
- Example of a mapped area, not an inventory: MIDC Bhosari is an OSM industrial land-use polygon (https://mapcarta.com/W106620876, OSM id noted there). One polygon does not mean the extract is complete.
- Geography: Whatever volunteers have mapped in Pune and Pimpri-Chinchwad. Coverage is uneven.
- Time: Current snapshot. Not an operating-hours or production series.
- Resolution: Polygons and points.
- Access and licence: ODbL, same as the road extract.
- What it is: A map of places tagged industrial. Status if used: `PROXY` for activity presence. It does not say how much the facility emits, or whether it was operating.

### PM GatiShakti industrial parks

- Source: Ministry of Commerce and Industry industrial-park boundaries, served from the GatiShakti GIS (`park_boundary_iis_cluster` on `ugi.pmgatishakti.gov.in`) and republished by the Datameet indian-open-maps project: https://github.com/ramSeraph/indian_industries/releases/tag/general
- Geography: A national park-boundary layer. Pune-region parks are not clipped in this repository yet, so this note does not claim a local count.
- Time: The published boundary snapshot, not a production time series.
- Resolution: Park polygons.
- Access: The government WMS, and a Datameet GeoJSON/PMTiles republication under a stated CC0 dedication with a request to attribute Datameet and the government source. Confirm the government terms before redistributing a clip.
- What it is: An industrial-area boundary. Status if used: `PROXY` for the presence of an industrial zone. Not emissions.

### MIDC area lists

- Maharashtra Industrial Development Corporation publishes named industrial areas (Bhosari, Pimpri, Chakan, Ranjangaon, and others in the Pune region) as administrative estates.
- This pass did not download a MIDC parcel shapefile with coordinates for every plot.
- A name list without geometry is not a map layer. A boundary, once obtained from MIDC or from the GatiShakti layer, is still an area, not an emission.

### MPCB consent documents

- Consent and authorisation PDFs name facilities and addresses. They are evidence that a facility has a regulatory file.
- They are not a geospatial layer unless each address is geocoded, and geocoding an address is not a measurement of the stack.
- They are not used as emission factors here.

### Bhuvan land use / land cover

- NRSC Bhuvan thematic land cover (https://bhuvan-app1.nrsc.gov.in/thematic/) includes built-up and industrial classes at mapping scales such as 1:50,000 or the SISDP 10k product.
- Datameet republishes a Bhuvan SISDP land-use extract: https://github.com/ramSeraph/indian_land_features/releases/tag/landuse
- Time: Multi-year mapping epochs, not hourly activity.
- What it is: Land cover. An industrial class pixel is `PROXY` for land use. It is not a facility and not an emission.

## Decision

The first candidate to validate, when a file is actually clipped to Pune, is the GatiShakti park boundary or OSM `landuse=industrial`, stored as `industrial_activity_proxy` with status `PROXY`. Neither file is loaded now. Neither is joined to the PM2.5 model.
