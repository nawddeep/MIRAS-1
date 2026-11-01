"""Itinerary API. Run: uvicorn main:app --reload (from this folder). Docs at /docs."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import db
from config import get_settings
from integrations import base
from routers import itinerary, places, transport, weather

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("main")
# httpx logs full request URLs at INFO, which would include API keys passed as query parameters.
logging.getLogger("httpx").setLevel(logging.WARNING)

PROVIDER_KEYS = {
    "Google Places + Routes": "google_maps_server_key",
    "Geoapify": "geoapify_api_key",
    "Nominatim": "nominatim_user_agent",
    "OpenRouteService": "openrouteservice_api_key",
    "SerpApi (Google Flights)": "serpapi_api_key",
    "Aviationstack": "aviationstack_api_key",
    "Duffel": "duffel_api_key",
    "data.gov.in trains": "data_gov_in_api_key",
    "GTFS buses": "gtfs_bus_feed_dir",
}


def provider_config() -> dict[str, bool]:
    s = get_settings()
    return {name: bool(getattr(s, key)) for name, key in PROVIDER_KEYS.items()}


@asynccontextmanager
async def lifespan(app: FastAPI):
    for name, ok in provider_config().items():
        if not ok:
            log.warning("%s is not configured: its results will show as 'not configured'", name)
    app.state.db_ok = db.init_db()
    yield
    client = base._client
    if client:
        await client.aclose()
        base.set_client(None)


app = FastAPI(
    title="Itinerary API",
    version="0.1.0",
    description="Trip planning and nearby discovery. Displays provider data and links out; it never books.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type", "X-Edit-Token"],
)
for r in (places.router, weather.router, transport.router, itinerary.router):
    app.include_router(r)


@app.get("/api/status", tags=["meta"])
async def status():
    return {
        "providers": provider_config(),
        "always_available": ["Open-Meteo (weather, elevation)", "OSRM on FOSSGIS servers (routing fallback)"],
        "database": getattr(app.state, "db_ok", False),
    }
