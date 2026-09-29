"""Keep the suite off WAQI, Open-Meteo and OpenAQ unless a test opts in."""

import pytest

from app.services import live_service, maharashtra_service, openaq_service


@pytest.fixture(autouse=True)
def _offline_live_sources(monkeypatch):
    monkeypatch.setattr(openaq_service, "OPENAQ_API_KEY", "")
    monkeypatch.setattr(maharashtra_service, "OPENAQ_API_KEY", "")
    monkeypatch.setattr(maharashtra_service, "load_cache", lambda: None)
    monkeypatch.setattr(live_service, "fetch_waqi", lambda lat, lng: None)
    monkeypatch.setattr(live_service, "fetch_open_meteo", lambda lat, lng: None)
    live_service.clear_cache()
    yield
    live_service.clear_cache()
