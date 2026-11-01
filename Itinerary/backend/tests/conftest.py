"""Test setup. Provider responses are mocked here only (never in the running app)."""

import json
import os
import sys
from pathlib import Path

import httpx
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
FIXTURES = Path(__file__).parent / "fixtures"

KEYS = {
    "GOOGLE_MAPS_SERVER_KEY": "test-google",
    "GEOAPIFY_API_KEY": "test-geoapify",
    "NOMINATIM_USER_AGENT": "ItineraryTests/0.1 (test@example.com)",
    "OPENROUTESERVICE_API_KEY": "",
    "SERPAPI_API_KEY": "test-serp",
    "AVIATIONSTACK_API_KEY": "",
    "DUFFEL_API_KEY": "",
    "DATA_GOV_IN_API_KEY": "",
    "GTFS_BUS_FEED_DIR": "",
    "HTTP_MAX_RETRIES": "0",
    "DATABASE_URL": "sqlite+pysqlite:///:memory:",
}


def fixture(name: str):
    return json.loads((FIXTURES / name).read_text())


def configure(overrides: dict | None = None):
    from config import get_settings
    from integrations import registry
    from services import transport_service

    for k, v in {**KEYS, **(overrides or {})}.items():
        os.environ[k] = v
    get_settings.cache_clear()
    registry.reset()
    for f in (transport_service.flight_providers, transport_service.train_providers, transport_service.bus_providers):
        f.cache_clear()


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    # Keep a stray .env file from leaking real keys into tests.
    monkeypatch.chdir(Path(__file__).parent)
    # Provider rate limits protect real APIs; with mocked HTTP they only slow the tests down.
    from integrations import base

    async def no_wait(self):
        return None

    monkeypatch.setattr(base.RateLimiter, "acquire", no_wait)
    configure()
    yield
    from integrations import base
    base.set_client(None)


class Router:
    """Maps request host+path prefixes to canned responses and records calls."""

    def __init__(self):
        self.routes: list[tuple[str, object]] = []
        self.calls: list[httpx.Request] = []

    def add(self, prefix: str, response):
        self.routes.append((prefix, response))
        return self

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        url = f"{request.url.host}{request.url.path}"
        for prefix, resp in self.routes:
            if url.startswith(prefix):
                body = resp(request) if callable(resp) else resp
                if isinstance(body, httpx.Response):
                    return body
                return httpx.Response(200, json=body)
        return httpx.Response(404, json={"error": f"no mock for {url}"})


@pytest.fixture
def mock_http():
    from integrations import base

    router = Router()
    base.set_client(httpx.AsyncClient(transport=httpx.MockTransport(router.handler)))
    return router
