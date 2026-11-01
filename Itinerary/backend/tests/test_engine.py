from datetime import date, timedelta

from models.common import Provenance
from models.itinerary import Block, Leg, TripRequest
from models.place import OpeningHours, OpeningPeriod, Place, PriceRange

MONDAY = date(2026, 11, 2)


def place(pid: str, lat: float, lng: float, **kw) -> Place:
    return Place(
        id=f"google:{pid}", provider="google", provider_place_id=pid, google_place_id=pid, name=kw.pop("name", pid),
        lat=lat, lng=lng, maps_url="https://maps.google.com/?cid=1", maps_url_is_listing=True,
        provenance=Provenance(source="Google Places", data_type="Live"), **kw,
    )


def request(**kw) -> TripRequest:
    base = dict(start_date=date.today() + timedelta(days=3), days=2, interests=["heritage", "museums"], pace="balanced")
    return TripRequest(**{**base, **kw})


def daily(open_t="09:30", close_t="17:30", days=range(7)) -> OpeningHours:
    return OpeningHours(periods=[OpeningPeriod(open_day=d, open_time=open_t, close_day=d, close_time=close_t) for d in days])


def test_is_open_uses_google_weekday_and_handles_overnight():
    from services.itinerary_engine import is_open

    p = place("a", 0, 0, opening_hours=daily(days=[1]))  # Monday only
    assert is_open(p, MONDAY, 10 * 60, 11 * 60) is True
    assert is_open(p, MONDAY, 17 * 60, 18 * 60) is False
    assert is_open(p, MONDAY + timedelta(days=1), 10 * 60, 11 * 60) is False
    night = place("b", 0, 0, opening_hours=OpeningHours(periods=[OpeningPeriod(open_day=1, open_time="18:00", close_day=2, close_time="01:00")]))
    assert is_open(night, MONDAY, 22 * 60, 23 * 60 + 30) is True
    assert is_open(place("c", 0, 0), MONDAY, 600, 660) is None  # unknown stays unknown


def test_layout_times_meals_inserts_free_time_and_flags_closed():
    from services.itinerary_engine import layout

    closed_early = place("museum", 24.57, 73.68, opening_hours=daily("09:30", "10:00"))
    walk = Leg(distance_m=800, duration_s=601, mode="walk", provenance=Provenance(source="t", data_type="Live"))
    blocks = [
        Block(id="1", kind="visit", part="morning", duration_min=90, title="Museum", place=closed_early),
        Block(id="2", kind="meal", meal="lunch", part="afternoon", duration_min=60, title="Lunch"),
    ]
    out = layout(blocks, [walk, None], MONDAY, "balanced")
    assert out[0].start == "09:15"  # 09:00 + 11 min walk, rounded up to 5
    assert out[0].hours_note.startswith("May be closed")
    assert out[1].kind == "free" and out[1].auto  # gap until lunch
    assert out[2].start == "12:30" and out[2].part == "afternoon"


def test_pick_day_groups_nearby_places_and_respects_rain():
    from services.itinerary_engine import Candidate, pick_day

    req = request()
    a = Candidate(place("a", 24.5800, 73.6800), {"heritage"}, 3.0)
    b = Candidate(place("b", 24.5805, 73.6805), {"heritage"}, 1.0)
    far = Candidate(place("far", 24.70, 73.80), {"heritage"}, 2.9)
    assert [c.place.id for c in pick_day([a, b, far], 2, None)] == ["google:a", "google:b"]

    museum = Candidate(place("m", 24.70, 73.80), {"museums"}, 2.5)
    outdoor = Candidate(place("o", 24.58, 73.68), {"heritage"}, 3.0)
    assert pick_day([museum, outdoor], 1, "indoor")[0].place.id == "google:m"
    assert req.pace == "balanced"


def test_budget_tier_penalises_expensive_places():
    from services.itinerary_engine import score

    cheap = place("c", 24.58, 73.70, price_level="PRICE_LEVEL_INEXPENSIVE")
    pricey = place("p", 24.58, 73.70, price_level="PRICE_LEVEL_VERY_EXPENSIVE")
    req = request(budget_tier="budget")
    assert score(cheap, {"food"}, req, (24.58, 73.70)) > score(pricey, {"food"}, req, (24.58, 73.70))


def test_trip_request_validation():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        request(start_date=date.today() - timedelta(days=5))
    with pytest.raises(ValidationError):
        request(budget_min_per_day=5000, budget_max_per_day=1000)
    with pytest.raises(ValidationError):
        request(interests=[])


def test_difficulty_and_elevation_gain():
    from services.routing_service import difficulty, elevation_gain

    assert elevation_gain([580, 580.5, 590, 585, 600, 600.4]) == 25
    assert difficulty("walk", 2000, 20).level == "Easy"
    assert difficulty("walk", 6000, 100).level == "Moderate"
    assert difficulty("cycle", 30000, 500).level == "Hard"
    d = difficulty("cycle", 8000, None)
    assert d.is_estimate and "climb unknown" in d.basis


def test_plan_loop_stays_within_budget_and_returns():
    from geo import haversine_m
    from services.routing_service import DETOUR, plan_loop

    start = (24.5854, 73.7125)
    places = [("near", 24.590, 73.712, "1"), ("mid", 24.600, 73.700, "2"), ("far", 24.700, 73.800, "3")]
    stops = plan_loop(start, places, target_km=5)
    total, cur = 0.0, start
    for s in stops:
        total += haversine_m(cur[0], cur[1], s[1], s[2])
        cur = (s[1], s[2])
    total += haversine_m(cur[0], cur[1], *start)
    assert stops and total <= 5000 / DETOUR + 1
    assert "3" not in [s[3] for s in stops]


def test_dedupe_prefers_google_over_osm():
    from services.discovery_service import dedupe

    g = place("palace", 24.5764, 73.6835, name="Test Palace Museum")
    osm = Place(id="geoapify:x", provider="geoapify", provider_place_id="x", name="Test Palace Museum", lat=24.57645, lng=73.68352,
                maps_url="https://www.google.com/maps/search/?api=1", maps_url_is_listing=False,
                provenance=Provenance(source="Geoapify (OpenStreetMap)", data_type="Live"))
    other = place("temple", 24.5797, 73.6838, name="Test Temple")
    out = dedupe([osm, g, other])
    assert [p.id for p in out] == ["google:palace", "google:temple"]


def test_budget_summary_uses_only_real_prices():
    from models.itinerary import Day
    from services.itinerary_service import budget_summary

    priced = place("cafe", 0, 0, price_range=PriceRange(min=400, max=600, currency="INR", basis="Google price range per person"))
    unpriced = place("thali", 0, 0)
    day = Day(index=0, date=MONDAY, blocks=[
        Block(id="1", kind="meal", meal="lunch", part="afternoon", duration_min=60, title="Lunch", place=priced),
        Block(id="2", kind="meal", meal="dinner", part="evening", duration_min=75, title="Dinner", place=unpriced),
    ])
    s = budget_summary(request(adults=2), [day], None)
    (meals,) = [line for line in s.lines if line.label.startswith("Meals")]
    assert meals.amount_min == 800 and meals.amount_max == 1200 and meals.data_type == "Live"
    assert any("1 meal stop(s) have no price data" in n for n in s.notes)
    assert all(line.label != "Your daily budget" for line in s.lines)
