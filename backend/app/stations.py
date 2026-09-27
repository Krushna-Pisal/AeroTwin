"""Station registry.

Coordinates are copied only from a published station table. OpenCity CSVs do
not contain latitude or longitude. Dhankawadi is absent from that table.
Karve Road is left without a point because two published figures disagree.
"""

from __future__ import annotations

# Zeel Patel, station_data.csv, Hugging Face Zeel/C1 commit 42e881d, 2024-08-03.
# Columns in that file: station, address, latitude, longitude.
# https://huggingface.co/datasets/Zeel/C1/commit/42e881d36b577e448945039259fd1b5d7dfa2f31
COORDINATE_SOURCE = (
    "CPCB station name, address, latitude, and longitude as republished in "
    "Zeel/C1 station_data.csv, commit 42e881d (2024-08-03). "
    "Not present in the OpenCity CSV. Not resurveyed for this project."
)

# Serving table is data/processed/v2_hourly.parquet: labelled stations that
# have PM2.5 inside the July–December 2025 window.
SERVING_IDS = {
    "site_5404",
    "site_5406",
    "site_5407",
    "site_5408",
    "site_5409",
    "site_5766",
    "site_5767",
    "site_5988",
    "site_5996",
    "site_6012",
}

STATIONS: list[dict] = [
    {
        "station_id": "site_5404",
        "station_name": "Mhada Colony, Pune - IITM",
        "latitude": 18.57304,
        "longitude": 73.927715,
        "coordinate_status": "source_table",
        "pm25_available": True,
        "in_serving_table": True,
    },
    {
        "station_id": "site_5406",
        "station_name": "Bhosari, Pune - IITM",
        "latitude": 18.640051,
        "longitude": 73.848956,
        "coordinate_status": "source_table",
        "pm25_available": True,
        "in_serving_table": True,
    },
    {
        "station_id": "site_5407",
        "station_name": "Hadapsar, Pune - IITM",
        "latitude": 18.501793,
        "longitude": 73.927532,
        "coordinate_status": "source_table",
        "pm25_available": True,
        "in_serving_table": True,
    },
    {
        "station_id": "site_5408",
        "station_name": "Transport Nagar-Nigdi, Pune - IITM",
        "latitude": 18.664282,
        "longitude": 73.763966,
        "coordinate_status": "source_table",
        "pm25_available": True,
        "in_serving_table": True,
    },
    {
        "station_id": "site_5409",
        "station_name": "Revenue Colony-Shivajinagar, Pune - IITM",
        "latitude": 18.530085,
        "longitude": 73.849598,
        "coordinate_status": "source_table",
        "pm25_available": True,
        "in_serving_table": True,
    },
    {
        "station_id": "site_5766",
        "station_name": "Katraj Dairy, Pune - MPCB",
        "latitude": 18.45445,
        "longitude": 73.854155,
        "coordinate_status": "source_table",
        "pm25_available": True,
        "in_serving_table": True,
    },
    {
        "station_id": "site_5767",
        "station_name": "Savitribai Phule Pune University, Pune - MPCB",
        "latitude": 18.547056,
        "longitude": 73.826908,
        "coordinate_status": "source_table",
        "pm25_available": True,
        "in_serving_table": True,
    },
    {
        "station_id": "site_5988",
        "station_name": "Bhumkar Nagar, Pune - IITM",
        "latitude": 18.60577,
        "longitude": 73.749976,
        "coordinate_status": "source_table",
        "pm25_available": True,
        "in_serving_table": True,
    },
    {
        "station_id": "site_5996",
        "station_name": "Panchawati_Pashan, Pune - IITM",
        "latitude": 18.536457,
        "longitude": 73.805454,
        "coordinate_status": "source_table",
        "pm25_available": True,
        "in_serving_table": True,
    },
    {
        "station_id": "site_6012",
        "station_name": "Dhankawadi, Pune - IITM",
        "latitude": None,
        "longitude": None,
        "coordinate_status": "unavailable",
        "coordinate_note": (
            "Not in the 2024-08-03 station table. The station's OpenCity file "
            "starts in 2025 and has no latitude or longitude. A neighbourhood "
            "centroid is not the monitor location."
        ),
        "pm25_available": True,
        "in_serving_table": True,
    },
    {
        "station_id": "site_5405",
        "station_name": "Alandi, Pune - IITM",
        "latitude": 18.675076,
        "longitude": 73.892743,
        "coordinate_status": "source_table",
        "pm25_available": True,
        "in_serving_table": False,
        "serving_note": "Historical PM2.5 ends 2025-01-28. Excluded from the production hourly table and from the July–December 2025 test.",
    },
    {
        "station_id": "site_292",
        "station_name": "Karve Road, Pune - MPCB",
        "latitude": None,
        "longitude": None,
        "coordinate_status": "unresolved",
        "coordinate_note": (
            "Two published figures disagree, so no point is stored. "
            "Zeel/C1 station_data.csv lists 18.5011743, 73.8165527. "
            "The MPCB CAAQMS page for Pune M.C. Regional Office Building, Karve Road "
            "prints Latitude 18° 30.751 and Longitude 73° 50.377' "
            "(decimal degrees about 18.51252 N, 73.83962 E): "
            "https://mpcb.ecmpcb.in/air%20quality/air_caaqms_01.php. "
            "PM2.5 at this station ends 2025-05-23 and is not in the serving table."
        ),
        "pm25_available": True,
        "in_serving_table": False,
        "serving_note": "Historical PM2.5 ends 2025-05-23. Excluded from the production hourly table and from the July–December 2025 test.",
    },
]


def by_id(station_id: str) -> dict | None:
    for station in STATIONS:
        if station["station_id"] == station_id:
            return station
    return None
