"""Keep the suite off the public live page unless a test opts in."""

import pytest

from app.services import live_service


@pytest.fixture(autouse=True)
def _offline_live_page(monkeypatch):
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
