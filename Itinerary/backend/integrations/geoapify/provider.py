"""Geoapify Places + Geocoding. Data is OpenStreetMap-based (ODbL); attribution required.
Geoapify's terms allow storing results, so responses are cached for a day."""

import logging
import re

from models.common import Provenance, utcnow
from models.place import OpeningHours, OpeningPeriod, Place, Suggestion
from geo import haversine_m, maps_search_url
from integrations.base import Provider

log = logging.getLogger("integrations.geoapify")
ATTRIBUTION = "Powered by Geoapify · © OpenStreetMap contributors"
_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
_RULE = re.compile(r"^\s*(?:(Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(Mo|Tu|We|Th|Fr|Sa|Su))?\s+)?((?:\d{1,2}:\d{2}-\d{1,2}:\d{2}\s*,?\s*)+)\s*$")


def parse_osm_hours(text: str | None) -> OpeningHours | None:
    """Parses the common OSM forms ("Mo-Sa 09:00-18:00; Su 10:00-14:00", "24/7",
    "09:00-17:00"). Anything else is kept as raw text and treated as unknown."""
    if not text:
        return None
    t = text.strip()
    if t == "24/7":
        return OpeningHours(raw=t, periods=[OpeningPeriod(open_day=d, open_time="00:00", close_day=d, close_time="23:59") for d in range(7)])
    periods: list[OpeningPeriod] = []
    for rule in t.split(";"):
        rule = rule.strip()
        if not rule:
            continue
        if re.fullmatch(r"(?:(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?\s*)+off", rule):
            continue
        m = _RULE.match(rule)
        if not m:
            return OpeningHours(raw=t)  # unsupported syntax: don't guess
        d1, d2, times = m.groups()
        if d1:
            a, b = _DAYS.index(d1), _DAYS.index(d2 or d1)
            # OSM weeks run Mo..Su; walk forward with wraparound.
            days, d = [], a
            while True:
                days.append(d)
                if d == b:
                    break
                d = (d + 1) % 7
        else:
            days = list(range(7))
        for span in re.findall(r"(\d{1,2}:\d{2})-(\d{1,2}:\d{2})", times):
            for d in days:
                periods.append(OpeningPeriod(open_day=d, open_time=span[0].zfill(5), close_day=d, close_time=span[1].zfill(5)))
    return OpeningHours(raw=t, periods=periods) if periods else OpeningHours(raw=t)


def _text(v) -> str | None:
    """OSM tags are free-form: numbers, lists or blanks all appear. Keep a clean string or nothing."""
    if v is None or v == "":
        return None
    if isinstance(v, list):
        v = v[0] if v else None
        return _text(v)
    return str(v).strip() or None


def normalise_feature(feature: dict, category: str | None = None, near: tuple[float, float] | None = None) -> Place | None:
    try:
        return _normalise_feature(feature, category, near)
    except (ValueError, TypeError, KeyError) as exc:  # one malformed record must not sink the whole list
        log.warning("Skipping malformed Geoapify feature %s: %s", (feature.get("properties") or {}).get("place_id"), exc)
        return None


def _normalise_feature(feature: dict, category: str | None, near: tuple[float, float] | None) -> Place | None:
    p = feature.get("properties") or {}
    name = _text(p.get("name"))
    if not name or p.get("lat") is None:
        return None  # unnamed POIs aren't useful to travellers
    lat, lng = p["lat"], p["lon"]
    raw = (p.get("datasource") or {}).get("raw") or {}
    contact = p.get("contact") or {}
    cats = [c for c in p.get("categories", []) if isinstance(c, str)]
    specific = max(cats, key=lambda c: c.count("."), default=None)
    vehicles = [label for key, label in (("rental.bicycle", "Bicycles"), ("rental.car", "Cars")) if key in cats]
    return Place(
        id=f"geoapify:{p.get('place_id')}",
        provider="geoapify",
        provider_place_id=str(p.get("place_id")),
        name=name,
        category=category,
        types=cats,
        primary_type=specific,
        # A brand's Wikidata id also marks a well-known place (chains are never "hidden gems").
        wikidata=_text(raw.get("wikidata")) or _text((p.get("wiki_and_media") or {}).get("wikidata")) or _text(raw.get("brand:wikidata"))
        or (f"brand:{raw['brand']}" if _text(raw.get("brand")) else None),
        vehicle_types=[f"{v} (OpenStreetMap tag)" for v in vehicles],
        address=_text(p.get("formatted")) or _text(p.get("address_line2")),
        lat=lat,
        lng=lng,
        maps_url=maps_search_url(name, lat, lng),
        maps_url_is_listing=False,
        opening_hours=parse_osm_hours(_text(p.get("opening_hours")) or _text(raw.get("opening_hours"))),
        website=_text(p.get("website")) or _text(raw.get("website")) or _text(raw.get("contact:website")),
        phone=_text(contact.get("phone")) or _text(raw.get("phone")) or _text(raw.get("contact:phone")),
        distance_m=round(haversine_m(near[0], near[1], lat, lng)) if near else p.get("distance"),
        provenance=Provenance(source="Geoapify (OpenStreetMap)", data_type="Live", last_checked=utcnow(), attribution=ATTRIBUTION),
    )


def normalise_geocode(r: dict) -> Suggestion | None:
    if r.get("lat") is None:
        return None
    title = r.get("name") or r.get("city") or r.get("address_line1") or r.get("formatted", "")
    return Suggestion(
        id=f"geoapify:{r.get('place_id')}", provider="geoapify", title=title,
        subtitle=r.get("formatted") if r.get("formatted") != title else r.get("country"),
        lat=r["lat"], lng=r["lon"],
    )


class Geoapify(Provider):
    name = "geoapify"
    label = "Geoapify"
    cache_ttl = 24 * 3600
    rate_per_second = 5  # free plan allows 5 requests/second
    burst = 5

    def configured(self) -> bool:
        return bool(self.settings.geoapify_api_key)

    async def places(self, lat: float, lng: float, radius_m: float, categories: list[str], category: str | None, limit: int = 20, offset: int = 0) -> list[Place]:
        self.require_configured()
        if not categories:
            return []
        data = await self.request("GET", "https://api.geoapify.com/v2/places", params={
            "categories": ",".join(categories),
            "filter": f"circle:{lng},{lat},{int(radius_m)}",
            "bias": f"proximity:{lng},{lat}",
            "limit": limit,
            "offset": offset,
            "apiKey": self.settings.geoapify_api_key,
        })
        return [p for f in data.get("features", []) if (p := normalise_feature(f, category, (lat, lng)))]

    async def details(self, place_id: str, category: str | None = None) -> Place | None:
        self.require_configured()
        data = await self.request("GET", "https://api.geoapify.com/v2/place-details", params={"id": place_id, "apiKey": self.settings.geoapify_api_key})
        for f in data.get("features", []):
            if (f.get("properties") or {}).get("feature_type") == "details":
                return normalise_feature(f, category)
        feats = data.get("features", [])
        return normalise_feature(feats[0], category) if feats else None

    async def autocomplete(self, text: str, near: tuple[float, float] | None = None) -> list[Suggestion]:
        self.require_configured()
        params = {"text": text, "format": "json", "limit": 6, "apiKey": self.settings.geoapify_api_key}
        if near:
            params["bias"] = f"proximity:{near[1]},{near[0]}"
        data = await self.request("GET", "https://api.geoapify.com/v1/geocode/autocomplete", params=params)
        return [s for r in data.get("results", []) if (s := normalise_geocode(r))]

    async def geocode(self, text: str) -> list[Suggestion]:
        self.require_configured()
        data = await self.request("GET", "https://api.geoapify.com/v1/geocode/search", params={"text": text, "format": "json", "limit": 5, "apiKey": self.settings.geoapify_api_key})
        return [s for r in data.get("results", []) if (s := normalise_geocode(r))]

    async def nearest_airports(self, lat: float, lng: float, radius_m: int = 200000) -> list[dict]:
        """Airports near a point, with IATA codes from OpenStreetMap tags where present."""
        self.require_configured()
        data = await self.request("GET", "https://api.geoapify.com/v2/places", params={
            "categories": "airport",
            "filter": f"circle:{lng},{lat},{radius_m}",
            "bias": f"proximity:{lng},{lat}",
            "limit": 20,
            "apiKey": self.settings.geoapify_api_key,
        })
        out = []
        for f in data.get("features", []):
            p = f.get("properties") or {}
            raw = (p.get("datasource") or {}).get("raw") or {}
            iata = raw.get("iata")
            if iata and isinstance(iata, str) and len(iata) == 3:
                out.append({"iata": iata.upper(), "name": p.get("name") or iata, "distance_m": p.get("distance")})
        return out
