"""Routes, travel legs and "Suggested route" trail cards."""

import asyncio
import hashlib

from geo import haversine_m, maps_directions_url
from integrations import registry
from integrations.base import ProviderError, try_chain
from integrations.routing.providers import RouteResult
from models.common import Provenance, ProviderStatus, utcnow
from config import get_settings
from models.itinerary import Difficulty, Leg, ModeEstimate, TrailRoute, TrailWaypoint

# Straight-line fallback speeds (km/h) and detour factor, used only when every
# routing provider fails. Results are labelled "Estimated".
FALLBACK_SPEED_KMH = {"walk": 4.5, "cycle": 12, "scooter": 22, "car": 20}
DETOUR = 1.35


async def route(points: list[tuple[float, float]], mode: str) -> tuple[RouteResult | None, list[ProviderStatus]]:
    return await try_chain(registry.routing_chain(), lambda p: p.route(points, mode), is_empty=lambda r: r is None)


def estimate_leg(a: tuple[float, float], b: tuple[float, float], mode: str) -> Leg:
    d = haversine_m(a[0], a[1], b[0], b[1]) * DETOUR
    return Leg(
        distance_m=round(d), duration_s=round(d / (FALLBACK_SPEED_KMH[mode] * 1000 / 3600)), mode=mode,
        provenance=Provenance(source="Straight-line estimate", data_type="Estimated", note="No routing provider answered; distance × 1.35 at a typical speed"),
    )


MODES = ("walk", "cycle", "scooter", "car")


def _zone_hit(dest_zones, a: tuple[float, float], b: tuple[float, float]) -> bool:
    return any(haversine_m(z[0], z[1], a[0], a[1]) <= z[2] and haversine_m(z[0], z[1], b[0], b[1]) <= z[2] for z in dest_zones)


def suitability(mode: str, dist_m: float, a: tuple[float, float], b: tuple[float, float], zones) -> tuple[bool, str | None]:
    """General guidance, not provider data."""
    if mode == "car" and _zone_hit(zones, a, b):
        return False, "Narrow old-city lanes: cars often can't reach the door. Park outside and walk."
    if mode == "walk" and dist_m > 3000:
        return False, "Long walk (over 3 km)."
    if mode == "cycle" and dist_m > 15000:
        return False, "Long ride (over 15 km)."
    return True, None


async def _route_mode(points: list[tuple[float, float]], mode: str) -> tuple[RouteResult | None, bool]:
    """Returns (route, is_provider_two_wheeler). Two-wheeler only comes from Google Routes:
    ORS/OSRM have no two-wheeler profile, so their result is never used as one."""
    if mode == "scooter":
        g = registry.routing_chain()[0]
        if g.configured() and not g.blocked():
            try:
                return await g.route(points, "scooter"), True
            except ProviderError:
                return None, False
        return None, False
    r, _ = await route(points, mode)
    return r, False


async def mode_legs(
    points: list[tuple[float, float]], rental: str = "none", zones=(),
) -> tuple[list[Leg], list[ModeEstimate]]:
    """Legs between consecutive points for every mode, with one multi-stop request per mode
    (walk, cycle, car, plus two-wheeler when Google Routes is configured). Also returns whole-route totals."""
    n = len(points) - 1
    if n < 1:
        return [], []
    factor = get_settings().two_wheeler_factor
    traffic = get_settings().google_routes_traffic_aware
    routes: dict[str, tuple[RouteResult | None, bool]] = {}
    for mode in ("walk", "cycle", "car", "scooter"):
        r, is_tw = await _route_mode(points, mode)
        routes[mode] = (r if r and len(r.legs) == n else None, is_tw)

    per_leg: list[list[ModeEstimate]] = [[] for _ in range(n)]
    for i in range(n):
        a, b = points[i], points[i + 1]
        for mode in MODES:
            r, is_tw = routes[mode]
            if mode == "scooter" and r is None and routes["car"][0] is not None:
                cd, ct = routes["car"][0].legs[i]
                est = ModeEstimate(mode="scooter", distance_m=round(cd), duration_s=round(ct * factor), data_type="Estimated",
                                   source=f"Derived from {routes['car'][0].source} car time × {factor}",
                                   note=f"No two-wheeler routing available; car time × {factor} (an assumption). Not traffic-aware.")
            elif r is not None:
                d, t = r.legs[i]
                is_google = r.source == "Google Routes"
                est = ModeEstimate(mode=mode, distance_m=round(d), duration_s=round(t), data_type="Live", source=r.source,
                                   traffic_aware=is_google and traffic and mode in ("car", "scooter"),
                                   note=None if (is_google and traffic) or mode in ("walk", "cycle") else "Not traffic-aware")
            else:
                e = estimate_leg(a, b, mode if mode != "scooter" else "scooter")
                est = ModeEstimate(mode=mode, distance_m=e.distance_m, duration_s=e.duration_s, data_type="Estimated",
                                   source="Straight-line estimate", note="No routing provider answered")
            ok, why = suitability(mode, est.distance_m, a, b, zones)
            car_r = routes["car"][0]
            if mode in ("walk", "cycle") and car_r is not None and est.data_type == "Live" and est.distance_m > 2 * car_r.legs[i][0] + 300:
                why = ((why + " ") if why else "") + "This route is much longer than by road (map data may restrict paths here). Check in Google Maps."
            est.suitable = ok
            if why:
                est.note = f"{why} {est.note or ''}".strip()
            per_leg[i].append(est)

    legs: list[Leg] = []
    for i in range(n):
        a, b = points[i], points[i + 1]
        straight = haversine_m(a[0], a[1], b[0], b[1])
        # With a rented vehicle you ride anything beyond a short stroll; otherwise walk up to ~1.2 km.
        walk_limit = 500 if rental in ("two_wheeler", "car") else 1200
        main = "walk" if straight <= walk_limit else ("scooter" if rental == "two_wheeler" else "car")
        m = next(e for e in per_leg[i] if e.mode == main)
        legs.append(Leg(distance_m=m.distance_m, duration_s=m.duration_s, mode=main, modes=per_leg[i],
                        provenance=Provenance(source=m.source, data_type=m.data_type, last_checked=utcnow(), note=m.note)))

    totals = []
    for mode in MODES:
        es = [next(e for e in per_leg[i] if e.mode == mode) for i in range(n)]
        totals.append(ModeEstimate(
            mode=mode, distance_m=round(sum(e.distance_m for e in es)), duration_s=round(sum(e.duration_s for e in es)),
            data_type="Estimated" if any(e.data_type == "Estimated" for e in es) else "Live",
            source=es[0].source, traffic_aware=all(e.traffic_aware for e in es), suitable=all(e.suitable for e in es),
            note=" ".join(x for x in (
                next((e.note for e in es if e.note and e.suitable), None),
                None if all(e.suitable for e in es) else "Some legs are not suitable for this mode.",
            ) if x) or None,
        ))
    return legs, totals


def navigation_urls(points: list[tuple[float, float]]) -> dict[str, str]:
    return {m: maps_directions_url(points, m) for m in MODES} if len(points) >= 2 else {}


def elevation_gain(elevations: list[float]) -> float:
    """Sum of climbs, ignoring wobble under 1 m between samples (DEM noise)."""
    gain, last = 0.0, None
    for e in elevations:
        if e is None:
            continue
        if last is not None and e - last > 1:
            gain += e - last
            last = e
        elif last is None or e < last:
            last = e
    return round(gain)


def difficulty(mode: str, distance_m: float, gain_m: float | None) -> Difficulty:
    km = distance_m / 1000
    g = gain_m or 0
    limits = {  # (easy km, easy gain, moderate km, moderate gain)
        "walk": (3, 50, 8, 200),
        "cycle": (10, 100, 25, 400),
        "scooter": (30, 300, 70, 900),
        "car": (60, 500, 150, 1500),
    }[mode]
    if km <= limits[0] and g <= limits[1]:
        level = "Easy"
    elif km <= limits[2] and g <= limits[3]:
        level = "Moderate"
    else:
        level = "Hard"
    gain_txt = f", {round(g)} m climb" if gain_m is not None else ", climb unknown"
    return Difficulty(level=level, basis=f"Estimated from {km:.1f} km{gain_txt} for {mode}")


def _sample(geometry: list[tuple[float, float]], n: int = 80) -> list[int]:
    if len(geometry) <= n:
        return list(range(len(geometry)))
    step = (len(geometry) - 1) / (n - 1)
    return sorted({round(i * step) for i in range(n)})


async def build_trail(title: str, waypoints: list[TrailWaypoint], mode: str) -> tuple[TrailRoute | None, list[ProviderStatus]]:
    pts = [(w.lat, w.lng) for w in waypoints]
    r, statuses = await route(pts, mode)
    if not r or len(r.geometry) < 2:
        return None, statuses

    # Elevation: use the provider's 3D coordinates, else sample the line via Open-Meteo.
    idx = _sample(r.geometry)
    elevs: list[float] | None = None
    elev_source = None
    if r.elevations:
        elevs = [r.elevations[i] for i in idx]
        elev_source = r.source
    else:
        try:
            elevs = await registry.open_meteo().elevations([r.geometry[i] for i in idx])
            elev_source = "Open-Meteo elevation"
        except ProviderError as exc:
            statuses.append(ProviderStatus(provider="Open-Meteo elevation", state="error", message=str(exc)))

    profile = None
    gain = r.ascent_m
    if elevs and len(elevs) == len(idx):
        dist, profile = 0.0, []
        prev = None
        for k, i in enumerate(idx):
            p = r.geometry[i]
            if prev:
                dist += haversine_m(prev[0], prev[1], p[0], p[1])
            profile.append((round(dist), round(elevs[k], 1)))
            prev = p
        if gain is None:
            gain = elevation_gain(elevs)

    rid = hashlib.sha1(f"{mode}|{pts}".encode()).hexdigest()[:12]
    note = f"Elevation from {elev_source}" if elev_source else "Elevation not available"
    return TrailRoute(
        id=rid,
        title=title,
        mode=mode,
        waypoints=waypoints,
        geometry=[(round(a, 6), round(b, 6)) for a, b in r.geometry],
        distance_m=round(r.distance_m),
        duration_s=round(r.duration_s),
        elevation_gain_m=round(gain) if gain is not None else None,
        elevation_profile=profile,
        difficulty=difficulty(mode, r.distance_m, gain),
        navigation_url=maps_directions_url(pts, mode),
        navigation_urls=navigation_urls(pts),
        provenance=Provenance(source=r.source, data_type="Live", last_checked=utcnow(), note=f"Generated between real places, not an official trail. {note}."),
    ), statuses


# ---------- "Ride from here": loops from a rental shop through real places ----------

LOOP_TARGETS_KM = {"cycle": [5, 10, 18], "scooter": [12, 25, 40], "walk": [2, 4, 6], "car": [20, 40, 70]}


def plan_loop(start: tuple[float, float], places: list[tuple[str, float, float, str | None]], target_km: float, max_stops: int = 4) -> list[tuple[str, float, float, str | None]]:
    """Greedy loop: keep adding the nearest unvisited place while the straight-line loop
    (including the ride back) stays within target / detour factor."""
    budget = target_km * 1000 / DETOUR
    route: list[tuple[str, float, float, str | None]] = []
    cur, used = start, 0.0
    remaining = list(places)
    while remaining and len(route) < max_stops:
        remaining.sort(key=lambda p: (haversine_m(cur[0], cur[1], p[1], p[2]), p[0]))
        added = False
        for p in remaining:
            step = haversine_m(cur[0], cur[1], p[1], p[2])
            back = haversine_m(p[1], p[2], start[0], start[1])
            if used + step + back <= budget and step >= 150:
                route.append(p)
                used += step
                cur = (p[1], p[2])
                remaining.remove(p)
                added = True
                break
        if not added:
            break
    return route


async def ride_from(name: str, lat: float, lng: float, mode: str, places: list) -> tuple[list[TrailRoute], list[ProviderStatus]]:
    """Up to three Suggested routes of increasing length starting and ending at (lat, lng)."""
    statuses: list[ProviderStatus] = []
    pts = [(p.name, p.lat, p.lng, p.id) for p in places]
    trails: list[TrailRoute] = []
    seen: set[tuple] = set()
    for target in LOOP_TARGETS_KM[mode]:
        stops = plan_loop((lat, lng), pts, target)
        key = tuple(s[3] for s in stops)
        if not stops or key in seen:
            continue
        seen.add(key)
        wps = [TrailWaypoint(name=name, lat=lat, lng=lng)] + [TrailWaypoint(name=s[0], lat=s[1], lng=s[2], place_id=s[3]) for s in stops] + [TrailWaypoint(name=name, lat=lat, lng=lng)]
        trail, st = await build_trail(f"About {target} km loop from {name}", wps, mode)
        statuses.extend(st)
        if trail:
            trails.append(trail)
    return trails, statuses
