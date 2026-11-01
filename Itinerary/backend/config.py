"""Environment-based settings. Every key is optional: a missing key makes that
provider report "not configured" and the next provider in the chain is tried."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    # Database: SQLite file by default (created on first run). Any SQLAlchemy URL works.
    database_url: str = "sqlite:///data/itinerary.db"

    # CORS: the Next.js frontend proxies /api through its own server, so this is
    # only needed when calling the API directly from a browser in development.
    cors_origins: str = "http://localhost:3000"

    # Priority 1
    google_maps_server_key: str = ""  # Places API (New) + Routes API. Server-side only.
    geoapify_api_key: str = ""
    nominatim_user_agent: str = ""  # Required by the Nominatim usage policy, e.g. "ItineraryApp/0.1 (you@example.com)"
    openrouteservice_api_key: str = ""
    osrm_base_url: str = "https://routing.openstreetmap.de"  # FOSSGIS servers: routed-foot / routed-bike / routed-car
    # OpenStreetMap Overpass (no key; fair use). Comma-separated: tried in order when one is busy.
    overpass_url: str = "https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter,https://overpass.kumi.systems/api/interpreter"

    # Priority 2
    serpapi_api_key: str = ""
    aviationstack_api_key: str = ""
    duffel_api_key: str = ""
    data_gov_in_api_key: str = ""
    data_gov_in_train_resource_id: str = ""
    gtfs_bus_feed_dir: str = ""  # Folder with an unzipped, authorised GTFS feed

    # Tuning
    http_timeout_seconds: float = 12.0
    http_max_retries: int = 2

    # Suggestion quality (Google places only: OpenStreetMap has no ratings)
    min_rating: float = 4.0
    min_reviews: int = 20
    hidden_gem_share: float = 0.34  # about 1 in 3 stops a day are lesser-known picks when available
    day_radius_m: int = 2500  # first search radius around each day's area; widened step by step if too few results

    # Travel modes
    # No open routing provider has a two-wheeler profile. Without Google Routes, two-wheeler time is derived
    # from the driving time x this factor (an assumption, labelled "Estimated" in the app).
    two_wheeler_factor: float = 0.85
    google_routes_traffic_aware: bool = False  # TRAFFIC_AWARE is billed at a higher Routes SKU

    # Developer-only: /api/debug/explain. Keep false in production.
    debug_endpoints: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
