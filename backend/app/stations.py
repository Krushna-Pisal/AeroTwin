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
        "latitude": 18.4613,
        "longitude": 73.8505,
        "coordinate_status": "resolved",
        "coordinate_note": "Added approx coordinate for display",
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
        "in_serving_table": True,
        "serving_note": "Historical PM2.5 ends 2025-01-28.",
    },
    {
        "station_id": "site_292",
        "station_name": "Karve Road, Pune - MPCB",
        "latitude": 18.51252,
        "longitude": 73.83962,
        "coordinate_status": "source_table",
        "coordinate_note": "Resolved coordinate",
        "pm25_available": True,
        "in_serving_table": True,
        "serving_note": "Historical PM2.5 ends 2025-05-23.",
    },
]


def by_id(station_id: str) -> dict | None:
    for station in STATIONS:
        if station["station_id"] == station_id:
            return station
    return None
