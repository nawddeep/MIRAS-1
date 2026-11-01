"""Nominatim (OpenStreetMap) geocoding fallback.

Usage policy: max 1 request/second, an identifying User-Agent, results should be cached,
and autocomplete-as-you-type is NOT allowed. So this provider only serves explicit
searches (when the user presses Search), never keystroke autocomplete."""

from models.place import Suggestion
from integrations.base import Provider, ProviderNotConfigured


class Nominatim(Provider):
    name = "nominatim"
    label = "Nominatim (OpenStreetMap)"
    cache_ttl = 24 * 3600
    rate_per_second = 1
    burst = 1

    def configured(self) -> bool:
        return bool(self.settings.nominatim_user_agent)

    async def geocode(self, text: str) -> list[Suggestion]:
        if not self.configured():
            raise ProviderNotConfigured("Set NOMINATIM_USER_AGENT to use Nominatim")
        data = await self.request(
            "GET", "https://nominatim.openstreetmap.org/search",
            params={"q": text, "format": "jsonv2", "limit": 5, "addressdetails": 0},
            headers={"User-Agent": self.settings.nominatim_user_agent},
        )
        return [normalise(r) for r in data if r.get("lat")]


def normalise(r: dict) -> Suggestion:
    display = r.get("display_name", "")
    title = r.get("name") or display.split(",")[0]
    return Suggestion(
        id=f"nominatim:{r.get('osm_type', '')}{r.get('osm_id', '')}", provider="nominatim",
        title=title, subtitle=display, lat=float(r["lat"]), lng=float(r["lon"]),
    )
