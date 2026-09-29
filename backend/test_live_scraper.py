"""Quick test: fetch aqi.in Pune page and test current regexes."""
import urllib.request
import re

url = "https://www.aqi.in/in/dashboard/india/maharashtra/pune"
try:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        html = r.read().decode("utf-8", "replace")
    print("Length:", len(html))

    # Test current regexes
    head, _, rest = html.partition('id="row-')
    aqi = re.search(r">(\d+(?:\.\d+)?)<span[^>]*>AQI \(US\)", head)
    pm25 = re.search(r'PM2\.5[\s\S]{0,220}?font-bold\">([0-9]+(?:\.[0-9]+)?)', head)
    updated = re.search(r"Last Updated:\s*<strong>([^<]+)</strong>", html)
    print("AQI match:", aqi.group(1) if aqi else "NO MATCH")
    print("PM2.5 match:", pm25.group(1) if pm25 else "NO MATCH")
    print("Updated:", updated.group(1) if updated else "NO MATCH")

    # Print head for inspection
    print("--- Head snippet (first 4000 chars) ---")
    print(head[:4000])
except Exception as e:
    print("FAILED:", type(e).__name__, e)
