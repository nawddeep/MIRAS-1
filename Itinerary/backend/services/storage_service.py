"""Converts an itinerary to and from its stored form (Google places → IDs only)."""

import asyncio

import db
from destinations import get_destination
from integrations import registry
from integrations.base import ProviderError, ProviderNotConfigured
from models.common import ProviderStatus
from models.itinerary import Day, Itinerary, RentalSection, TripRequest
from models.place import Place
from services import itinerary_service


def _ref(p: Place) -> dict:
    return {"$ref": True, "id": p.id, "provider": p.provider, "google_place_id": p.google_place_id, "category": p.category}


def to_stored(it: Itinerary) -> dict:
    """Plan JSON with every Google place replaced by a reference. Transport and weather are
    not stored: fares go stale and weather is re-fetched when the trip is opened."""
    days = []
    for d in it.days:
        blocks = []
        for b in d.blocks:
            bd = b.model_dump(mode="json", exclude={"leg_from_previous"})
            if b.place and b.place.provider == "google":
                bd["place"] = _ref(b.place)
                bd["title"] = None if b.kind == "visit" else ({"lunch": "Lunch", "dinner": "Dinner"}.get(b.meal or "", None))
            blocks.append(bd)
        days.append({"index": d.index, "date": d.date.isoformat(), "area": d.area.model_dump() if d.area else None, "blocks": blocks})
    keep = lambda ps: [_ref(p) if p.provider == "google" else p.model_dump(mode="json") for p in ps]  # noqa: E731
    return {"days": days, "stays": keep(it.stays), "rentals": it.rentals.model_dump(mode="json") if it.rentals else None}


async def from_stored(preferences: dict, plan: dict, share_token: str) -> Itinerary:
    req = load_request(preferences)
    dest = get_destination(req.destination_id)
    statuses: list[ProviderStatus] = []
    g = registry.google_places()
    sem = asyncio.Semaphore(5)
    cache: dict[str, Place | None] = {}

    async def hydrate(ref: dict) -> Place | None:
        if not ref.get("$ref"):
            return Place.model_validate(ref)
        pid = ref["google_place_id"]
        if pid in cache:
            return cache[pid]
        async with sem:
            try:
                cache[pid] = await g.details(pid, ref.get("category"))
            except (ProviderError, ProviderNotConfigured) as exc:
                statuses.append(ProviderStatus(provider=g.label, state="error" if g.configured() else "not_configured", message=str(exc)))
                cache[pid] = None
        return cache[pid]

    async def hydrate_block(bd: dict) -> dict:
        if bd.get("place"):
            place = await hydrate(bd["place"])
            if place is None:
                bd["place"] = None
                bd["title"] = bd.get("title") or "Saved place (details unavailable right now)"
                bd["reason"] = "Google place details could not be loaded."
            else:
                bd["place"] = place.model_dump(mode="json")
                if not bd.get("title"):
                    meal = {"lunch": "Lunch at ", "dinner": "Dinner at "}.get(bd.get("meal") or "", "")
                    bd["title"] = meal + place.name
        return bd

    days: list[Day] = []
    weather = await itinerary_service.fetch_weather(req, dest, statuses)
    for dd in plan.get("days", []):
        blocks = await asyncio.gather(*(hydrate_block(dict(b)) for b in dd["blocks"]))
        day = Day.model_validate({"index": dd["index"], "date": dd["date"], "area": dd.get("area"), "blocks": list(blocks)})
        day.weather = weather.get(day.date)
        day.weather_note = itinerary_service.weather_note(day.weather)
        days.append(await itinerary_service.relayout_day(req, day))
    stays = [p for p in await asyncio.gather(*(hydrate(s) for s in plan.get("stays", []))) if p]
    essentials = await itinerary_service.collect_essentials(dest, statuses)
    return Itinerary(
        share_token=share_token, request=req, destination_name=dest.name, days=days, stays=stays,
        transport=None, budget=itinerary_service.budget_summary(req, days, None), essentials=essentials,
        rentals=RentalSection.model_validate(plan["rentals"]) if plan.get("rentals") else None,
        providers=itinerary_service.merge_status(statuses),
    )


def load_request(preferences: dict) -> TripRequest:
    """Saved trips may now have past dates, so validate with today's date, then restore the original."""
    from datetime import date
    data = dict(preferences)
    original = data.get("start_date")
    data["start_date"] = date.today().isoformat()
    req = TripRequest.model_validate(data)
    return req.model_copy(update={"start_date": date.fromisoformat(original) if isinstance(original, str) else original})


async def save(it: Itinerary) -> tuple[str, str, str]:
    return await asyncio.to_thread(db.create, it.request.destination_id, it.request.model_dump(mode="json"), to_stored(it))


async def update(share_token: str, edit_token: str, it: Itinerary) -> bool:
    return await asyncio.to_thread(db.update, share_token, edit_token, it.request.model_dump(mode="json"), to_stored(it))


async def load(share_token: str) -> Itinerary | None:
    row = await asyncio.to_thread(db.get_by_share, share_token)
    if not row:
        return None
    return await from_stored(row.preferences, row.plan, row.share_token)
