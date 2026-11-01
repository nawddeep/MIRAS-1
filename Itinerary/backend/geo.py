import math
import re
from urllib.parse import urlencode


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def maps_search_url(name: str | None, lat: float, lng: float, google_place_id: str | None = None) -> str:
    """Google Maps URLs API (no key). With a place id it opens the listing; otherwise
    it searches near the coordinates."""
    if google_place_id:
        q = {"api": "1", "query": name or f"{lat},{lng}", "query_place_id": google_place_id}
    else:
        q = {"api": "1", "query": f"{lat:.6f},{lng:.6f}"}
    return "https://www.google.com/maps/search/?" + urlencode(q)


GMAPS_MODE = {"walk": "walking", "cycle": "bicycling", "scooter": "two-wheeler", "car": "driving"}


def maps_directions_url(points: list[tuple[float, float]], mode: str) -> str:
    """Directions through up to 9 intermediate waypoints (Maps URLs limit on mobile is 3, desktop 9)."""
    if len(points) < 2:
        raise ValueError("Need at least two points")
    origin, dest, mids = points[0], points[-1], points[1:-1][:9]
    q = {
        "api": "1",
        "origin": f"{origin[0]:.6f},{origin[1]:.6f}",
        "destination": f"{dest[0]:.6f},{dest[1]:.6f}",
        "travelmode": GMAPS_MODE.get(mode, "walking"),
    }
    if mids:
        q["waypoints"] = "|".join(f"{a:.6f},{b:.6f}" for a, b in mids)
    return "https://www.google.com/maps/dir/?" + urlencode(q)


_word = re.compile(r"[a-z0-9]+")
_STOP = {"the", "and", "of", "a", "shop", "store", "cafe", "restaurant", "hotel"}


def name_tokens(name: str) -> set[str]:
    words = [t for t in _word.findall(name.lower()) if not t.isdigit()]
    return {t for t in words if t not in _STOP} or set(words)


def same_place(name_a: str, lat_a: float, lng_a: float, name_b: str, lat_b: float, lng_b: float) -> bool:
    """Heuristic used to de-duplicate the same venue reported by two providers."""
    d = haversine_m(lat_a, lng_a, lat_b, lng_b)
    if d > 120:
        return False
    ta, tb = name_tokens(name_a), name_tokens(name_b)
    if not ta or not tb:
        return d < 15
    overlap = len(ta & tb) / min(len(ta), len(tb))
    return overlap >= 0.6 or (d < 15 and overlap >= 0.5)
