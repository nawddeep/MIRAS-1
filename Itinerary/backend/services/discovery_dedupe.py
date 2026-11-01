"""De-duplication of the same venue reported by several providers."""

from geo import same_place
from models.place import Place

PROVIDER_RANK = {"google": 0, "geoapify": 1, "osm": 2, "nominatim": 3}


def dedupe(places: list[Place]) -> list[Place]:
    """One entry per venue: by provider id, then by normalised name + coordinates.
    Google wins (ratings, a Maps listing); OSM-only fields like vehicle types are carried over."""
    ordered = sorted(places, key=lambda p: PROVIDER_RANK.get(p.provider, 9))
    kept: list[Place] = []
    seen_ids: set[str] = set()
    for p in ordered:
        if p.id in seen_ids:
            continue
        twin = next((k for k in kept if same_place(p.name, p.lat, p.lng, k.name, k.lat, k.lng)), None)
        if twin:
            if not twin.vehicle_types and p.vehicle_types:
                twin.vehicle_types = p.vehicle_types
            if not twin.wikidata and p.wikidata:
                twin.wikidata = p.wikidata
            continue
        seen_ids.add(p.id)
        kept.append(p)
    return kept
