"""Live aqi.in readings stay separate from the CPCB archive."""

from app.config import STATUS_DATA_UNAVAILABLE, STATUS_OBSERVED
from app.services import live_service
from app.services.environment_service import environmental_situation
from app.services.forecast_service import forecast_station
from app.services.live_service import fetch_snapshot, parse_dashboard

FIXTURE = """
<p>Last Updated: <strong>2026-09-28 03:21</strong> (Local Time)</p>
<span class="font-extrabold">63<span class="uppercase">AQI (US)</span></span>
<span>PM2.5<!-- --> : </span><span><span class="font-bold">16</span></span>
<span>pm10<!-- --> : </span><span><span class="font-bold">19</span></span>
<div id="row-1"><a href="https://www.aqi.in/in/dashboard/india/maharashtra/pune/shivajinagar">Shivajinagar</a>
<span class="font-bold text-center">60</span>
<span class="font-bold text-center">17</span>
<span class="font-bold text-center">21</span></div>
<div id="row-2"><a href="https://www.aqi.in/in/dashboard/india/maharashtra/pune/bhosale-nagar">Bhosale Nagar</a>
<span class="font-bold text-center">40</span>
<span class="font-bold text-center">11</span>
<span class="font-bold text-center">12</span></div>
<div id="row-3"><a href="https://www.aqi.in/in/dashboard/india/maharashtra/pune/pashan-hill-trail">Pashan Hill Trail</a>
<span class="font-bold text-center">50</span>
<span class="font-bold text-center">14</span>
<span class="font-bold text-center">16</span></div>
<div id="row-4"><a href="https://www.aqi.in/in/dashboard/india/maharashtra/pune/pashan">Pashan</a>
<span class="font-bold text-center">48</span>
<span class="font-bold text-center">13</span>
<span class="font-bold text-center">15</span></div>
"""


def _use(monkeypatch, html=FIXTURE):
    monkeypatch.setattr(live_service, "fetch_snapshot", lambda: parse_dashboard(html))


def test_parser_reads_city_and_neighborhood_pm25():
    parsed = parse_dashboard(FIXTURE)
    assert parsed["city"]["pm25"] == 16
    assert parsed["city"]["aqi_us"] == 63
    assert parsed["page_updated_local"] == "2026-09-28 03:21"
    by_name = {row["name"]: row["pm25"] for row in parsed["stations"]}
    assert by_name["Shivajinagar"] == 17
    assert by_name["Bhosale Nagar"] == 11
    assert by_name["Pashan"] == 13


def test_shared_name_does_not_replace_the_cpcb_hour(monkeypatch):
    _use(monkeypatch)
    before = forecast_station("site_5409")
    body = environmental_situation("site_5409")
    assert forecast_station("site_5409") == before
    assert body["current_observation"]["pm25"] == before["current_pm25"]
    assert body["forecast"]["pm25"] == before["forecast_pm25_24h"]
    assert body["forecast"]["forecast_status"] == "observed_baseline"
    live = body["live_reading"]
    assert live["status"] == STATUS_OBSERVED
    assert live["pm25"] == 17
    assert live["same_monitor"] is False
    assert live["source_station"] == "Shivajinagar"
    assert live["archive_unchanged"] is True
    assert live["forecast_unchanged"] is True
    assert live["pm25"] != body["current_observation"]["pm25"]


def test_unlisted_monitor_stays_unavailable(monkeypatch):
    _use(monkeypatch)
    live = environmental_situation("site_5404")["live_reading"]
    assert live["status"] == STATUS_DATA_UNAVAILABLE
    assert live["pm25"] is None
    assert live["source_station"] is None
    assert live["city"]["pm25"] == 16
    assert "not used as this station" in live["detail"]


def test_bhosale_nagar_is_not_bhosari(monkeypatch):
    _use(monkeypatch)
    live = environmental_situation("site_5406")["live_reading"]
    assert live["pm25"] is None
    assert live["status"] == STATUS_DATA_UNAVAILABLE


def test_pashan_hill_trail_is_not_the_pashan_monitor(monkeypatch):
    _use(monkeypatch)
    live = environmental_situation("site_5996")["live_reading"]
    assert live["source_station"] == "Pashan"
    assert live["pm25"] == 13


def test_failed_fetch_does_not_invent_a_number(monkeypatch):
    def boom():
        raise OSError("down")

    live_service.clear_cache()
    monkeypatch.setattr(live_service, "fetch_html", boom)
    monkeypatch.setattr(live_service, "fetch_snapshot", fetch_snapshot)
    live = live_service.reading_for_station("site_5409")
    assert live["status"] == STATUS_DATA_UNAVAILABLE
    assert live["pm25"] is None
    assert live["city"] is None
