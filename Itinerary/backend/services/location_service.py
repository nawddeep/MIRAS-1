"""Search-as-you-type, explicit geocoding and resolving a picked suggestion to coordinates."""

from integrations import registry
from integrations.base import try_chain
from models.common import ProviderStatus
from models.place import Suggestion


async def autocomplete(text: str, near: tuple[float, float] | None, session: str | None) -> tuple[list[Suggestion], list[ProviderStatus]]:
    # Nominatim is deliberately not in this chain: its policy forbids autocomplete.
    g, ga = registry.google_places(), registry.geoapify()

    async def call(p):
        return await (p.autocomplete(text, near, session) if p is g else p.autocomplete(text, near))

    result, statuses = await try_chain([g, ga], call)
    return result or [], statuses


async def geocode(text: str) -> tuple[list[Suggestion], list[ProviderStatus]]:
    result, statuses = await try_chain([registry.geoapify(), registry.nominatim()], lambda p: p.geocode(text))
    return result or [], statuses


async def resolve_google(place_id: str, session: str | None) -> Suggestion | None:
    place = await registry.google_places().details(place_id, session=session)
    if not place:
        return None
    return Suggestion(
        id=place.id, provider="google", title=place.name, subtitle=place.address,
        lat=place.lat, lng=place.lng, google_place_id=place.google_place_id,
    )


async def nearest_airports(lat: float, lng: float) -> tuple[list[dict], list[ProviderStatus]]:
    result, statuses = await try_chain([registry.geoapify()], lambda p: p.nearest_airports(lat, lng))
    return result or [], statuses
