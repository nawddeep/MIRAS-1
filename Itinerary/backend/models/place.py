from typing import Literal

from pydantic import BaseModel

from models.common import Provenance


class PhotoRef(BaseModel):
    """A provider photo reference. The image itself is fetched through /api/places/photo
    so no API key reaches the browser. Attributions must be shown with the photo."""

    ref: str
    width: int | None = None
    height: int | None = None
    attributions: list[str] = []


class OpeningPeriod(BaseModel):
    # day: 0 = Sunday ... 6 = Saturday (Google convention). Times are local "HH:MM".
    open_day: int
    open_time: str
    close_day: int | None = None
    close_time: str | None = None


class OpeningHours(BaseModel):
    weekday_text: list[str] = []
    periods: list[OpeningPeriod] = []
    open_now: bool | None = None
    raw: str | None = None  # e.g. an OSM opening_hours string we could not fully parse


class PriceRange(BaseModel):
    min: float | None = None
    max: float | None = None
    currency: str
    basis: str  # what the range means, e.g. "Google price range per person"


class Place(BaseModel):
    id: str  # "<provider>:<provider_place_id>", stable across requests
    provider: Literal["google", "geoapify", "nominatim", "osm"]
    provider_place_id: str
    google_place_id: str | None = None
    name: str
    category: str | None = None  # our category key, e.g. "artisans"
    types: list[str] = []
    primary_type: str | None = None
    business_status: str | None = None  # Google: OPERATIONAL / CLOSED_TEMPORARILY / CLOSED_PERMANENTLY
    wikidata: str | None = None  # OSM: Wikidata id, a sign the place is well documented
    vehicle_types: list[str] = []  # rentals: only what the provider states; empty = "not listed"
    address: str | None = None
    lat: float
    lng: float
    maps_url: str
    maps_url_is_listing: bool  # True only for Google's own googleMapsUri
    rating: float | None = None  # Google-sourced only
    rating_count: int | None = None
    opening_hours: OpeningHours | None = None
    website: str | None = None
    phone: str | None = None
    photos: list[PhotoRef] = []
    price_level: str | None = None
    price_range: PriceRange | None = None
    distance_m: float | None = None
    # Ranking (filled by the itinerary engine): transparent score and the reasons behind it.
    score: float | None = None
    score_reasons: list[str] = []
    hidden_gem: bool = False
    provenance: Provenance


class Suggestion(BaseModel):
    """Autocomplete row. Geocoded rows carry coordinates; Google rows need a details lookup."""

    id: str
    provider: str
    title: str
    subtitle: str | None = None
    lat: float | None = None
    lng: float | None = None
    google_place_id: str | None = None


class PlacesPage(BaseModel):
    places: list[Place]
    next_cursor: str | None = None
