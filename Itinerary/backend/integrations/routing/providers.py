"""Routing providers. Primary: Google Routes API. Fallbacks: OpenRouteService (also returns
elevation) and OSRM on the FOSSGIS servers (routing.openstreetmap.de)."""

from pydantic import BaseModel

from integrations.base import Provider, ProviderError


class RouteResult(BaseModel):
    geometry: list[tuple[float, float]]  # [lat, lng]
    distance_m: float
    duration_s: float
    ascent_m: float | None = None
    elevations: list[float] | None = None  # aligned with geometry when the provider returns 3D coords
    legs: list[tuple[float, float]] = []  # (distance_m, duration_s) between consecutive waypoints
    source: str


def decode_polyline(encoded: str) -> list[tuple[float, float]]:
    """Google encoded polyline algorithm (precision 5)."""
    coords, index, lat, lng = [], 0, 0, 0
    while index < len(encoded):
        for which in (0, 1):
            shift, result = 0, 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if result & 1 else result >> 1
            if which == 0:
                lat += delta
            else:
                lng += delta
        coords.append((lat / 1e5, lng / 1e5))
    return coords


GOOGLE_MODE = {"walk": "WALK", "cycle": "BICYCLE", "scooter": "TWO_WHEELER", "car": "DRIVE"}
ORS_PROFILE = {"walk": "foot-walking", "cycle": "cycling-regular", "scooter": "driving-car", "car": "driving-car"}
OSRM_PROFILE = {"walk": "routed-foot", "cycle": "routed-bike", "scooter": "routed-car", "car": "routed-car"}


def normalise_google_route(data: dict) -> RouteResult:
    routes = data.get("routes") or []
    if not routes:
        raise ProviderError("Google Routes returned no route")
    r = routes[0]
    return RouteResult(
        geometry=decode_polyline((r.get("polyline") or {}).get("encodedPolyline", "")),
        distance_m=float(r.get("distanceMeters", 0)),
        duration_s=float(str(r.get("duration", "0s")).rstrip("s") or 0),
        legs=[(float(lg.get("distanceMeters", 0)), float(str(lg.get("duration", "0s")).rstrip("s") or 0)) for lg in r.get("legs", [])],
        source="Google Routes",
    )


def normalise_ors(data: dict) -> RouteResult:
    feats = data.get("features") or []
    if not feats:
        raise ProviderError("OpenRouteService returned no route")
    f = feats[0]
    coords = f["geometry"]["coordinates"]
    props = f.get("properties") or {}
    summary = props.get("summary") or {}
    has_z = bool(coords) and len(coords[0]) == 3
    return RouteResult(
        geometry=[(c[1], c[0]) for c in coords],
        distance_m=float(summary.get("distance", 0)),
        duration_s=float(summary.get("duration", 0)),
        ascent_m=props.get("ascent"),
        elevations=[c[2] for c in coords] if has_z else None,
        legs=[(float(sg.get("distance", 0)), float(sg.get("duration", 0))) for sg in props.get("segments", [])],
        source="OpenRouteService",
    )


def normalise_osrm(data: dict) -> RouteResult:
    if data.get("code") != "Ok" or not data.get("routes"):
        raise ProviderError(f"OSRM: {data.get('code')}")
    r = data["routes"][0]
    return RouteResult(
        geometry=[(c[1], c[0]) for c in r["geometry"]["coordinates"]],
        distance_m=float(r["distance"]),
        duration_s=float(r["duration"]),
        legs=[(float(lg["distance"]), float(lg["duration"])) for lg in r.get("legs", [])],
        source="OSRM (OpenStreetMap)",
    )


class GoogleRoutes(Provider):
    name = "google_routes"
    label = "Google Routes"
    rate_per_second = 5

    def configured(self) -> bool:
        return bool(self.settings.google_maps_server_key)

    async def route(self, points: list[tuple[float, float]], mode: str) -> RouteResult:
        self.require_configured()
        wp = lambda p: {"location": {"latLng": {"latitude": p[0], "longitude": p[1]}}}  # noqa: E731
        body = {
            "origin": wp(points[0]),
            "destination": wp(points[-1]),
            "intermediates": [wp(p) for p in points[1:-1]],
            "travelMode": GOOGLE_MODE[mode],
        }
        if mode in ("car", "scooter"):
            body["routingPreference"] = "TRAFFIC_AWARE" if self.settings.google_routes_traffic_aware else "TRAFFIC_UNAWARE"
        data = await self.request(
            "POST", "https://routes.googleapis.com/directions/v2:computeRoutes", json_body=body,
            headers={
                "X-Goog-Api-Key": self.settings.google_maps_server_key,
                "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration",
            },
        )
        return normalise_google_route(data)


class OpenRouteService(Provider):
    name = "openrouteservice"
    label = "OpenRouteService"
    cache_ttl = 24 * 3600
    rate_per_second = 0.6  # free plan: 40 directions requests/minute
    burst = 3

    def configured(self) -> bool:
        return bool(self.settings.openrouteservice_api_key)

    async def route(self, points: list[tuple[float, float]], mode: str) -> RouteResult:
        self.require_configured()
        data = await self.request(
            "POST", f"https://api.openrouteservice.org/v2/directions/{ORS_PROFILE[mode]}/geojson",
            json_body={"coordinates": [[p[1], p[0]] for p in points], "elevation": True},
            headers={"Authorization": self.settings.openrouteservice_api_key},
        )
        return normalise_ors(data)


class OSRM(Provider):
    name = "osrm"
    label = "OSRM (FOSSGIS)"
    cache_ttl = 24 * 3600
    rate_per_second = 1  # shared community servers: be gentle
    burst = 2

    def configured(self) -> bool:
        return bool(self.settings.osrm_base_url)

    async def route(self, points: list[tuple[float, float]], mode: str) -> RouteResult:
        coords = ";".join(f"{p[1]:.6f},{p[0]:.6f}" for p in points)
        base = self.settings.osrm_base_url.rstrip("/")
        data = await self.request(
            "GET", f"{base}/{OSRM_PROFILE[mode]}/route/v1/driving/{coords}",
            params={"overview": "full", "geometries": "geojson"},
            headers={"User-Agent": self.settings.nominatim_user_agent or "ItineraryApp/0.1"},
        )
        return normalise_osrm(data)
