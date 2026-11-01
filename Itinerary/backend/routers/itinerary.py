from typing import Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from catalog import BEFORE_YOU_RENT, INTERESTS
from config import get_settings
from db import DatabaseUnavailable
from destinations import DESTINATIONS, get_destination
from models.common import Envelope
from models.itinerary import Day, Itinerary, ModeEstimate, TrailRoute, TrailWaypoint, TripRequest
from presets import PRESETS
from services import itinerary_service, routing_service, search_service, storage_service
from services.discovery_dedupe import dedupe

router = APIRouter(prefix="/api", tags=["itinerary"])


@router.get("/meta")
async def meta():
    return {
        "destinations": [{"id": d.id, "name": d.name, "region": d.region, "lat": d.lat, "lng": d.lng} for d in DESTINATIONS.values()],
        "interests": [{"key": i.key, "label": i.label} for i in INTERESTS.values()],
        "presets": PRESETS,
        "before_you_rent": BEFORE_YOU_RENT,
    }


@router.post("/itinerary/generate", response_model=Itinerary)
async def generate(req: TripRequest):
    return await itinerary_service.generate(req)


class RegenerateDay(BaseModel):
    request: TripRequest
    day_index: int
    other_day_place_ids: list[str] = []
    seen_place_ids: list[str] = []  # everything already shown for this day, so the new version differs
    area_id: str | None = None


@router.post("/itinerary/regenerate-day", response_model=Envelope[Day])
async def regenerate_day(body: RegenerateDay):
    """ "Show me different suggestions" for a whole day."""
    try:
        day, st = await itinerary_service.regenerate_day(
            body.request, body.day_index, set(body.other_day_place_ids), set(body.seen_place_ids), body.area_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return Envelope(data=day, providers=st)


class Alternative(BaseModel):
    request: TripRequest
    day: Day
    block_id: str
    exclude_place_ids: list[str] = []  # every place in the trip plus every place already shown for this slot


@router.post("/itinerary/alternative", response_model=Envelope[Day])
async def alternative(body: Alternative):
    """ "Show me a different place" for one stop."""
    try:
        day, st = await itinerary_service.alternative_for_block(body.request, body.day, body.block_id, set(body.exclude_place_ids))
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except LookupError as exc:
        raise HTTPException(404, str(exc))
    return Envelope(data=day, providers=st)


class RelayoutDay(BaseModel):
    request: TripRequest
    day: Day


@router.post("/itinerary/relayout-day", response_model=Day)
async def relayout_day(body: RelayoutDay):
    return await itinerary_service.relayout_day(body.request, body.day)


class Saved(BaseModel):
    share_token: str
    edit_token: str


@router.post("/itinerary", response_model=Saved, status_code=201)
async def save(it: Itinerary):
    try:
        _, share, edit = await storage_service.save(it)
    except DatabaseUnavailable:
        raise HTTPException(503, "Saving is unavailable: the database is not reachable")
    return Saved(share_token=share, edit_token=edit)


@router.put("/itinerary/{share_token}", status_code=204)
async def update(share_token: str, it: Itinerary, x_edit_token: str = Header()):
    try:
        ok = await storage_service.update(share_token, x_edit_token, it)
    except DatabaseUnavailable:
        raise HTTPException(503, "Saving is unavailable: the database is not reachable")
    if not ok:
        raise HTTPException(403, "Wrong edit token or unknown itinerary")


@router.get("/itinerary/shared/{share_token}", response_model=Itinerary)
async def shared(share_token: str):
    try:
        it = await storage_service.load(share_token)
    except DatabaseUnavailable:
        raise HTTPException(503, "The database is not reachable")
    if not it:
        raise HTTPException(404, "Itinerary not found")
    return it


# ---------- Trails and travel modes ----------

class RouteBody(BaseModel):
    title: str = Field(default="Suggested route", max_length=120)
    mode: Literal["walk", "cycle", "scooter", "car"] = "walk"
    waypoints: list[TrailWaypoint] = Field(min_length=2, max_length=11)


@router.post("/trails/route", response_model=Envelope[TrailRoute | None])
async def trail_route(body: RouteBody):
    trail, st = await routing_service.build_trail(body.title, body.waypoints, body.mode)
    return Envelope(data=trail, providers=st)


class ModesBody(BaseModel):
    waypoints: list[TrailWaypoint] = Field(min_length=2, max_length=11)
    destination: str = "udaipur"


@router.post("/routes/modes", response_model=list[ModeEstimate])
async def route_modes(body: ModesBody):
    """Distance and time for walk, cycle, two-wheeler and four-wheeler along the given points."""
    dest = get_destination(body.destination)
    _, totals = await routing_service.mode_legs([(w.lat, w.lng) for w in body.waypoints], "none", dest.narrow_lane_zones)
    return totals


@router.get("/trails/ride-from", response_model=Envelope[list[TrailRoute]])
async def ride_from(lat: float, lng: float, name: str = "Rental shop", mode: Literal["cycle", "scooter", "walk"] = "cycle", destination: str = "udaipur"):
    """Two or three Suggested routes from a rental shop through real nearby attractions."""
    get_destination(destination)
    radius = {"walk": 3000, "cycle": 6000, "scooter": 15000}[mode]
    statuses: list = []
    s = get_settings()
    places = []
    for key in ("nature", "heritage", "photography"):
        found = await search_service.fetch(INTERESTS[key], lat, lng, radius, statuses, pages=1, tag=f"ride {key}")
        places += search_service.filter_quality(found, s.min_rating, s.min_reviews)
    trails, st = await routing_service.ride_from(name, lat, lng, mode, dedupe(places))
    return Envelope(data=trails, providers=itinerary_service.merge_status(statuses + st))


# ---------- Developer-only ----------

@router.post("/debug/explain", include_in_schema=False)
async def debug_explain(req: TripRequest):
    """Why each place was picked: queries sent, counts after each filter, and final scores.
    Enabled only with DEBUG_ENDPOINTS=true. Never enable in production."""
    if not get_settings().debug_endpoints:
        raise HTTPException(404, "Not found")
    trace = search_service.start_trace()
    it = await itinerary_service.generate(req)
    return {
        "areas": [{"day": d.index + 1, "area": d.area.name if d.area else None, "search_notes": d.search_notes} for d in it.days],
        "picks": [
            {"day": d.index + 1, "slot": f"{b.start} {b.kind}", "name": b.place.name, "provider": b.place.provider,
             "score": b.place.score, "hidden_gem": b.place.hidden_gem, "reasons": b.place.score_reasons}
            for d in it.days for b in d.blocks if b.place
        ],
        "trace": trace,
        "providers": [p.model_dump() for p in it.providers],
    }
