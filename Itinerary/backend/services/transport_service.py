"""Origin → destination transport for the trip's first day, across flights, trains and buses."""

import asyncio
import re
from functools import lru_cache

from destinations import Destination
from integrations.base import gather_all
from integrations.buses.gtfs import GtfsBuses
from integrations.flights.providers import AviationstackSchedules, DuffelFlights, SerpApiFlights
from integrations.trains.providers import DataGovInTrains, QrailTrains
from models.common import ProviderStatus
from models.itinerary import TripRequest
from models.transport import FlightOption, TransportResults
from services import location_service

IATA = re.compile(r"^[A-Z]{3}$")


@lru_cache
def flight_providers() -> list:
    return [SerpApiFlights(), DuffelFlights(), AviationstackSchedules()]


@lru_cache
def train_providers() -> list:
    return [DataGovInTrains(), QrailTrains()]


@lru_cache
def bus_providers() -> list:
    return [GtfsBuses()]


def dedupe_flights(options: list[FlightOption]) -> list[FlightOption]:
    """Same flight number on the same departure from two sources: keep the Live offer."""
    rank = {"Live": 0, "Scheduled": 1, "Estimated": 2, "Historical": 3}
    seen: dict[tuple, FlightOption] = {}
    for o in sorted(options, key=lambda o: rank[o.provenance.data_type]):
        key = ((o.flight_number or o.id).replace(" ", "").upper(), (o.departure or "")[:16])
        seen.setdefault(key, o)
    return list(seen.values())


async def search(req: TripRequest, dest: Destination) -> tuple[TransportResults | None, list[ProviderStatus]]:
    if not req.origin:
        return None, []
    o = req.origin
    statuses: list[ProviderStatus] = []
    res = TransportResults(origin_label=o.label, destination_label=dest.name, date=req.start_date.isoformat())
    want = {"flight", "train", "bus"} if req.transport == "any" else {req.transport}

    async def flights():
        origin_code = (o.airport_code or "").upper() or None
        if not origin_code:
            airports, st = await location_service.nearest_airports(o.lat, o.lng)
            statuses.extend(st)
            origin_code = airports[0]["iata"] if airports else None
        dest_code = dest.airport_codes[0]
        res.origin_airport, res.destination_airport = origin_code, dest_code
        if not origin_code or not IATA.match(origin_code):
            res.notes.append("Could not find an airport code for your origin. Enter one (for example DEL) to see flights.")
            return
        if origin_code in dest.airport_codes:
            return
        results, st = await gather_all(
            flight_providers(),
            lambda p: p.search(origin_code, dest_code, req.start_date, req.adults, req.children, dest.currency),
        )
        statuses.extend(st)
        res.flights = dedupe_flights([f for _, items in results for f in items])

    async def trains():
        code = (o.station_code or "").upper()
        if not code:
            res.notes.append("Add your departure railway station code (for example NDLS) to see trains.")
            return
        results, st = await gather_all(train_providers(), lambda p: p.search(code, dest.railway_station_codes[0]))
        statuses.extend(st)
        res.trains = [t for _, items in results for t in items]

    async def buses():
        results, st = await gather_all(bus_providers(), lambda p: p.search((o.lat, o.lng), (dest.lat, dest.lng), req.start_date))
        statuses.extend(st)
        res.buses = [b for _, items in results for b in items]

    jobs = [f() for name, f in (("flight", flights), ("train", trains), ("bus", buses)) if name in want]
    await asyncio.gather(*jobs)
    return res, statuses
