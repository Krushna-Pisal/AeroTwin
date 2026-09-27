"""Download real OpenCity/CPCB Pune air-quality CSVs.

Does not generate observations. Existing files are left untouched unless
--overwrite is passed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from aq_common import METADATA_PATH, RAW_DIR, SOURCE_DATASET_URL, ensure_dirs

CKAN_API = (
    "https://data.opencity.in/api/3/action/package_show"
    "?id=pune-hourly-air-quality-reports"
)
USER_AGENT = "AeroTwin-local-pipeline/1.0 (educational; CPCB via OpenCity)"

# Used only if the CKAN API cannot be reached. These URLs were read from that API.
FALLBACK_RESOURCES = [
    {"name": "Alandi IITM AQI Data 2017-2023", "id": "38290549-5b3d-4778-a916-029c70d88254", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/38290549-5b3d-4778-a916-029c70d88254/download/a9407013-dba4-48fe-afda-bb951f4f3cfe.csv"},
    {"name": "Bhosari IITM AQI Data 2017-2023", "id": "15d82ada-9e8f-474c-93b7-f0f616295bad", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/15d82ada-9e8f-474c-93b7-f0f616295bad/download/6c9be432-4a82-4661-972f-e4ac9be0d252.csv"},
    {"name": "Hadapsar IITM AQI Data 2017-2023", "id": "c5659bc4-bbcf-4a35-84b9-4f5e8270c8f5", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/c5659bc4-bbcf-4a35-84b9-4f5e8270c8f5/download/5ec1c512-c3f1-4ef6-81eb-4a5147241377.csv"},
    {"name": "Karve Road MPCB AQI Data 2017-2023", "id": "a00761c0-a1a7-4513-b58b-2f940b8b64ff", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/a00761c0-a1a7-4513-b58b-2f940b8b64ff/download/f421cdb4-57de-42ad-bd16-0bfd54e79cae.csv"},
    {"name": "Katraj Dairy MPCB AQI Data 2023", "id": "2eb9d843-b66f-4bf2-8080-7b7b9ea445e8", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/2eb9d843-b66f-4bf2-8080-7b7b9ea445e8/download/bce229f1-23a9-4805-acd0-e21a6c72691b.csv"},
    {"name": "Mhada Colony IITM AQI Data 2017-2023", "id": "34d740b6-8912-4df8-907d-d782e1f0aafa", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/34d740b6-8912-4df8-907d-d782e1f0aafa/download/697e0d85-930c-4990-972f-1ad9eac2db05.csv"},
    {"name": "MIT-Kothrud IITM AQI Data 2017-2023", "id": "98aad25d-5975-4afc-8c01-e96abb2ce9bc", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/98aad25d-5975-4afc-8c01-e96abb2ce9bc/download/7ac0c4c7-01a3-4311-8617-41a0b1cf03d9.csv"},
    {"name": "Revenue Colony-Shivajinagar IITM AQI Data 2017-2023", "id": "cccbaca5-350c-4725-8a80-a4431c71caf6", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/cccbaca5-350c-4725-8a80-a4431c71caf6/download/fbf99e33-887b-4a97-8861-fe44d24cb48a.csv"},
    {"name": "Savitribai Phule University MPCB AQI Data 2023", "id": "38a40ce7-ef14-48c0-8855-352470c763f6", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/38a40ce7-ef14-48c0-8855-352470c763f6/download/932cbc17-1ef0-4c1c-ada6-fa63221b4459.csv"},
    {"name": "Transport Nagar-Nigdi IITM AQI Data 2017-2023", "id": "64cfe8b6-edff-446a-8083-d27fa5b9269f", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/64cfe8b6-edff-446a-8083-d27fa5b9269f/download/3db44ac9-ef90-41c4-b915-ff751de81679.csv"},
    {"name": "Alandi IITM 15 minute AQI Data for 2024-25", "id": "70f9292d-f5ab-4b7d-8220-481b3e8c4ace", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/70f9292d-f5ab-4b7d-8220-481b3e8c4ace/download/pune-alandi-iitm-2024-25.csv"},
    {"name": "Bhosari IITM 15 minute AQI Data for 2024-25", "id": "c6bdd375-eacc-4584-bc64-82d139fd344f", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/c6bdd375-eacc-4584-bc64-82d139fd344f/download/pune-bhosari-iitm-2024-25.csv"},
    {"name": "Bhumkar Nagar IITM 15 minute AQI Data for 2024-25", "id": "7cc44628-08e5-40d3-b323-4e6246f5d868", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/7cc44628-08e5-40d3-b323-4e6246f5d868/download/pune-bhumkar-nagar-iitm-2024-25.csv"},
    {"name": "Dhankawadi IITM 15 minute AQI Data for 2025", "id": "d62efc0d-c847-4c24-a5aa-a4dd2cf8b925", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/d62efc0d-c847-4c24-a5aa-a4dd2cf8b925/download/pune-dhankawadi-iitm-2025.csv"},
    {"name": "Hadapsar IITM 15 minute AQI Data for 2024-25", "id": "59a536da-dd4d-4597-b84e-bcfc85fa2fca", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/59a536da-dd4d-4597-b84e-bcfc85fa2fca/download/pune-hadapsar-iitm-2024-25.csv"},
    {"name": "Karve Road MPCB 15 minute AQI Data for 2024-25", "id": "42ae24da-8bd1-46ce-8acb-df2b3b5aa677", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/42ae24da-8bd1-46ce-8acb-df2b3b5aa677/download/pune-karve-road-mpcb-2024-25.csv"},
    {"name": "Katraj Dairy MPCB 15 minute AQI Data for 2024-25", "id": "f427afcc-4e7d-4092-81ac-cd823584b325", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/f427afcc-4e7d-4092-81ac-cd823584b325/download/pune-katraj-dairy-mpcb-2024-25.csv"},
    {"name": "Mhada Colony IITM 15 minute AQI Data for 2024-25", "id": "938b7b23-63b7-479b-a7aa-2afc32c1ad09", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/938b7b23-63b7-479b-a7aa-2afc32c1ad09/download/pune-mhada-colony-iitm-2024-25.csv"},
    {"name": "Panchawati_Pashan IITM 15 minute AQI Data for 2024-25", "id": "da12ee9d-21bf-4f5d-98d4-052b3a85c216", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/da12ee9d-21bf-4f5d-98d4-052b3a85c216/download/pune-panchawati_pashan-iitm-2024-25.csv"},
    {"name": "Revenue Colony Shivajinagar 15 minute AQI Data for 2024-25", "id": "de7ed9dd-5be3-4e9d-b142-85a85f4d910d", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/de7ed9dd-5be3-4e9d-b142-85a85f4d910d/download/pune-revenue-colony-shivajinagar-iitm-2024-25.csv"},
    {"name": "Savitribai Phule Pune University MPCB 15 minute AQI Data for 2024-25", "id": "bcd8e8ae-d0f7-466f-a502-913e4bca220b", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/bcd8e8ae-d0f7-466f-a502-913e4bca220b/download/pune-savitribai-phule-pune-university-mpcb-2024-25.csv"},
    {"name": "Transport Nagar Nigdi 15 minute AQI Data for 2024-25", "id": "0aaa077d-2dfd-4b22-9fad-485357f075a8", "url": "https://data.opencity.in/dataset/b16b4972-1d7e-4b7e-b1d6-23228cc63c83/resource/0aaa077d-2dfd-4b22-9fad-485357f075a8/download/pune-transport-nagar-nigdi-iitm-2024-25.csv"},
]

PRIORITY_NEEDLES = (
    "bhosari",
    "hadapsar",
    "karve road",
    "mhada colony",
    "kothrud",
    "revenue colony",
    "transport nagar",
)


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def resolution_of(name: str) -> str:
    lowered = name.lower()
    if "15 minute" in lowered or "15-minute" in lowered:
        return "15min"
    return "hourly_wide"


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:90]


def is_priority(name: str) -> bool:
    lowered = name.lower()
    return any(needle in lowered for needle in PRIORITY_NEEDLES)


def fetch_resources() -> tuple[list[dict], str]:
    request = urllib.request.Request(CKAN_API, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode("utf-8"))
        resources = []
        for item in payload["result"]["resources"]:
            if str(item.get("format", "")).upper() != "CSV":
                continue
            resources.append(
                {
                    "name": item["name"],
                    "id": item["id"],
                    "url": item["url"],
                    "description": item.get("description") or "",
                }
            )
        if not resources:
            raise RuntimeError("CKAN package returned no CSV resources")
        return resources, "ckan_api"
    except Exception as exc:  # noqa: BLE001 - fallback is the point
        print(f"CKAN API unavailable ({exc}). Using embedded resource list.")
        return FALLBACK_RESOURCES, "embedded_fallback"


def download_file(url: str, dest: Path) -> str:
    """Stream to a .part file, then rename. Returns sha256 hex."""
    partial = dest.with_suffix(dest.suffix + ".part")
    if partial.exists():
        partial.unlink()
    digest = hashlib.sha256()
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=180) as response, partial.open("wb") as handle:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
            handle.write(chunk)
    partial.replace(dest)
    return digest.hexdigest()


def load_metadata() -> dict:
    if METADATA_PATH.exists():
        return json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    return {
        "source_dataset": SOURCE_DATASET_URL,
        "files": [],
    }


def upsert_file_record(metadata: dict, record: dict) -> None:
    files = metadata.setdefault("files", [])
    for index, existing in enumerate(files):
        if existing.get("file_name") == record["file_name"]:
            files[index] = record
            return
    files.append(record)


def main() -> int:
    parser = argparse.ArgumentParser(description="Download OpenCity Pune CPCB CSVs")
    parser.add_argument(
        "--include-15min",
        action="store_true",
        help="Include 15-minute labelled station files (also on by default).",
    )
    parser.add_argument(
        "--hourly-only",
        action="store_true",
        help="Download only the 2017-2023 wide hourly resources.",
    )
    parser.add_argument(
        "--skip-hourly",
        action="store_true",
        help="Skip the 2017-2023 wide hourly resources.",
    )
    parser.add_argument(
        "--all-stations",
        action="store_true",
        help="Download every station in the dataset, not only the starting set.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace an existing raw file. Without this flag, existing files are kept.",
    )
    args = parser.parse_args()

    if args.hourly_only and args.skip_hourly:
        print("Choose either --hourly-only or --skip-hourly, not both.")
        return 2

    ensure_dirs()
    resources, catalog_source = fetch_resources()
    selected = []
    for resource in resources:
        name = resource["name"]
        if not args.all_stations and not is_priority(name):
            continue
        resolution = resolution_of(name)
        if args.hourly_only and resolution != "hourly_wide":
            continue
        if args.skip_hourly and resolution == "hourly_wide":
            continue
        selected.append(resource)

    if not selected:
        print("No resources matched the filters.")
        return 1

    metadata = load_metadata()
    metadata["source_dataset"] = SOURCE_DATASET_URL
    metadata["catalog_source"] = catalog_source
    metadata["last_run_at"] = utc_now()
    failures = 0

    print(f"Resources selected: {len(selected)} (catalog: {catalog_source})")
    for resource in selected:
        resolution = resolution_of(resource["name"])
        file_name = f"{slugify(resource['name'])}__{resolution}.csv"
        dest = RAW_DIR / file_name
        record = {
            "file_name": file_name,
            "station": resource["name"],
            "source_url": resource["url"],
            "resource_id": resource["id"],
            "temporal_resolution": resolution,
            "source_dataset": SOURCE_DATASET_URL,
            "description": resource.get("description", ""),
        }
        if dest.exists() and dest.stat().st_size > 0 and not args.overwrite:
            record.update(
                {
                    "download_date": None,
                    "bytes": dest.stat().st_size,
                    "sha256": None,
                    "status": "skipped_existing",
                }
            )
            # Keep a prior hash/date if we already recorded this file.
            previous = next(
                (item for item in metadata.get("files", []) if item.get("file_name") == file_name),
                None,
            )
            if previous:
                record["download_date"] = previous.get("download_date")
                record["sha256"] = previous.get("sha256")
            upsert_file_record(metadata, record)
            print(f"skip  {file_name} ({dest.stat().st_size} bytes)")
            continue
        print(f"get   {file_name}")
        try:
            sha = download_file(resource["url"], dest)
        except Exception as exc:  # noqa: BLE001 - report and continue
            failures += 1
            print(f"FAIL  {file_name}: {exc}")
            continue
        record.update(
            {
                "download_date": utc_now(),
                "bytes": dest.stat().st_size,
                "sha256": sha,
                "status": "downloaded",
            }
        )
        upsert_file_record(metadata, record)
        print(f"saved {file_name} ({record['bytes']} bytes)")

    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"metadata {METADATA_PATH}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
