"""Flight providers.

- SerpApi Google Flights: date-specific offers with prices (Live).
- Duffel: date-specific airline offers (Live). Search only; we never create orders.
- Aviationstack: published future schedules (Scheduled). Never shown as availability."""

from datetime import date
from urllib.parse import quote

from models.common import Provenance, utcnow
from models.transport import FlightOption, FlightSegment, Money
from integrations.base import Provider


def google_flights_url(origin: str, dest: str, day: date) -> str:
    return "https://www.google.com/travel/flights?q=" + quote(f"Flights from {origin} to {dest} on {day.isoformat()} one way")


def _iso_duration_min(s: str | None) -> int | None:
    """Parses ISO-8601 durations like PT2H15M or P1DT1H."""
    if not s or not s.startswith("P"):
        return None
    import re
    m = re.fullmatch(r"P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?", s)
    if not m:
        return None
    d, h, mi = (int(x) if x else 0 for x in m.groups())
    return d * 1440 + h * 60 + mi


def normalise_serpapi(data: dict, currency: str) -> list[FlightOption]:
    now = utcnow()
    url = (data.get("search_metadata") or {}).get("google_flights_url")
    out = []
    for group in ("best_flights", "other_flights"):
        for i, it in enumerate(data.get(group) or []):
            legs = it.get("flights") or []
            if not legs:
                continue
            first, last = legs[0], legs[-1]
            airlines = list(dict.fromkeys(f.get("airline") for f in legs if f.get("airline")))
            out.append(FlightOption(
                id=f"serpapi:{group}:{i}",
                airline=" + ".join(airlines) or None,
                flight_number=", ".join(f["flight_number"] for f in legs if f.get("flight_number")) or None,
                departure=(first.get("departure_airport") or {}).get("time"),
                arrival=(last.get("arrival_airport") or {}).get("time"),
                duration_min=it.get("total_duration"),
                stops=len(legs) - 1,
                segments=[FlightSegment(
                    airline=f.get("airline"), flight_number=f.get("flight_number"),
                    from_airport=(f.get("departure_airport") or {}).get("id"), to_airport=(f.get("arrival_airport") or {}).get("id"),
                    departure=(f.get("departure_airport") or {}).get("time"), arrival=(f.get("arrival_airport") or {}).get("time"),
                    duration_min=f.get("duration"),
                ) for f in legs],
                price=Money(amount=float(it["price"]), currency=currency) if it.get("price") is not None else None,
                redirect_url=url,
                redirect_label="View on Google Flights",
                provenance=Provenance(source="Google Flights via SerpApi", data_type="Live", last_checked=now,
                                      note="Date-specific offer at the time of search. Prices change; confirm on the provider."),
            ))
    return out


def normalise_duffel(data: dict, origin: str, dest: str, day: date) -> list[FlightOption]:
    now = utcnow()
    out = []
    for offer in ((data.get("data") or {}).get("offers") or [])[:20]:
        sl = (offer.get("slices") or [{}])[0]
        segs = sl.get("segments") or []
        if not segs:
            continue
        carrier = lambda s: (s.get("marketing_carrier") or {})  # noqa: E731
        out.append(FlightOption(
            id=f"duffel:{offer.get('id')}",
            airline=(offer.get("owner") or {}).get("name"),
            flight_number=", ".join(f"{carrier(s).get('iata_code', '')}{s.get('marketing_carrier_flight_number', '')}" for s in segs),
            departure=segs[0].get("departing_at"),
            arrival=segs[-1].get("arriving_at"),
            duration_min=_iso_duration_min(sl.get("duration")),
            stops=len(segs) - 1,
            segments=[FlightSegment(
                airline=carrier(s).get("name"),
                flight_number=f"{carrier(s).get('iata_code', '')}{s.get('marketing_carrier_flight_number', '')}",
                from_airport=(s.get("origin") or {}).get("iata_code"), to_airport=(s.get("destination") or {}).get("iata_code"),
                departure=s.get("departing_at"), arrival=s.get("arriving_at"), duration_min=_iso_duration_min(s.get("duration")),
            ) for s in segs],
            price=Money(amount=float(offer["total_amount"]), currency=offer["total_currency"]) if offer.get("total_amount") else None,
            redirect_url=google_flights_url(origin, dest, day),
            redirect_label="Compare on Google Flights",
            provenance=Provenance(source="Duffel", data_type="Live", last_checked=now,
                                  note="Airline offer at the time of search (total for all passengers). This app does not book."),
        ))
    return out


def normalise_aviationstack(data: dict, dest: str, origin: str, day: date) -> list[FlightOption]:
    now = utcnow()
    out = []
    for i, f in enumerate(data.get("data") or []):
        arr, dep = f.get("arrival") or {}, f.get("departure") or {}
        if (arr.get("iataCode") or "").upper() != dest or f.get("codeshared"):
            continue
        airline = (f.get("airline") or {}).get("name")
        number = (f.get("flight") or {}).get("iataNumber") or (f.get("flight") or {}).get("number")
        out.append(FlightOption(
            id=f"aviationstack:{number or i}",
            airline=airline, flight_number=number,
            departure=f"{day.isoformat()} {dep.get('scheduledTime')}" if dep.get("scheduledTime") else None,
            arrival=arr.get("scheduledTime"),
            stops=0,
            redirect_url=google_flights_url(origin, dest, day),
            redirect_label="Check fares on Google Flights",
            provenance=Provenance(source="Aviationstack", data_type="Scheduled", last_checked=now,
                                  note="Published schedule only. Not confirmed availability and no fare."),
        ))
    return out


class SerpApiFlights(Provider):
    name = "serpapi"
    label = "SerpApi (Google Flights)"
    cache_ttl = 15 * 60
    rate_per_second = 1

    def configured(self) -> bool:
        return bool(self.settings.serpapi_api_key)

    async def search(self, origin: str, dest: str, day: date, adults: int, children: int, currency: str) -> list[FlightOption]:
        self.require_configured()
        data = await self.request("GET", "https://serpapi.com/search.json", params={
            "engine": "google_flights", "departure_id": origin, "arrival_id": dest,
            "outbound_date": day.isoformat(), "type": "2", "currency": currency, "hl": "en", "gl": "in",
            "adults": adults, "children": children, "api_key": self.settings.serpapi_api_key,
        })
        if data.get("error"):
            from integrations.base import ProviderError
            raise ProviderError(f"SerpApi: {data['error']}")
        return normalise_serpapi(data, currency)


class DuffelFlights(Provider):
    name = "duffel"
    label = "Duffel"
    rate_per_second = 1

    def configured(self) -> bool:
        return bool(self.settings.duffel_api_key)

    async def search(self, origin: str, dest: str, day: date, adults: int, children: int, currency: str) -> list[FlightOption]:
        self.require_configured()
        passengers = [{"type": "adult"}] * adults + [{"age": 10}] * children
        data = await self.request(
            "POST", "https://api.duffel.com/air/offer_requests",
            params={"return_offers": "true"},
            json_body={"data": {"slices": [{"origin": origin, "destination": dest, "departure_date": day.isoformat()}],
                                "passengers": passengers, "cabin_class": "economy"}},
            headers={"Authorization": f"Bearer {self.settings.duffel_api_key}", "Duffel-Version": "v2", "Accept": "application/json"},
        )
        return normalise_duffel(data, origin, dest, day)


class AviationstackSchedules(Provider):
    name = "aviationstack"
    label = "Aviationstack"
    cache_ttl = 6 * 3600
    rate_per_second = 1

    def configured(self) -> bool:
        return bool(self.settings.aviationstack_api_key)

    async def search(self, origin: str, dest: str, day: date, adults: int, children: int, currency: str) -> list[FlightOption]:
        """Future schedules (paid plans). On plans without them, falls back to today's published
        flights on this route, clearly labelled as a reference schedule for a different date."""
        self.require_configured()
        from integrations.base import ProviderError
        data = await self.request("GET", "https://api.aviationstack.com/v1/flightsFuture", params={
            "access_key": self.settings.aviationstack_api_key, "iataCode": origin, "type": "departure", "date": day.isoformat(),
        })
        if not data.get("error"):
            return normalise_aviationstack(data, dest, origin, day)
        today = await self.request("GET", "https://api.aviationstack.com/v1/flights", params={
            "access_key": self.settings.aviationstack_api_key, "dep_iata": origin, "arr_iata": dest, "limit": 50,
        })
        if today.get("error"):
            raise ProviderError(f"Aviationstack: {(today['error'] or {}).get('message') or today['error']}")
        return normalise_aviationstack_today(today, origin, dest, day)


def normalise_aviationstack_today(data: dict, origin: str, dest: str, day: date) -> list[FlightOption]:
    """Today's flights on the route, as a reference for which airlines and times operate it."""
    now = utcnow()
    seen, out = set(), []
    for f in data.get("data") or []:
        dep, arr, fl = f.get("departure") or {}, f.get("arrival") or {}, f.get("flight") or {}
        if (arr.get("iata") or "").upper() != dest or fl.get("codeshared"):
            continue
        number = fl.get("iata") or fl.get("number")
        if not number or number in seen:
            continue
        seen.add(number)
        hhmm = lambda s: s[11:16] if s and len(s) >= 16 else None  # noqa: E731
        out.append(FlightOption(
            id=f"aviationstack-today:{number}", airline=(f.get("airline") or {}).get("name"), flight_number=number,
            departure=hhmm(dep.get("scheduled")), arrival=hhmm(arr.get("scheduled")), stops=0,
            redirect_url=google_flights_url(origin, dest, day), redirect_label="Check fares on Google Flights",
            provenance=Provenance(source="Aviationstack (today's flights)", data_type="Scheduled", last_checked=now,
                                  note=f"Published schedule for {f.get('flight_date', 'today')}, shown as a reference for your date. Not confirmed availability and no fare."),
        ))
    return sorted(out, key=lambda o: o.departure or "")
