"""Explore: nearby places by category across Google Places, Geoapify and OpenStreetMap (Overpass).
Paginated, de-duplicated, category-filtered, and details fetched only when a place is opened."""

import asyncio
import base64
import json

from catalog import CATEGORIES, RENTAL_GROUPS, Spec
from integrations import registry
from integrations.base import ProviderError, ProviderNotConfigured
from models.common import ProviderStatus
from models.place import Place, PlacesPage
from services import search_service
from services.discovery_dedupe import dedupe  # noqa: F401  (re-exported for callers and tests)

HIDDEN_GEM_MAX_REVIEWS = 600


def spec_for(category: str) -> Spec:
    if category in CATEGORIES:
        return CATEGORIES[category]
    if category in RENTAL_GROUPS:
        return search_service.merge_specs(category, "Vehicle rentals", [CATEGORIES[k] for k in RENTAL_GROUPS[category]])
    raise KeyError(category)


def known_category(category: str) -> bool:
    return category in CATEGORIES or category in RENTAL_GROUPS


def is_hidden_gem(p: Place) -> bool:
    """Lesser-known but good: Google 4.3+ with 20-600 reviews and not a headline tourist attraction;
    for OpenStreetMap (no ratings), a named place without a Wikidata entry."""
    if p.provider == "google":
        return (p.rating or 0) >= 4.3 and 20 <= (p.rating_count or 0) <= HIDDEN_GEM_MAX_REVIEWS and p.primary_type != "tourist_attraction"
    # OSM has no reviews: "lesser-known" = not famous (no Wikidata/brand) but documented (website, hours or phone).
    return (not p.wikidata and not any(t.startswith("tourism.attraction") for t in p.types)
            and bool(p.website or p.opening_hours or p.phone))


def bayes_rating(p: Place, m: int = 50, prior: float = 4.0) -> float | None:
    if p.rating is None:
        return None
    v = p.rating_count or 0
    return (v * p.rating + m * prior) / (v + m)


def _encode(c: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(c).encode()).decode()


def _decode(s: str | None) -> dict:
    if not s:
        return {"step": -1, "gt": None, "go": 0, "ov": True}
    try:
        return json.loads(base64.urlsafe_b64decode(s.encode()))
    except Exception as exc:
        raise ValueError("Invalid cursor") from exc


def sort_key(p: Place, rentals: bool) -> float:
    km = (p.distance_m or 0) / 1000
    if rentals:  # distance first, a better-rated shop can jump a little
        br = bayes_rating(p)
        return km - (max(0.0, br - 3.5) * 0.8 if br else 0)
    return km


async def nearby(lat: float, lng: float, radius_m: int, category: str, cursor: str | None) -> tuple[PlacesPage, list[ProviderStatus]]:
    spec = spec_for(category)
    rentals = category.startswith("rental") or category in RENTAL_GROUPS
    c = _decode(cursor)
    g, ga, op = registry.google_places(), registry.geoapify(), registry.overpass()
    statuses: list[ProviderStatus] = []

    async def google_part() -> list[Place]:
        step = c["step"]
        if step is None:
            return []
        if not g.configured():
            statuses.append(ProviderStatus(provider=g.label, state="not_configured", message="GOOGLE_MAPS_SERVER_KEY not set"))
            c["step"] = None
            return []
        try:
            if step == -1:
                c["step"] = 0
                if spec.primary_types:
                    return await g.nearby(lat, lng, radius_m, spec.primary_types, category, primary=True, exclude_primary=spec.exclude_types or None)
                step = 0
            if step >= len(spec.queries):
                c["step"] = None
                return []
            places, token = await g.text_search(spec.queries[step], lat, lng, radius_m, category, page_token=c.get("gt"))
            if token:
                c["step"], c["gt"] = step, token
            else:
                c["step"], c["gt"] = (step + 1 if step + 1 < len(spec.queries) else None), None
            return places
        except (ProviderError, ProviderNotConfigured) as exc:
            statuses.append(ProviderStatus(provider=g.label, state="error", message=str(exc)))
            c["step"] = None
            return []

    async def geoapify_part() -> list[Place]:
        offset = c.get("go")
        if offset is None or not spec.geoapify:
            c["go"] = None
            return []
        if not ga.configured():
            statuses.append(ProviderStatus(provider=ga.label, state="not_configured", message="GEOAPIFY_API_KEY not set"))
            c["go"] = None
            return []
        try:
            places = await ga.places(lat, lng, radius_m, spec.geoapify, category, limit=20, offset=offset)
        except (ProviderError, ProviderNotConfigured) as exc:
            statuses.append(ProviderStatus(provider=ga.label, state="error", message=str(exc)))
            c["go"] = None
            return []
        c["go"] = offset + 20 if len(places) >= 20 else None
        return places

    async def overpass_part() -> list[Place]:
        if not c.get("ov") or not spec.overpass:
            c["ov"] = False
            return []
        c["ov"] = False  # one query returns everything nearby
        try:
            return await op.search(spec.overpass, lat, lng, radius_m, category)
        except (ProviderError, ProviderNotConfigured) as exc:
            statuses.append(ProviderStatus(provider=op.label, state="error", message=str(exc)))
            return []

    gp, gap, ovp = await asyncio.gather(google_part(), geoapify_part(), overpass_part())
    for provider, got, used in ((g.label, gp, True), (ga.label, gap, bool(spec.geoapify)), (op.label, ovp, bool(spec.overpass))):
        if got:
            statuses.append(ProviderStatus(provider=provider, state="ok"))
        elif used and not any(s.provider == provider for s in statuses):
            statuses.append(ProviderStatus(provider=provider, state="empty", message="No matching places for this area"))

    merged = []
    for p in dedupe(gp + gap + ovp):
        if not search_service.category_ok(p, spec)[0]:
            continue
        if p.business_status and p.business_status != "OPERATIONAL":
            continue
        if spec.hidden_gem and not is_hidden_gem(p):
            continue
        merged.append(p)
    merged.sort(key=lambda p: sort_key(p, rentals))
    more = c.get("step") is not None or c.get("go") is not None
    return PlacesPage(places=merged, next_cursor=_encode(c) if more else None), statuses


async def text_search(query: str, lat: float, lng: float, radius_m: int) -> tuple[list[Place], list[ProviderStatus]]:
    """Free-text place search (used by "Add a stop"). Google only: Geoapify has no POI text search."""
    g = registry.google_places()
    if not g.configured():
        return [], [ProviderStatus(provider=g.label, state="not_configured", message="GOOGLE_MAPS_SERVER_KEY not set")]
    try:
        places, _ = await g.text_search(query, lat, lng, radius_m, None)
    except ProviderError as exc:
        return [], [ProviderStatus(provider=g.label, state="error", message=str(exc))]
    return places, [ProviderStatus(provider=g.label, state="ok" if places else "empty")]


async def details(place_id: str, category: str | None = None) -> Place | None:
    provider, _, native = place_id.partition(":")
    if provider == "google":
        return await registry.google_places().details(native, category)
    if provider == "geoapify":
        return await registry.geoapify().details(native, category)
    if provider == "osm":
        raise ValueError("OpenStreetMap places have no separate details lookup; the list already has everything")
    raise ValueError("Unknown place provider")

