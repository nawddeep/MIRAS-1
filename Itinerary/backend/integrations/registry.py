"""Single instances of every provider (they hold rate limiters and caches)."""

from functools import lru_cache

from integrations.geoapify.provider import Geoapify
from integrations.geocoding.nominatim import Nominatim
from integrations.google_places.provider import GooglePlaces
from integrations.osm.overpass import Overpass
from integrations.routing.providers import OSRM, GoogleRoutes, OpenRouteService
from integrations.weather.open_meteo import OpenMeteo


@lru_cache
def google_places() -> GooglePlaces:
    return GooglePlaces()


@lru_cache
def geoapify() -> Geoapify:
    return Geoapify()


@lru_cache
def nominatim() -> Nominatim:
    return Nominatim()


@lru_cache
def overpass() -> Overpass:
    return Overpass()


@lru_cache
def open_meteo() -> OpenMeteo:
    return OpenMeteo()


@lru_cache
def routing_chain() -> list:
    return [GoogleRoutes(), OpenRouteService(), OSRM()]


def reset() -> None:
    """Tests call this after changing settings."""
    for f in (google_places, geoapify, nominatim, overpass, open_meteo, routing_chain):
        f.cache_clear()
