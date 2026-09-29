"""Keep the suite off the public live page and OpenAQ unless a test opts in."""

import pytest

from app.services import live_service, maharashtra_service, openaq_service


@pytest.fixture(autouse=True)
def _offline_live_page(monkeypatch):
    monkeypatch.setattr(openaq_service, "OPENAQ_API_KEY", "")
    monkeypatch.setattr(maharashtra_service, "OPENAQ_API_KEY", "")
    monkeypatch.setattr(maharashtra_service, "load_cache", lambda: None)
    monkeypatch.setattr(
        live_service,
        "fetch_snapshot",
        lambda: {
            "ok": False,
            "source": "aqi.in",
            "source_url": "https://www.aqi.in/in/dashboard/india/maharashtra/pune",
            "retrieved_at": None,
            "page_updated_local": None,
            "city": None,
            "stations": [],
            "detail": "The live page could not be read. No number was filled in.",
        },
    )
