"""Validate the staleness detection logic."""
import sys
sys.path.insert(0, "backend")
from app.services.observation_service import latest_observations, _network_archive_age, STALE_THRESHOLD_HOURS

age = _network_archive_age()
print(f"Network archive age: {age:.1f} hours ({age/24:.1f} days)")
print(f"Stale threshold: {STALE_THRESHOLD_HOURS} hours")
print(f"Is stale: {age > STALE_THRESHOLD_HOURS}")
print()
obs = latest_observations()
for o in obs:
    print(f"  {o['station_id']}: pm25={o['pm25']}, age={o['archive_age_hours']}h, stale={o['archive_stale']}, ts={o['timestamp']}")
