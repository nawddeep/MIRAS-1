# Trip Trail: Udaipur itinerary and discovery

Two experiences, both built only from live provider data:

- **Plan my trip** (`/plan`): a step-by-step form, or "Skip details" presets. Produces transport options, weather, a day-wise plan (morning, afternoon and evening blocks, meals, buffers, travel time between stops), stays, essentials, a budget built only from real prices, and walking trail cards. You can add, remove and reorder stops, regenerate a day, save, and share a link.
- **Explore around me** (`/explore`): search a place or use your location. A map and list with category filters (including hidden gems, artisans and bike/car rentals), radius control, paging and a lazy detail panel. Rental shops get **Ride from here**, which suggests loop routes through real places.

The app **never books anything**. Buttons link to the provider or Google Maps. Every data card shows `Live`, `Scheduled`, `Estimated` or `Historical`, the source, and when it was last checked.

```
backend/   FastAPI + PostgreSQL (providers, services, routers, tests)
frontend/  Next.js 16 + Tailwind 4 (same stack as Miras; design re-created, nothing imported)
```

## Setup

Needs Python 3.12+ and Node 20.9+.

```bash
cp .env.example .env            # fill in the keys you have (the app reads .env, not .env.example)

cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 8000      # API docs: http://localhost:8000/docs
.venv/bin/python -m pytest                           # tests (all provider calls mocked)

cd ../frontend
npm install
echo "BACKEND_URL=http://127.0.0.1:8000" > .env.local
npm run dev                                          # http://localhost:3000
npm run lint && npm run typecheck && npm run build
```

`GET /api/status` lists which providers are configured and whether the database is reachable.

Saved trips go to a SQLite file at `backend/data/itinerary.db` (created on first run). Any SQLAlchemy URL in `DATABASE_URL` also works.

## How suggestions are chosen

- **One mapping table:** [`backend/catalog.py`](backend/catalog.py) maps every interest and Explore category to Google primary types, Text Search queries, Geoapify categories (each checked against the live API) and OpenStreetMap tags.
- **Post-filter:** names or types that contradict the category are dropped. For example, diners, fast food, "bhojnalay" and generic restaurants never appear under Cafes. A unit test enforces this.
- **Quality filter:** operational businesses only, with at least `MIN_RATING` and `MIN_REVIEWS` on Google. OpenStreetMap places have no ratings, so they are ranked by how well documented they are (Wikidata, website, hours).
- **Score:** 2 × quality (Bayesian rating) + interest match + budget fit + weather fit − 0.15 per km from the day's area. The reasons are stored on each place and shown as "Why:".
- **Variety:** each day is centred on a different area (Lake Pichola, old-city bazaars, Fateh Sagar, Sajjangarh, Shilpgram, Hiran Magri), chosen by your interests. A place is never used twice in a trip. Several queries and pages are merged before ranking. About 1 in 3 stops is a lesser-known pick when one is available.
- **Too few results:** the search widens (2.5 km → 4.5 km → 7.5 km), then relaxes filters, and the day says what changed.
- **Show me different suggestions:** works per day and per stop. Places already shown are excluded.
- **Debug:** set `DEBUG_ENDPOINTS=true` and POST a trip request to `/api/debug/explain`. You get the queries sent, counts after each filter, and scores with reasons. Keep it off in production.

## Rentals and travel modes

- **Explore → Bike & car rentals** has sub-filters (bike/motorcycle, scooter, bicycle, car, self-drive, with driver). Sources are Google Places, Geoapify and OpenStreetMap (Overpass). Vehicle types appear only when the provider states them. No prices are shown.
- **Planner:** asks "Do you want to rent a vehicle?" A rental lists shops near your arrival point and day-1 area, uses vehicle times for legs over 500 m, and allows stops farther apart.
- **Times by mode:** every leg, day route and trail shows two-wheeler, four-wheeler, walk and cycle times, each with Start navigation.
  - Two-wheeler comes from Google Routes `TWO_WHEELER` when configured. Otherwise it is car time × `TWO_WHEELER_FACTOR`, labelled **Estimated**.
  - Car times from OSRM are not traffic-aware, and the app says so.
  - Narrow old-city lanes are flagged for cars.

## What works without any keys

- Open-Meteo weather and elevation, and OSRM routing on the FOSSGIS servers, need no key.
- The map falls back to Leaflet with OpenStreetMap tiles. The dark theme is the same tiles with a CSS filter.
- Place search, places and transport show a clear "not configured" notice. Nothing is filled with sample data.

With `GOOGLE_MAPS_SERVER_KEY` and/or `GEOAPIFY_API_KEY` set, the planner and Explore return real places.

## Providers

| Area | Primary | Fallbacks | Label |
|---|---|---|---|
| Autocomplete | Google Places (New) | Geoapify | – |
| Explicit geocoding | Geoapify | Nominatim (never used for autocomplete, per its policy) | – |
| Places | Google Places Nearby (primary types) + Text Search | Geoapify, OpenStreetMap Overpass for rentals (merged, de-duplicated) | Live |
| Weather | Open-Meteo forecast (≤16 days) | Open-Meteo archive, same dates in an earlier year | Live / Historical |
| Routing | Google Routes (incl. two-wheeler) | OpenRouteService → OSRM → straight-line estimate; two-wheeler derived from car | Live / Estimated |
| Flights | SerpApi Google Flights, Duffel (offers) | Aviationstack (future schedules, or today's flights on the route as a labelled reference) | Live / Scheduled |
| Trains | data.gov.in timetable dataset | – | Historical (reference timetable) |
| Buses | Local authorised GTFS feed | – | Scheduled |

Each provider has a timeout, retries with backoff on 429/5xx, a token-bucket rate limit, and a 5-minute pause after a 401/403. Caching is on only where the terms allow it (Geoapify, OSRM/ORS, Nominatim, Open-Meteo, SerpApi briefly). **Google responses are never cached.** Saved itineraries store only Google place IDs and re-fetch details when opened.

## Honesty rules the code enforces

- Ratings come only from Google. OSM places show "Not available (ratings come from Google only)".
- Budget lines exist only for real prices: Google price ranges, provider fares, and your own range. Missing prices are listed in the notes, not guessed.
- Time at each stop is labelled an estimate. Visits that fall outside known opening hours are flagged "May be closed at this time".
- Trails are always labelled "Suggested route", with difficulty marked as an estimate and the basis shown.
- Hidden gems: Google results with fewer than 300 reviews (stated in the UI).

## Known gaps

- **Qrail**: no public API specification was available, so the adapter reports "not configured" rather than guessing endpoints.
- **data.gov.in trains**: you need to set the resource id of the timetable dataset you use. The normaliser expects its standard columns (`train_no`, `station_code`, `seq`, times). No fares or running status.
- **Buses**: there is no public GTFS feed for Udaipur routes that we know of. Drop an authorised feed into `GTFS_BUS_FEED_DIR`.
- **Aviationstack** `flightsFuture` needs a paid plan. On the free plan its error is shown as a provider notice.
- Google Maps JS uses the classic `Marker` (deprecated but supported). Moving to `AdvancedMarkerElement` needs a Map ID.
- For heavy production traffic, use your own tile and OSRM servers. The public OSM tile and FOSSGIS servers are for light use.
- Saved trips use an unguessable share link plus an edit token kept in the creator's browser. There are no user accounts.
