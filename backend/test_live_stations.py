"""Test the full live_service reading_for_station to see what actually gets returned."""
import sys
sys.path.insert(0, ".")

from app.services.live_service import fetch_snapshot, reading_for_station, AQIN_NAME_TO_STATION

print("=== Snapshot ===")
snap = fetch_snapshot()
print("ok:", snap["ok"])
print("page_updated_local:", snap.get("page_updated_local"))
print("city pm25:", snap.get("city", {}).get("pm25"))
print()
print("=== Stations found on aqi.in ===")
for s in snap.get("stations", []):
    print(f"  {s['name']!r:35} aqi={s['aqi_us']}  pm25={s['pm25']}  pm10={s['pm10']}")
print()
print("=== Mapping (CPCB id -> aqi.in slug) ===")
for name, sid in AQIN_NAME_TO_STATION.items():
    print(f"  {name!r} -> {sid}")
print()
print("=== Reading per station ===")
for station_id in ["site_5404", "site_5405", "site_5406", "site_5407", "site_5408", "site_5409", "site_5996", "site_6012"]:
    r = reading_for_station(station_id)
    print(f"  {station_id}: status={r['status']}  pm25={r.get('pm25')}  source_station={r.get('source_station')}  detail={r.get('detail', '')[:80]}")
