import json
import os
import urllib.request

key = os.environ.get("OPENAQ_API_KEY")
if not key:
    raise SystemExit("Set OPENAQ_API_KEY or put it in backend/.env")
url = "https://api.openaq.org/v3/locations/11609/latest"
req = urllib.request.Request(url, headers={"X-API-Key": key})
with urllib.request.urlopen(req, timeout=10) as r:
    data = json.loads(r.read().decode("utf-8"))
    print(json.dumps(data["results"][:2], indent=2))
