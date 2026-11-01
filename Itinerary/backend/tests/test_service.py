"""End-to-end service tests with every provider mocked at the HTTP layer."""

import asyncio
import json
from datetime import date, timedelta

import httpx

from tests.conftest import configure, fixture


def google_router(request: httpx.Request):
    body = json.loads(request.content or b"{}")
    q = body.get("textQuery", "")
    if any(w in q for w in ("restaurant", "cafe", "food")):
        return fixture("google_restaurants.json")
    if body.get("pageToken") == "PAGE2":
        return {"places": []}
    return fixture("google_text_search.json")


def osrm_route(request: httpx.Request):
    coords = request.url.path.rsplit("/", 1)[-1].split(";")
    pts = [[float(x) for x in c.split(",")] for c in coords]
    return {"code": "Ok", "routes": [{"distance": 900.0 * (len(pts) - 1), "duration": 660.0 * (len(pts) - 1), "legs": [{"distance": 900.0, "duration": 660.0}] * (len(pts) - 1), "geometry": {"coordinates": pts}}]}


def wire(mock_http):
    mock_http.add("places.googleapis.com/v1/places:searchText", google_router)
    mock_http.add("places.googleapis.com/v1/places:searchNearby", {"places": fixture("google_text_search.json")["places"][:2]})
    mock_http.add("places.googleapis.com/v1/places/", lambda r: fixture("google_text_search.json")["places"][0])
    mock_http.add("api.open-meteo.com/v1/forecast", fixture("open_meteo_forecast.json"))
    mock_http.add("api.open-meteo.com/v1/elevation", lambda r: {"elevation": [580.0 + i for i in range(len(r.url.params["latitude"].split(",")))]})
    mock_http.add("routes.googleapis.com", httpx.Response(403, json={"error": "API not enabled"}))
    mock_http.add("routing.openstreetmap.de", osrm_route)
    mock_http.add("api.geoapify.com/v2/places", fixture("geoapify_places.json"))
    mock_http.add("serpapi.com", fixture("serpapi_flights.json"))


def trip(**kw):
    from models.itinerary import TripRequest
    base = dict(start_date=date.today() + timedelta(days=1), days=2, interests=["heritage", "museums"], pace="balanced", stay_type="heritage",
                origin={"label": "New Delhi", "lat": 28.61, "lng": 77.21, "airport_code": "DEL"})
    return TripRequest(**{**base, **kw})


def test_generate_full_itinerary(mock_http):
    from services import itinerary_service

    wire(mock_http)
    it = asyncio.run(itinerary_service.generate(trip()))
    assert len(it.days) == 2
    day1 = it.days[0]
    visits = [b for b in day1.blocks if b.kind == "visit"]
    meals = [b for b in day1.blocks if b.kind == "meal"]
    assert visits and len(meals) == 2
    assert any(b.kind == "buffer" for b in day1.blocks)
    # Places far outside the destination radius never appear.
    all_ids = {b.place.id for d in it.days for b in d.blocks if b.place}
    assert "google:ChIJ_far_away" not in all_ids
    # A place is used at most once across the whole trip.
    place_ids = [b.place.id for d in it.days for b in d.blocks if b.place]
    assert len(place_ids) == len(set(place_ids))  # no place is both a visit and a meal, or used twice
    # Google Routes failed (403), so legs fell back to OSRM and are labelled with that source.
    legs = [b.leg_from_previous for b in day1.blocks if b.leg_from_previous]
    assert legs and all(lg.provenance.source.startswith("OSRM") for lg in legs)
    # Times are increasing.
    starts = [b.start for b in day1.blocks]
    assert starts == sorted(starts)
    # Weather, transport, budget and essentials are present and sourced.
    assert day1.weather and day1.weather.provenance.source.startswith("Open-Meteo")
    assert it.transport.flights[0].flight_number == "TA 101"
    assert it.transport.flights[0].provenance.data_type == "Live"
    assert any(line.label.startswith("Flights") for line in it.budget.lines)
    assert it.essentials.emergency[0].number == "112"
    assert it.stays
    states = {s.provider: s.state for s in it.providers}
    assert states["Google Places"] == "ok" and states["Open-Meteo"] == "ok"


def test_rainy_day_note(mock_http):
    from services import itinerary_service

    wire(mock_http)
    it = asyncio.run(itinerary_service.generate(trip(start_date=date.today() + timedelta(days=1))))
    rain = [d for d in it.days if d.weather and d.weather.suggestion == "indoor"]
    for d in rain:
        assert "indoor" in d.weather_note


def test_no_keys_gives_honest_empty_states(mock_http):
    from services import itinerary_service

    configure({"GOOGLE_MAPS_SERVER_KEY": "", "GEOAPIFY_API_KEY": "", "SERPAPI_API_KEY": ""})
    mock_http.add("api.open-meteo.com", fixture("open_meteo_forecast.json"))
    it = asyncio.run(itinerary_service.generate(trip(origin=None)))
    assert all(b.place is None for d in it.days for b in d.blocks)
    assert all(b.kind != "visit" for d in it.days for b in d.blocks)
    states = {s.provider: s.state for s in it.providers}
    assert states["Google Places"] == "not_configured" and states["Geoapify"] == "not_configured"
    meal = next(b for b in it.days[0].blocks if b.kind == "meal")
    assert "choose a place" in meal.title


def test_discovery_merges_dedupes_and_paginates(mock_http):
    from services import discovery_service

    wire(mock_http)
    page, statuses = asyncio.run(discovery_service.nearby(24.58, 73.684, 3000, "artisans", None))
    names = [p.name for p in page.places]
    assert names.count("Test Palace Museum") == 1  # Google + OSM copy merged
    assert "Test Miniature Studio" in names  # OSM-only place kept
    assert page.next_cursor
    assert {s.provider for s in statuses if s.state == "ok"} == {"Google Places", "Geoapify"}
    page2, _ = asyncio.run(discovery_service.nearby(24.58, 73.684, 3000, "artisans", page.next_cursor))
    assert isinstance(page2.places, list)


def test_hidden_gems_filter_drops_heavily_reviewed_places(mock_http):
    from services import discovery_service

    wire(mock_http)
    google, cursor = [], None
    for _ in range(8):  # page through the query variants
        page, _ = asyncio.run(discovery_service.nearby(24.58, 73.684, 3000, "hidden_gems", cursor))
        google += [p for p in page.places if p.provider == "google"]
        cursor = page.next_cursor
        if not cursor:
            break
    assert google, "expected at least one Google hidden gem"
    assert all(discovery_service.is_hidden_gem(p) for p in google)
    assert all(20 <= (p.rating_count or 0) <= 600 and (p.rating or 0) >= 4.3 for p in google)


def test_ride_from_builds_suggested_loops(mock_http):
    from models.place import Place
    from services import routing_service
    from integrations.google_places.provider import normalise_place

    wire(mock_http)
    places = [p for raw in fixture("google_text_search.json")["places"] if (p := normalise_place(raw))]
    trails, _ = asyncio.run(routing_service.ride_from("Test Rentals", 24.5790, 73.6850, "cycle", places))
    assert trails
    t = trails[0]
    assert t.label == "Suggested route" and "not an official trail" in t.provenance.note
    assert t.waypoints[0].name == t.waypoints[-1].name == "Test Rentals"
    assert t.navigation_url.startswith("https://www.google.com/maps/dir/?api=1") and "travelmode=bicycling" in t.navigation_url
    assert t.elevation_profile and t.elevation_gain_m is not None
    assert isinstance(places[0], Place)


def test_saved_itinerary_keeps_only_google_place_ids(mock_http):
    from services import itinerary_service, storage_service

    wire(mock_http)
    it = asyncio.run(itinerary_service.generate(trip(origin=None)))
    stored = storage_service.to_stored(it)
    text = json.dumps(stored)
    assert "Test Palace Museum" not in text and "maps.google.com" not in text and "Old City" not in text
    refs = [b["place"] for d in stored["days"] for b in d["blocks"] if b.get("place")]
    assert refs and all(r.get("$ref") and r["google_place_id"] for r in refs if r["provider"] == "google")


def test_save_and_load_roundtrip(mock_http):
    import db
    from sqlalchemy import create_engine
    from sqlalchemy.pool import StaticPool
    from services import itinerary_service, storage_service

    db.set_engine(create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool))
    assert db.init_db()
    wire(mock_http)
    it = asyncio.run(itinerary_service.generate(trip(origin=None, days=1)))
    share, edit = asyncio.run(storage_service.save(it))[1:]
    loaded = asyncio.run(storage_service.load(share))
    assert loaded.share_token == share and len(loaded.days) == 1
    assert any(b.place and b.place.name for b in loaded.days[0].blocks)
    assert asyncio.run(storage_service.update(share, "wrong", it)) is False
    assert asyncio.run(storage_service.update(share, edit, it)) is True
    db.set_engine(None)
