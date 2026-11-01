"""OpenStreetMap via the Overpass API: used for rentals, where Geoapify has no Udaipur data.

Usage policy: fair use (well under 10,000 queries/day), identify the app with a User-Agent.
Results are cached for 6 hours. OSM data is ODbL: attribution "© OpenStreetMap contributors"."""

import time

from geo import haversine_m, maps_search_url
from integrations.base import Provider, ProviderError
from integrations.geoapify.provider import parse_osm_hours
from models.common import Provenance, utcnow
from models.place import Place

ATTRIBUTION = "© OpenStreetMap contributors (via Overpass)"

# Vehicle types we may state, because they are what the OSM tag itself means.
AMENITY_VEHICLES = {
    "bicycle_rental": "Bicycles",
    "car_rental": "Cars",
    "motorcycle_rental": "Motorcycles / scooters",
    "taxi": "Taxi (car with driver)",
}
RENTAL_TAG_VEHICLES = {"bicycle": "Bicycles", "car": "Cars", "motorcycle": "Motorcycles", "scooter": "Scooters", "moped": "Mopeds"}


def build_query(selectors: list[str], lat: float, lng: float, radius_m: int, limit: int = 60) -> str:
    parts = "".join(f"{sel}(around:{int(radius_m)},{lat:.6f},{lng:.6f});" for sel in selectors)
    return f"[out:json][timeout:25];({parts});out center tags {limit};"


def vehicle_types(tags: dict) -> list[str]:
    out = []
    if tags.get("amenity") in AMENITY_VEHICLES:
        out.append(AMENITY_VEHICLES[tags["amenity"]])
    for v in str(tags.get("rental", "")).split(";"):
        if v.strip() in RENTAL_TAG_VEHICLES and RENTAL_TAG_VEHICLES[v.strip()] not in out:
            out.append(RENTAL_TAG_VEHICLES[v.strip()])
    return [f"{v} (OpenStreetMap tag)" for v in out]


def normalise_element(el: dict, category: str | None, near: tuple[float, float]) -> Place | None:
    tags = el.get("tags") or {}
    name = (tags.get("name:en") or tags.get("name") or "").strip()
    lat = el.get("lat") if "lat" in el else (el.get("center") or {}).get("lat")
    lng = el.get("lon") if "lon" in el else (el.get("center") or {}).get("lon")
    if not name or lat is None or lng is None:
        return None
    addr = ", ".join(x for x in (tags.get("addr:housenumber"), tags.get("addr:street"), tags.get("addr:city")) if x) or None
    return Place(
        id=f"osm:{el.get('type', 'node')}/{el.get('id')}",
        provider="osm",
        provider_place_id=f"{el.get('type', 'node')}/{el.get('id')}",
        name=name,
        category=category,
        types=[f"{k}={tags[k]}" for k in ("amenity", "shop", "office", "rental") if tags.get(k)],
        primary_type=tags.get("amenity") or tags.get("shop") or tags.get("office"),
        wikidata=tags.get("wikidata"),
        vehicle_types=vehicle_types(tags),
        address=addr,
        lat=float(lat),
        lng=float(lng),
        maps_url=maps_search_url(name, float(lat), float(lng)),
        maps_url_is_listing=False,
        opening_hours=parse_osm_hours(tags.get("opening_hours")),
        website=tags.get("website") or tags.get("contact:website"),
        phone=tags.get("phone") or tags.get("contact:phone") or tags.get("contact:mobile"),
        distance_m=round(haversine_m(near[0], near[1], float(lat), float(lng))),
        provenance=Provenance(source="OpenStreetMap (Overpass)", data_type="Live", last_checked=utcnow(), attribution=ATTRIBUTION),
    )


class Overpass(Provider):
    name = "overpass"
    label = "OpenStreetMap (Overpass)"
    cache_ttl = 6 * 3600
    rate_per_second = 0.5
    burst = 2
    timeout_s = 40  # public servers often take 20-35 s for these queries
    max_retries = 0  # try the next mirror instead of repeating a slow call

    def configured(self) -> bool:
        return bool(self.settings.overpass_url)

    async def search(self, selectors: list[str], lat: float, lng: float, radius_m: int, category: str | None) -> list[Place]:
        if not selectors:
            return []
        urls = [u.strip() for u in self.settings.overpass_url.split(",") if u.strip()]
        last: Exception | None = None
        started = time.monotonic()
        for url in urls:  # public servers are often busy: fall through to the next mirror
            if time.monotonic() - started > 35:  # overall budget, so a slow day can't stall a page
                break
            try:
                data = await self.request(
                    "POST", url,
                    form={"data": build_query(selectors, lat, lng, radius_m)},
                    headers={"User-Agent": self.settings.nominatim_user_agent or "TripTrail/0.1 (itinerary app)"},
                )
            except ProviderError as exc:
                last = exc
                continue
            return [p for el in data.get("elements", []) if (p := normalise_element(el, category, (lat, lng)))]
        raise last or ProviderError("No Overpass server configured")
