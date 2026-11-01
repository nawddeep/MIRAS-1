from datetime import date
from pathlib import Path

from tests.conftest import fixture


def test_google_place_normaliser_maps_all_fields():
    from integrations.google_places.provider import normalise_place

    raw = fixture("google_text_search.json")["places"][0]
    p = normalise_place(raw, "heritage", near=(24.5854, 73.7125))
    assert p.id == "google:ChIJ_city_palace"
    assert p.google_place_id == "ChIJ_city_palace"
    assert p.maps_url == "https://maps.google.com/?cid=111" and p.maps_url_is_listing
    assert p.rating == 4.6 and p.rating_count == 52000
    assert p.opening_hours.periods[1].open_time == "09:30"
    assert p.opening_hours.periods[1].close_time == "17:30"
    assert len(p.opening_hours.weekday_text) == 7
    assert p.provenance.source == "Google Places" and p.provenance.data_type == "Live"
    assert p.distance_m and p.distance_m > 2000


def test_google_missing_fields_stay_empty_not_invented():
    from integrations.google_places.provider import normalise_place

    p = normalise_place(fixture("google_text_search.json")["places"][4])
    assert p.rating is None and p.rating_count is None
    assert p.address is None and p.opening_hours is None and p.website is None and p.phone is None
    assert p.price_range is None


def test_google_price_range_and_photos():
    from integrations.google_places.provider import normalise_place

    raw = dict(fixture("google_restaurants.json")["places"][0])
    raw["photos"] = [{"name": "places/X/photos/Y", "widthPx": 800, "heightPx": 600, "authorAttributions": [{"displayName": "A. Photographer"}]}]
    p = normalise_place(raw)
    assert p.price_range.min == 400 and p.price_range.max == 600 and p.price_range.currency == "INR"
    assert p.photos[0].ref == "places/X/photos/Y" and p.photos[0].attributions == ["A. Photographer"]


def test_google_place_without_location_is_dropped():
    from integrations.google_places.provider import normalise_place

    assert normalise_place({"id": "x", "displayName": {"text": "No location"}}) is None


def test_geoapify_feature_normaliser_and_unnamed_dropped():
    from integrations.geoapify.provider import normalise_feature

    feats = fixture("geoapify_places.json")["features"]
    p = normalise_feature(feats[1], "artisans")
    assert p.id == "geoapify:geo_studio" and p.provider == "geoapify"
    assert p.rating is None  # ratings are Google-only
    assert not p.maps_url_is_listing and "google.com/maps/search" in p.maps_url
    assert p.phone == "+91 00000 00000" and p.website == "https://example.org"
    assert "OpenStreetMap" in p.provenance.attribution
    assert normalise_feature(feats[2]) is None


def test_osm_opening_hours_parser():
    from integrations.geoapify.provider import parse_osm_hours

    h = parse_osm_hours("Mo-Sa 10:00-19:00; Su off")
    days = sorted({p.open_day for p in h.periods})
    assert days == [1, 2, 3, 4, 5, 6]  # Google numbering, Sunday (0) closed
    assert parse_osm_hours("24/7").periods[0].close_time == "23:59"
    split = parse_osm_hours("Mo-Fr 09:00-12:00,14:00-18:00")
    assert len(split.periods) == 10
    wrap = parse_osm_hours("Fr-Mo 10:00-16:00")
    assert sorted({p.open_day for p in wrap.periods}) == [0, 1, 5, 6]
    unknown = parse_osm_hours("sunrise-sunset")
    assert unknown.raw == "sunrise-sunset" and unknown.periods == []
    assert parse_osm_hours(None) is None


def test_open_meteo_forecast_and_suggestions():
    from integrations.weather.open_meteo import normalise_forecast, suggest

    rep = normalise_forecast(fixture("open_meteo_forecast.json"))
    assert rep.current.temperature_c == 27.1 and rep.current.condition == "Mainly clear"
    assert rep.current.provenance.data_type == "Live"
    d1, d2 = rep.daily
    assert d1.suggestion == "outdoor" and d1.sunrise == "06:42"
    assert d2.suggestion == "indoor" and d2.condition == "Rain" and d2.rain_probability_pct == 80
    assert suggest(0, 10, 38) == "mixed"


def test_open_meteo_archive_is_labelled_historical():
    from integrations.weather.open_meteo import normalise_archive

    data = {"daily": {"time": ["2025-12-20"], "weather_code": [2], "temperature_2m_max": [24.0], "temperature_2m_min": [9.0], "precipitation_sum": [0.0], "wind_speed_10m_max": [9.0]}}
    (d,) = normalise_archive(data, 1)
    assert d.date == date(2026, 12, 20)
    assert d.provenance.data_type == "Historical" and "Not a forecast" in d.provenance.note


def test_polyline_decoder():
    from integrations.routing.providers import decode_polyline

    pts = decode_polyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")  # Google's documented example
    assert pts == [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]


def test_routing_normalisers():
    from integrations.routing.providers import normalise_google_route, normalise_ors, normalise_osrm

    g = normalise_google_route({"routes": [{"distanceMeters": 1200, "duration": "900s", "polyline": {"encodedPolyline": "_p~iF~ps|U_ulLnnqC"}}]})
    assert g.distance_m == 1200 and g.duration_s == 900 and len(g.geometry) == 2
    ors = normalise_ors({"features": [{"geometry": {"coordinates": [[73.68, 24.57, 580.0], [73.69, 24.58, 600.0]]}, "properties": {"summary": {"distance": 1500, "duration": 1100}, "ascent": 22}}]})
    assert ors.geometry[0] == (24.57, 73.68) and ors.elevations == [580.0, 600.0] and ors.ascent_m == 22
    osrm = normalise_osrm({"code": "Ok", "routes": [{"distance": 2000, "duration": 300, "geometry": {"coordinates": [[73.6, 24.5], [73.7, 24.6]]}}]})
    assert osrm.geometry[-1] == (24.6, 73.7) and osrm.source.startswith("OSRM")


def test_serpapi_flights_normaliser():
    from integrations.flights.providers import normalise_serpapi

    opts = normalise_serpapi(fixture("serpapi_flights.json"), "INR")
    direct, onestop = opts
    assert direct.flight_number == "TA 101" and direct.stops == 0 and direct.duration_min == 85
    assert direct.price.amount == 5432 and direct.price.currency == "INR"
    assert direct.redirect_url == "https://www.google.com/travel/flights?test=1"
    assert direct.provenance.data_type == "Live"
    assert onestop.stops == 1 and onestop.airline == "Test Air + Other Air"
    assert onestop.price is None  # missing price stays missing


def test_aviationstack_is_scheduled_and_filters_destination():
    from integrations.flights.providers import normalise_aviationstack

    data = {"data": [
        {"departure": {"iataCode": "DEL", "scheduledTime": "06:00"}, "arrival": {"iataCode": "UDR", "scheduledTime": "07:25"},
         "airline": {"name": "Test Air"}, "flight": {"iataNumber": "TA101"}, "codeshared": None},
        {"departure": {"iataCode": "DEL", "scheduledTime": "06:00"}, "arrival": {"iataCode": "UDR", "scheduledTime": "07:25"},
         "airline": {"name": "Partner"}, "flight": {"iataNumber": "PA9"}, "codeshared": {"flight": {"iataNumber": "TA101"}}},
        {"departure": {"iataCode": "DEL"}, "arrival": {"iataCode": "BOM"}, "airline": {"name": "X"}, "flight": {"iataNumber": "X1"}},
    ]}
    opts = normalise_aviationstack(data, "UDR", "DEL", date(2026, 11, 20))
    assert [o.flight_number for o in opts] == ["TA101"]
    assert opts[0].provenance.data_type == "Scheduled" and opts[0].price is None


def test_duffel_normaliser():
    from integrations.flights.providers import normalise_duffel

    data = {"data": {"offers": [{
        "id": "off_1", "total_amount": "6100.00", "total_currency": "INR", "owner": {"name": "Test Air"},
        "slices": [{"duration": "PT1H25M", "segments": [{
            "departing_at": "2026-11-10T06:00:00", "arriving_at": "2026-11-10T07:25:00",
            "marketing_carrier": {"name": "Test Air", "iata_code": "TA"}, "marketing_carrier_flight_number": "101",
            "origin": {"iata_code": "DEL"}, "destination": {"iata_code": "UDR"}, "duration": "PT1H25M"}]}],
    }]}}
    (o,) = normalise_duffel(data, "DEL", "UDR", date(2026, 11, 10))
    assert o.flight_number == "TA101" and o.duration_min == 85 and o.price.amount == 6100
    assert "does not book" in o.provenance.note


def test_train_timetable_normaliser_direction_and_label():
    from integrations.trains.providers import normalise_timetable

    origin = [{"train_no": "12963", "train_name": "MEWAR EXP", "station_code": "NZM", "station_name": "H NIZAMUDDIN", "seq": "1", "departure_time": "19:00:00"},
              {"train_no": "99999", "train_name": "OTHER WAY", "station_code": "NZM", "seq": "9", "departure_time": "05:00:00"}]
    dest = [{"train_no": "12963", "train_name": "MEWAR EXP", "station_code": "UDZ", "station_name": "UDAIPUR CITY", "seq": "20", "arrival_time": "07:10:00"},
            {"train_no": "99999", "train_name": "OTHER WAY", "station_code": "UDZ", "seq": "1", "arrival_time": "22:00:00"}]
    (t,) = normalise_timetable(origin, dest, "NZM", "UDZ")
    assert t.train_number == "12963" and t.duration_min == 12 * 60 + 10
    assert t.fare is None and t.running_status is None
    assert t.provenance.data_type == "Historical"


def test_nominatim_normaliser():
    from integrations.geocoding.nominatim import normalise

    s = normalise({"osm_type": "node", "osm_id": 1, "lat": "28.61", "lon": "77.20", "display_name": "New Delhi, Delhi, India", "name": "New Delhi"})
    assert s.title == "New Delhi" and s.lat == 28.61 and s.provider == "nominatim"


def test_gtfs_finds_trips_in_service(tmp_path: Path):
    from integrations.buses.gtfs import Feed, find_trips

    (tmp_path / "agency.txt").write_text("agency_id,agency_name,agency_url,agency_timezone\nA,Test Roadways,https://example.org,Asia/Kolkata\n")
    (tmp_path / "stops.txt").write_text("stop_id,stop_name,stop_lat,stop_lon\nS1,Origin Stand,26.9124,75.7873\nS2,Udaipur Stand,24.5854,73.7125\n")
    (tmp_path / "routes.txt").write_text("route_id,agency_id,route_short_name,route_long_name,route_type\nR1,A,1,Jaipur - Udaipur,3\n")
    (tmp_path / "trips.txt").write_text("route_id,service_id,trip_id\nR1,WK,T1\nR1,WE,T2\n")
    (tmp_path / "stop_times.txt").write_text("trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,07:00:00,07:00:00,S1,1\nT1,14:30:00,14:30:00,S2,2\nT2,08:00:00,08:00:00,S1,1\nT2,15:00:00,15:00:00,S2,2\n")
    (tmp_path / "calendar.txt").write_text("service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nWK,1,1,1,1,1,0,0,20260101,20271231\nWE,0,0,0,0,0,1,1,20260101,20271231\n")
    feed = Feed(tmp_path)
    monday = find_trips(feed, (26.9124, 75.7873), (24.5854, 73.7125), date(2026, 11, 2))
    assert [b.id for b in monday] == ["gtfs:T1"]
    assert monday[0].operator == "Test Roadways" and monday[0].duration_min == 450
    assert monday[0].provenance.data_type == "Scheduled" and monday[0].fare is None


def test_geoapify_tolerates_numeric_and_list_tags():
    from integrations.geoapify.provider import normalise_feature

    f = {"properties": {"name": "Shop", "lat": 24.5, "lon": 73.7, "place_id": "x",
                        "contact": {"phone": 9610868900}, "website": ["https://a.example", "https://b.example"]}}
    p = normalise_feature(f)
    assert p.phone == "9610868900" and p.website == "https://a.example"
    assert normalise_feature({"properties": {"name": "Bad", "lat": "not-a-number", "lon": 1, "place_id": "y"}}) is None
