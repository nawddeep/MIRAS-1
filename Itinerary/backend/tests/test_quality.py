"""Suggestion quality, variety, rentals and travel modes, with a mock Google that returns
different places for every query and search centre (so variety comes from our logic)."""

import asyncio
import hashlib
import json
from datetime import date, timedelta

import httpx

from tests.conftest import configure


def _pid(*parts) -> str:
    return hashlib.sha1("|".join(map(str, parts)).encode()).hexdigest()[:10]


CAFE_Q = {"specialty coffee", "rooftop cafe", "lake view cafe"}


def fake_google(request: httpx.Request):
    body = json.loads(request.content or b"{}")
    if request.url.path.endswith(":searchText"):
        q = body["textQuery"]
        primary = "cafe" if q in CAFE_Q else ("restaurant" if any(w in q for w in ("thali", "restaurant", "dal")) else "tourist_attraction")
        if q == "specialty coffee":  # a diner and a fast-food place sneak into cafe results
            extra = [("Highway Diner", "diner"), ("Burger Express", "fast_food_restaurant"), ("Sharma Bhojnalay", "cafe")]
        else:
            extra = []
    else:
        q = ",".join(body.get("includedPrimaryTypes") or body.get("includedTypes") or [])
        primary = (body.get("includedPrimaryTypes") or body.get("includedTypes") or ["point_of_interest"])[0]
        extra = []
    c = (body.get("locationBias") or body.get("locationRestriction"))["circle"]["center"]
    lat, lng = c["latitude"], c["longitude"]
    if body.get("pageToken"):
        return {"places": []}
    places = []
    h = int(_pid(q), 16) % 1000 / 1000  # each query's places sit in their own spot around the centre
    for k in range(6):
        places.append({
            "id": _pid(q, round(lat, 4), round(lng, 4), k),
            "displayName": {"text": f"{q.title()} {'ABCDEF'[k]} near {lat:.3f}"},
            "location": {"latitude": lat + 0.002 * k + 0.004 * h, "longitude": lng + 0.0015 * k - 0.004 * h},
            "googleMapsUri": f"https://maps.google.com/?cid={_pid(q, k)}",
            "rating": 4.2 + 0.1 * (k % 5), "userRatingCount": 60 + 150 * k,
            "primaryType": primary, "types": [primary], "businessStatus": "OPERATIONAL",
        })
    for i, (name, ptype) in enumerate(extra):
        places.append({"id": _pid(name), "displayName": {"text": name}, "location": {"latitude": lat + 0.001 * i, "longitude": lng},
                       "googleMapsUri": "https://maps.google.com/?cid=x", "rating": 4.6, "userRatingCount": 500,
                       "primaryType": ptype, "types": [ptype], "businessStatus": "OPERATIONAL"})
    places.append({"id": _pid(q, "closed", lat), "displayName": {"text": f"Closed {q}"}, "location": {"latitude": lat, "longitude": lng},
                   "googleMapsUri": "https://maps.google.com/?cid=c", "rating": 4.9, "userRatingCount": 900,
                   "primaryType": primary, "types": [primary], "businessStatus": "CLOSED_PERMANENTLY"})
    return {"places": places}


def osrm(request: httpx.Request):
    pts = [[float(x) for x in c.split(",")] for c in request.url.path.rsplit("/", 1)[-1].split(";")]
    n = len(pts) - 1
    speed = {"routed-foot": 1.3, "routed-bike": 4.0, "routed-car": 8.0}[request.url.path.split("/")[1]]
    return {"code": "Ok", "routes": [{"distance": 1000.0 * n, "duration": 1000.0 * n / speed,
                                      "legs": [{"distance": 1000.0, "duration": 1000.0 / speed}] * n,
                                      "geometry": {"coordinates": pts}}]}


def wire(mock_http):
    mock_http.add("places.googleapis.com/v1/places:search", fake_google)
    mock_http.add("api.open-meteo.com/v1/forecast", {"daily": {"time": [], "weather_code": []}})
    mock_http.add("api.open-meteo.com/v1/elevation", lambda r: {"elevation": [500.0] * len(r.url.params["latitude"].split(","))})
    mock_http.add("routes.googleapis.com", httpx.Response(403, json={"error": "not enabled"}))
    mock_http.add("routing.openstreetmap.de", osrm)
    mock_http.add("api.geoapify.com/v2/places", {"features": []})
    mock_http.add("overpass-api.de", {"elements": [
        {"type": "node", "id": 1, "lat": 24.5770, "lon": 73.6850, "tags": {"name": "Lake City Scooty Rent", "amenity": "motorcycle_rental", "phone": "+91 99999 00000", "rental": "scooter;motorcycle"}},
        {"type": "node", "id": 2, "lat": 24.5790, "lon": 73.6870, "tags": {"name": "Mewar Self Drive Cars", "amenity": "car_rental"}},
        {"type": "way", "id": 3, "center": {"lat": 24.58, "lon": 73.68}, "tags": {"name": "Rental Flat Available", "shop": "rental"}},
    ]})


def trip(interests, days=3, **kw):
    from models.itinerary import TripRequest
    return TripRequest(start_date=date.today() + timedelta(days=2), days=days, interests=interests, pace="balanced", **kw)


def visit_names(it):
    return [b.place.name for d in it.days for b in d.blocks if b.kind == "visit"]


# ---------- Category accuracy ----------

def test_cafe_filter_drops_diners_and_fast_food():
    from catalog import INTERESTS
    from models.common import Provenance
    from models.place import Place
    from services.search_service import category_ok

    def gp(name, primary, provider="google", types=None):
        return Place(id=f"{provider}:{name}", provider=provider, provider_place_id=name, name=name, primary_type=primary,
                     types=types or [primary], lat=0, lng=0, maps_url="x", maps_url_is_listing=False,
                     provenance=Provenance(source="t", data_type="Live"))

    cafes = INTERESTS["cafes"]
    assert category_ok(gp("Brew Lab", "coffee_shop"), cafes)[0]
    assert category_ok(gp("Lakeside Cafe", "cafe"), cafes)[0]
    for bad in (gp("Highway Diner", "diner"), gp("Burger Express", "fast_food_restaurant"), gp("Spice Garden", "restaurant"),
                gp("Quick Bites", "meal_takeaway")):
        assert not category_ok(bad, cafes)[0], bad.name
    # OSM mis-tags: a diner tagged as a cafe is caught by name.
    assert not category_ok(gp("Ganesha Bhojnalay", "catering.cafe", "geoapify", ["catering.cafe"]), cafes)[0]
    assert not category_ok(gp("Some Restaurant", "catering.restaurant", "geoapify", ["catering.restaurant"]), cafes)[0]


def test_cafes_interest_returns_only_cafes(mock_http):
    from services import itinerary_service

    wire(mock_http)
    it = asyncio.run(itinerary_service.generate(trip(["cafes"], days=1)))
    visits = [b.place for d in it.days for b in d.blocks if b.kind == "visit"]
    assert visits
    assert all(p.primary_type in {"cafe", "coffee_shop", "bakery", "tea_house"} for p in visits)
    names = " ".join(p.name for p in visits)
    assert "Diner" not in names and "Burger" not in names and "Bhojnalay" not in names


def test_closed_and_low_review_places_are_filtered(mock_http):
    from services import itinerary_service

    wire(mock_http)
    it = asyncio.run(itinerary_service.generate(trip(["heritage"], days=1)))
    for d in it.days:
        for b in d.blocks:
            if b.place:
                assert not b.place.name.startswith("Closed")
                assert (b.place.rating_count or 0) >= 20 and (b.place.rating or 0) >= 4.0


# ---------- Variety ----------

def test_three_days_no_repeats_and_different_areas(mock_http):
    from services import itinerary_service

    wire(mock_http)
    it = asyncio.run(itinerary_service.generate(trip(["cafes", "heritage"])))
    ids = [b.place.id for d in it.days for b in d.blocks if b.place]
    assert len(ids) == len(set(ids))
    areas = [d.area.id for d in it.days]
    assert len(set(areas)) == 3
    assert all(d.mode_totals and {m.mode for m in d.mode_totals} == {"walk", "cycle", "scooter", "car"} for d in it.days)


def test_different_interests_give_different_trips(mock_http):
    from services import itinerary_service

    wire(mock_http)
    a = asyncio.run(itinerary_service.generate(trip(["cafes", "heritage"], days=2)))
    b = asyncio.run(itinerary_service.generate(trip(["adventure", "shopping"], days=2)))
    assert set(visit_names(a)).isdisjoint(visit_names(b))
    assert [d.area.id for d in a.days] != [d.area.id for d in b.days]


def test_show_me_different_suggestions_day_and_slot(mock_http):
    from services import itinerary_service

    wire(mock_http)
    req = trip(["cafes", "heritage"], days=2)
    it = asyncio.run(itinerary_service.generate(req))
    day0 = it.days[0]
    shown = {b.place.id for b in day0.blocks if b.place}
    others = {b.place.id for b in it.days[1].blocks if b.place}
    new_day, _ = asyncio.run(itinerary_service.regenerate_day(req, 0, others, shown, day0.area.id))
    new_ids = {b.place.id for b in new_day.blocks if b.kind == "visit"}
    assert new_ids and new_ids.isdisjoint(shown) and new_ids.isdisjoint(others)

    visit = next(b for b in day0.blocks if b.kind == "visit")
    exclude = shown | others
    swapped, _ = asyncio.run(itinerary_service.alternative_for_block(req, day0, visit.id, exclude))
    replaced = next(b for b in swapped.blocks if b.id == visit.id)
    assert replaced.place.id not in exclude and replaced.place.id != visit.place.id


def test_every_place_carries_score_and_reasons(mock_http):
    from services import itinerary_service

    wire(mock_http)
    it = asyncio.run(itinerary_service.generate(trip(["cafes"], days=1)))
    v = next(b for b in it.days[0].blocks if b.kind == "visit")
    assert v.place.score is not None
    assert any("Google reviews" in r for r in v.place.score_reasons)
    assert any("km from" in r for r in v.place.score_reasons)


# ---------- Rentals ----------

def test_overpass_rental_normaliser_states_only_tagged_vehicles():
    from integrations.osm.overpass import normalise_element

    p = normalise_element({"type": "node", "id": 1, "lat": 24.57, "lon": 73.68,
                           "tags": {"name": "Scooty Point", "amenity": "motorcycle_rental", "rental": "scooter"}}, "rental_scooter", (24.57, 73.68))
    assert "Motorcycles / scooters (OpenStreetMap tag)" in p.vehicle_types and "Scooters (OpenStreetMap tag)" in p.vehicle_types
    q = normalise_element({"type": "node", "id": 2, "lat": 24.57, "lon": 73.68, "tags": {"name": "Ravi Travels", "office": "travel_agent"}}, None, (24.57, 73.68))
    assert q.vehicle_types == []  # nothing stated by the provider -> "vehicle types not listed"


def test_explore_rentals_merge_sources_and_drop_flat_rentals(mock_http):
    from services import discovery_service

    configure({"GOOGLE_MAPS_SERVER_KEY": ""})
    wire(mock_http)
    page, statuses = asyncio.run(discovery_service.nearby(24.5764, 73.6835, 5000, "rentals", None))
    names = [p.name for p in page.places]
    assert "Lake City Scooty Rent" in names and "Mewar Self Drive Cars" in names
    assert "Rental Flat Available" not in names
    assert all(p.price_range is None for p in page.places)
    assert page.places == sorted(page.places, key=lambda p: discovery_service.sort_key(p, True))


def test_planner_rental_choice_adds_rental_section_and_vehicle_legs(mock_http):
    from services import itinerary_service

    wire(mock_http)
    it = asyncio.run(itinerary_service.generate(trip(["heritage"], days=1, rental="two_wheeler", transport="train")))
    assert it.rentals and it.rentals.arrival_label.startswith("Udaipur City railway station")
    assert it.rentals.advice and it.rentals.group == "two_wheeler"
    assert abs(it.rentals.arrival.lat - 24.56749) < 1e-4
    long_legs = [b.leg_from_previous for b in it.days[0].blocks if b.leg_from_previous and b.leg_from_previous.mode != "walk"]
    assert all(leg.mode == "scooter" for leg in long_legs)


# ---------- Travel modes ----------

def test_two_wheeler_is_derived_and_labelled_without_google_routes(mock_http):
    from services import routing_service

    wire(mock_http)
    pts = [(24.5761, 73.6836), (24.6022, 73.6756), (24.6131, 73.6634)]
    legs, totals = asyncio.run(routing_service.mode_legs(pts))
    tw = next(t for t in totals if t.mode == "scooter")
    car = next(t for t in totals if t.mode == "car")
    assert tw.data_type == "Estimated" and "× 0.85" in tw.source
    assert abs(tw.duration_s - car.duration_s * 0.85) <= 2
    assert car.data_type == "Live" and car.source.startswith("OSRM") and "Not traffic-aware" in car.note
    assert all(len(leg.modes) == 4 for leg in legs)


def test_two_wheeler_from_google_routes_is_live(mock_http):
    from services import routing_service

    wire(mock_http)
    mock_http.routes = [r for r in mock_http.routes if not r[0].startswith("routes.googleapis.com")]
    mock_http.add("routes.googleapis.com", {"routes": [{"distanceMeters": 2000, "duration": "300s", "polyline": {"encodedPolyline": "_p~iF~ps|U_ulLnnqC"},
                                                        "legs": [{"distanceMeters": 1000, "duration": "150s"}] * 2}]})
    _, totals = asyncio.run(routing_service.mode_legs([(24.57, 73.68), (24.58, 73.69), (24.59, 73.70)]))
    tw = next(t for t in totals if t.mode == "scooter")
    assert tw.data_type == "Live" and tw.source == "Google Routes"


def test_car_flagged_in_old_city_lanes(mock_http):
    from destinations import get_destination
    from services import routing_service

    wire(mock_http)
    zones = get_destination("udaipur").narrow_lane_zones
    legs, _ = asyncio.run(routing_service.mode_legs([(24.5797, 73.6838), (24.5806, 73.6820)], "none", zones))
    car = next(m for m in legs[0].modes if m.mode == "car")
    assert not car.suitable and "Narrow old-city lanes" in car.note


# ---------- Debug endpoint ----------

def test_debug_endpoint_disabled_by_default_and_explains_when_enabled(mock_http):
    from fastapi.testclient import TestClient

    wire(mock_http)
    import main
    body = {"start_date": (date.today() + timedelta(days=2)).isoformat(), "days": 1, "interests": ["cafes"]}
    with TestClient(main.app) as client:
        assert client.post("/api/debug/explain", json=body).status_code == 404
    configure({"DEBUG_ENDPOINTS": "true"})
    from integrations import base
    base.set_client(httpx.AsyncClient(transport=httpx.MockTransport(mock_http.handler)))  # the app closed the previous one
    with TestClient(main.app) as client:
        r = client.post("/api/debug/explain", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["picks"] and all(p["reasons"] for p in data["picks"])
    steps = {e.get("step") for e in data["trace"]}
    assert {"filter", "quality", "ranked"} <= steps
    assert any(e.get("query", "").startswith('text "specialty coffee"') for e in data["trace"])
