"""Google Places API (New): Autocomplete, Nearby Search, Text Search, Place Details, Photos.

Terms: Google content must not be cached or stored (place IDs may be). So cache_ttl is 0
and saved itineraries keep only place IDs, re-fetching details when opened."""

from models.common import Provenance, utcnow
from models.place import OpeningHours, OpeningPeriod, PhotoRef, Place, PriceRange, Suggestion
from geo import haversine_m
from integrations.base import Provider

BASE = "https://places.googleapis.com/v1"

_LIST_FIELDS = [
    "id", "displayName", "formattedAddress", "location", "googleMapsUri", "rating",
    "userRatingCount", "primaryType", "types", "priceLevel", "businessStatus",
]
_HOURS_FIELDS = ["regularOpeningHours", "priceRange"]
DETAIL_FIELDS = _LIST_FIELDS + _HOURS_FIELDS + [
    "currentOpeningHours.openNow", "websiteUri", "nationalPhoneNumber", "internationalPhoneNumber", "photos",
]


def _mask(fields: list[str], prefix: str = "places.") -> str:
    return ",".join(prefix + f for f in fields)


def _hhmm(h: int | None, m: int | None) -> str:
    return f"{(h or 0):02d}:{(m or 0):02d}"


def _money(m: dict | None) -> float | None:
    if not m:
        return None
    return float(m.get("units", 0) or 0) + (m.get("nanos", 0) or 0) / 1e9


def normalise_place(raw: dict, category: str | None = None, near: tuple[float, float] | None = None) -> Place | None:
    loc = raw.get("location") or {}
    if "latitude" not in loc or not raw.get("id"):
        return None
    lat, lng = loc["latitude"], loc["longitude"]

    hours = None
    roh = raw.get("regularOpeningHours")
    open_now = (raw.get("currentOpeningHours") or {}).get("openNow")
    if roh or open_now is not None:
        periods = []
        for p in (roh or {}).get("periods", []):
            o, c = p.get("open") or {}, p.get("close")
            periods.append(OpeningPeriod(
                open_day=o.get("day", 0), open_time=_hhmm(o.get("hour"), o.get("minute")),
                close_day=c.get("day") if c else None,
                close_time=_hhmm(c.get("hour"), c.get("minute")) if c else None,
            ))
        hours = OpeningHours(
            weekday_text=(roh or {}).get("weekdayDescriptions", []),
            periods=periods,
            open_now=open_now if open_now is not None else (roh or {}).get("openNow"),
        )

    price_range = None
    pr = raw.get("priceRange")
    if pr:
        start, end = pr.get("startPrice"), pr.get("endPrice")
        currency = (start or end or {}).get("currencyCode")
        if currency:
            price_range = PriceRange(min=_money(start), max=_money(end), currency=currency, basis="Google price range per person")

    photos = [
        PhotoRef(
            ref=ph["name"], width=ph.get("widthPx"), height=ph.get("heightPx"),
            attributions=[a.get("displayName", "") for a in ph.get("authorAttributions", []) if a.get("displayName")],
        )
        for ph in raw.get("photos", [])[:6]
        if ph.get("name")
    ]

    return Place(
        id=f"google:{raw['id']}",
        provider="google",
        provider_place_id=raw["id"],
        google_place_id=raw["id"],
        name=(raw.get("displayName") or {}).get("text") or "Unnamed place",
        category=category,
        types=raw.get("types", []),
        primary_type=raw.get("primaryType"),
        business_status=raw.get("businessStatus"),
        # Vehicle types only from Google's own category, never guessed from the name.
        vehicle_types=["Cars (Google category: car rental)"] if "car_rental" in raw.get("types", []) else [],
        address=raw.get("formattedAddress"),
        lat=lat,
        lng=lng,
        maps_url=raw.get("googleMapsUri") or f"https://www.google.com/maps/place/?q=place_id:{raw['id']}",
        maps_url_is_listing=True,
        rating=raw.get("rating"),
        rating_count=raw.get("userRatingCount"),
        opening_hours=hours,
        website=raw.get("websiteUri"),
        phone=raw.get("internationalPhoneNumber") or raw.get("nationalPhoneNumber"),
        photos=photos,
        price_level=raw.get("priceLevel"),
        price_range=price_range,
        distance_m=round(haversine_m(near[0], near[1], lat, lng)) if near else None,
        provenance=Provenance(source="Google Places", data_type="Live", last_checked=utcnow(), attribution="Google Maps"),
    )


class GooglePlaces(Provider):
    name = "google_places"
    label = "Google Places"
    rate_per_second = 8
    burst = 8

    def configured(self) -> bool:
        return bool(self.settings.google_maps_server_key)

    def _headers(self, mask: str) -> dict:
        return {"X-Goog-Api-Key": self.settings.google_maps_server_key, "X-Goog-FieldMask": mask}

    async def autocomplete(self, text: str, near: tuple[float, float] | None, session: str | None) -> list[Suggestion]:
        self.require_configured()
        body: dict = {"input": text}
        if near:
            body["locationBias"] = {"circle": {"center": {"latitude": near[0], "longitude": near[1]}, "radius": 50000.0}}
        if session:
            body["sessionToken"] = session
        data = await self.request("POST", f"{BASE}/places:autocomplete", json_body=body, headers=self._headers("*"))
        out = []
        for s in data.get("suggestions", []):
            pp = s.get("placePrediction")
            if not pp:
                continue
            sf = pp.get("structuredFormat") or {}
            out.append(Suggestion(
                id=f"google:{pp['placeId']}", provider="google",
                title=(sf.get("mainText") or {}).get("text") or (pp.get("text") or {}).get("text", ""),
                subtitle=(sf.get("secondaryText") or {}).get("text"),
                google_place_id=pp["placeId"],
            ))
        return out

    async def nearby(
        self, lat: float, lng: float, radius_m: float, types: list[str], category: str | None, max_results: int = 20,
        primary: bool = False, exclude_primary: list[str] | None = None, rank: str = "POPULARITY",
    ) -> list[Place]:
        """primary=True filters on the place's primary type (includedPrimaryTypes), a hard category filter."""
        self.require_configured()
        body = {
            ("includedPrimaryTypes" if primary else "includedTypes"): types,
            "rankPreference": rank,
            "maxResultCount": min(max_results, 20),
            "locationRestriction": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": float(min(radius_m, 50000))}},
        }
        if exclude_primary:
            body["excludedPrimaryTypes"] = exclude_primary
        data = await self.request("POST", f"{BASE}/places:searchNearby", json_body=body, headers=self._headers(_mask(_LIST_FIELDS)))
        return [p for raw in data.get("places", []) if (p := normalise_place(raw, category, (lat, lng)))]

    async def text_search(
        self, query: str, lat: float, lng: float, radius_m: float, category: str | None,
        page_token: str | None = None, with_hours: bool = False, page_size: int = 20,
    ) -> tuple[list[Place], str | None]:
        self.require_configured()
        body: dict = {
            "textQuery": query,
            "pageSize": page_size,
            "locationBias": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": float(min(radius_m, 50000))}},
        }
        if page_token:
            body["pageToken"] = page_token
        fields = _LIST_FIELDS + (_HOURS_FIELDS if with_hours else [])
        mask = _mask(fields) + ",nextPageToken"
        data = await self.request("POST", f"{BASE}/places:searchText", json_body=body, headers=self._headers(mask))
        places = [p for raw in data.get("places", []) if (p := normalise_place(raw, category, (lat, lng)))]
        # Text Search only biases; keep results inside the requested circle.
        places = [p for p in places if (p.distance_m or 0) <= radius_m * 1.1]
        return places, data.get("nextPageToken")

    async def details(self, place_id: str, category: str | None = None, session: str | None = None) -> Place | None:
        self.require_configured()
        params = {"sessionToken": session} if session else None
        raw = await self.request("GET", f"{BASE}/places/{place_id}", params=params, headers=self._headers(",".join(DETAIL_FIELDS)))
        return normalise_place(raw, category)

    async def photo_uri(self, photo_name: str, max_px: int = 800) -> str:
        """Returns a short-lived googleusercontent URL (no key in it)."""
        self.require_configured()
        if not photo_name.startswith("places/") or "/photos/" not in photo_name:
            raise ValueError("Invalid photo reference")
        data = await self.request(
            "GET", f"{BASE}/{photo_name}/media",
            params={"maxWidthPx": max_px, "skipHttpRedirect": "true"},
            headers={"X-Goog-Api-Key": self.settings.google_maps_server_key},
        )
        return data["photoUri"]
