"""Spec-driven place search shared by the planner and Explore.

fetch(): run every provider query for a catalog Spec around a point, merge and de-duplicate.
category_ok(): the post-filter that drops places contradicting the category (e.g. diners under cafes).
quality_ok(): operational businesses, minimum rating and review count (Google only; OSM has no ratings).
Every step is recorded in a request-scoped trace for /api/debug/explain."""

import asyncio
import contextvars

from catalog import Spec
from integrations import registry
from integrations.base import ProviderError, ProviderNotConfigured
from models.common import ProviderStatus
from models.place import Place
from services.discovery_dedupe import dedupe

_trace: contextvars.ContextVar[list | None] = contextvars.ContextVar("search_trace", default=None)


def start_trace() -> list:
    t: list = []
    _trace.set(t)
    return t


def record(**entry) -> None:
    t = _trace.get()
    if t is not None:
        t.append(entry)


GOOGLE_TEXT_QUERIES = 3


def category_ok(p: Place, spec: Spec) -> tuple[bool, str | None]:
    """False plus a reason when the place clearly conflicts with the category."""
    if spec.excludes_name(p.name):
        return False, f"name conflicts with {spec.label}"
    if not spec.requires_name(p.name):
        return False, f"name doesn't indicate {spec.label}"
    if p.provider == "google":
        if p.primary_type and p.primary_type in spec.exclude_types:
            return False, f"primary type {p.primary_type} excluded for {spec.label}"
        if spec.allowed_types:
            if p.primary_type:
                if p.primary_type not in spec.allowed_types:
                    return False, f"primary type {p.primary_type} is not one of {', '.join(spec.allowed_types)}"
            elif not set(p.types) & set(spec.allowed_types):
                return False, "no matching Google type"
    if p.provider == "geoapify" and spec.geoapify_require:
        if not any(t.startswith(req) for t in p.types for req in spec.geoapify_require):
            return False, f"OSM category doesn't match {spec.label}"
    return True, None


def quality_ok(p: Place, min_rating: float, min_reviews: int) -> tuple[bool, str | None]:
    if p.business_status and p.business_status != "OPERATIONAL":
        return False, f"business status {p.business_status}"
    if p.provider == "google":
        if p.rating is None or (p.rating_count or 0) < min_reviews:
            return False, f"fewer than {min_reviews} Google reviews"
        if p.rating < min_rating:
            return False, f"rating {p.rating} below {min_rating}"
    return True, None


async def fetch(
    spec: Spec, lat: float, lng: float, radius_m: int, statuses: list[ProviderStatus], *,
    pages: int = 2, with_hours: bool = False, tag: str = "",
) -> list[Place]:
    """All provider queries for one spec around one point, merged, de-duplicated and category-filtered."""
    g, ga, op = registry.google_places(), registry.geoapify(), registry.overpass()
    jobs: list[tuple[str, str, asyncio.Future]] = []

    async def google_text(q: str) -> list[Place]:
        out, token = [], None
        for _ in range(pages):
            places, token = await g.text_search(q, lat, lng, radius_m, spec.key, page_token=token, with_hours=with_hours)
            out += places
            if not token:
                break
        return out

    async def geo_pages() -> list[Place]:
        out = []
        for i in range(pages):
            batch = await ga.places(lat, lng, radius_m, spec.geoapify, spec.key, limit=20, offset=i * 20)
            out += batch
            if len(batch) < 20:
                break
        return out

    if g.configured() and not g.blocked():
        if spec.primary_types:
            jobs.append(("Google Places", f"nearby primary={spec.primary_types}", g.nearby(
                lat, lng, radius_m, spec.primary_types, spec.key, primary=True, exclude_primary=spec.exclude_types or None)))
        for q in spec.queries[:GOOGLE_TEXT_QUERIES]:
            jobs.append(("Google Places", f'text "{q}"', google_text(q)))
    elif not g.configured():
        statuses.append(ProviderStatus(provider=g.label, state="not_configured", message="GOOGLE_MAPS_SERVER_KEY not set"))
    if spec.geoapify:
        if ga.configured():
            jobs.append(("Geoapify", f"categories={','.join(spec.geoapify)}", geo_pages()))
        else:
            statuses.append(ProviderStatus(provider=ga.label, state="not_configured", message="GEOAPIFY_API_KEY not set"))
    if spec.overpass and op.configured():
        jobs.append(("OpenStreetMap (Overpass)", "; ".join(spec.overpass), op.search(spec.overpass, lat, lng, radius_m, spec.key)))

    results = await asyncio.gather(*(j[2] for j in jobs), return_exceptions=True)
    raw: list[Place] = []
    ok_providers: set[str] = set()
    for (provider, query, _), res in zip(jobs, results):
        if isinstance(res, BaseException):
            state = "not_configured" if isinstance(res, ProviderNotConfigured) else "error"
            if not isinstance(res, (ProviderError, ProviderNotConfigured)):
                raise res
            statuses.append(ProviderStatus(provider=provider, state=state, message=str(res)))
            record(tag=tag, provider=provider, query=query, center=[lat, lng], radius_m=radius_m, error=str(res))
            continue
        ok_providers.add(provider)
        raw += res
        record(tag=tag, provider=provider, query=query, center=[lat, lng], radius_m=radius_m, raw_count=len(res))
    for p in ok_providers:
        statuses.append(ProviderStatus(provider=p, state="ok"))

    merged = dedupe(raw)
    kept, dropped = [], []
    for p in merged:
        ok, why = category_ok(p, spec)
        (kept if ok else dropped).append((p, why))
    record(tag=tag, step="filter", spec=spec.key, raw=len(raw), after_dedupe=len(merged), after_category_filter=len(kept),
           dropped_examples=[f"{p.name}: {why}" for p, why in dropped[:8]])
    return [p for p, _ in kept]


def filter_quality(places: list[Place], min_rating: float, min_reviews: int, tag: str = "") -> list[Place]:
    out, dropped = [], []
    for p in places:
        ok, why = quality_ok(p, min_rating, min_reviews)
        (out if ok else dropped).append((p, why))
    record(tag=tag, step="quality", min_rating=min_rating, min_reviews=min_reviews, before=len(places), after=len(out),
           dropped_examples=[f"{p.name}: {why}" for p, why in dropped[:8]])
    return [p for p, _ in out]




def merge_specs(key: str, label: str, specs: list[Spec]) -> Spec:
    """Union of several specs (e.g. all rental sub-filters)."""
    uniq = lambda xs: list(dict.fromkeys(xs))  # noqa: E731
    return Spec(
        key=key, label=label,
        primary_types=uniq([t for s in specs for t in s.primary_types]),
        queries=uniq([q for s in specs for q in s.queries]),
        geoapify=uniq([c for s in specs for c in s.geoapify]),
        overpass=uniq([o for s in specs for o in s.overpass]),
        name_exclude=specs[0].name_exclude,
    )
