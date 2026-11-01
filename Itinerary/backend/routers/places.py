from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse

from destinations import DESTINATIONS
from integrations import registry
from integrations.base import ProviderError, ProviderNotConfigured
from models.common import Envelope, ProviderStatus
from models.place import Place, PlacesPage, Suggestion
from services import discovery_service, location_service
from catalog import CATEGORIES, RENTAL_GROUPS

router = APIRouter(prefix="/api/places", tags=["places"])


@router.get("/autocomplete", response_model=Envelope[list[Suggestion]])
async def autocomplete(q: str = Query(min_length=2, max_length=100), lat: float | None = None, lng: float | None = None, session: str | None = None):
    near = (lat, lng) if lat is not None and lng is not None else None
    data, st = await location_service.autocomplete(q, near, session)
    return Envelope(data=data, providers=st)


@router.get("/geocode", response_model=Envelope[list[Suggestion]])
async def geocode(q: str = Query(min_length=2, max_length=200)):
    data, st = await location_service.geocode(q)
    return Envelope(data=data, providers=st)


@router.get("/resolve/{google_place_id}", response_model=Envelope[Suggestion])
async def resolve(google_place_id: str, session: str | None = None):
    try:
        s = await location_service.resolve_google(google_place_id, session)
    except ProviderNotConfigured as exc:
        raise HTTPException(503, str(exc))
    except ProviderError as exc:
        raise HTTPException(502, str(exc))
    if not s:
        raise HTTPException(404, "Place not found")
    return Envelope(data=s, providers=[ProviderStatus(provider="Google Places", state="ok")])


@router.get("/airports")
async def airports(lat: float, lng: float):
    data, st = await location_service.nearest_airports(lat, lng)
    return {"data": data, "providers": [s.model_dump() for s in st]}


@router.get("/categories")
async def categories():
    return {"categories": [{"key": c.key, "label": c.label} for c in CATEGORIES.values()], "groups": RENTAL_GROUPS}


@router.get("/nearby", response_model=Envelope[PlacesPage])
async def nearby(
    lat: float = Query(ge=-90, le=90), lng: float = Query(ge=-180, le=180),
    category: str = "food", radius: int = Query(default=2000, ge=200, le=20000), cursor: str | None = None,
):
    if not discovery_service.known_category(category):
        raise HTTPException(400, f"Unknown category. Use one of: {', '.join([*CATEGORIES, *RENTAL_GROUPS])}")
    try:
        page, st = await discovery_service.nearby(lat, lng, radius, category, cursor)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    return Envelope(data=page, providers=st)


@router.get("/search", response_model=Envelope[list[Place]])
async def search(q: str = Query(min_length=2, max_length=100), lat: float | None = None, lng: float | None = None, radius: int = 12000, destination: str = "udaipur"):
    if lat is None or lng is None:
        d = DESTINATIONS.get(destination)
        if not d:
            raise HTTPException(400, "Unknown destination")
        lat, lng = d.lat, d.lng
    data, st = await discovery_service.text_search(q, lat, lng, radius)
    return Envelope(data=data, providers=st)


@router.get("/details/{place_id}", response_model=Envelope[Place])
async def details(place_id: str, category: str | None = None):
    try:
        p = await discovery_service.details(place_id, category)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except ProviderNotConfigured as exc:
        raise HTTPException(503, str(exc))
    except ProviderError as exc:
        raise HTTPException(502, str(exc))
    if not p:
        raise HTTPException(404, "Place not found")
    return Envelope(data=p, providers=[ProviderStatus(provider=p.provenance.source, state="ok")])


@router.get("/photo")
async def photo(ref: str, w: int = Query(default=800, ge=100, le=1600)):
    """Redirects to Google's short-lived photo URL, so the API key never reaches the browser."""
    try:
        uri = await registry.google_places().photo_uri(ref, w)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except ProviderNotConfigured as exc:
        raise HTTPException(503, str(exc))
    except ProviderError as exc:
        raise HTTPException(502, str(exc))
    return RedirectResponse(uri, status_code=302, headers={"Cache-Control": "no-store"})
