"""Buses from an authorised GTFS (static) feed on disk. No scraping of booking sites.

Point GTFS_BUS_FEED_DIR at an unzipped feed (agency.txt, stops.txt, routes.txt,
trips.txt, stop_times.txt, calendar.txt and/or calendar_dates.txt). Results are
published timetables: labelled Scheduled."""

import asyncio
import csv
from datetime import date
from functools import lru_cache
from pathlib import Path

from geo import haversine_m
from models.common import Provenance, utcnow
from models.transport import BusOption
from integrations.base import Provider

NEAR_M = 3000
GTFS_ROUTE_TYPES = {"3": "Bus", "700": "Bus service", "200": "Coach", "202": "National coach", "204": "Regional coach"}


def _read(folder: Path, name: str) -> list[dict]:
    p = folder / name
    if not p.exists():
        return []
    with p.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


class Feed:
    def __init__(self, folder: Path):
        self.agency = {a.get("agency_id", ""): a for a in _read(folder, "agency.txt")}
        self.stops = {s["stop_id"]: s for s in _read(folder, "stops.txt") if s.get("stop_lat")}
        self.routes = {r["route_id"]: r for r in _read(folder, "routes.txt")}
        self.trips = {t["trip_id"]: t for t in _read(folder, "trips.txt")}
        self.calendar = {c["service_id"]: c for c in _read(folder, "calendar.txt")}
        self.calendar_dates: dict[str, dict[str, str]] = {}
        for cd in _read(folder, "calendar_dates.txt"):
            self.calendar_dates.setdefault(cd["service_id"], {})[cd["date"]] = cd["exception_type"]
        self.stop_times: dict[str, list[dict]] = {}
        for st in _read(folder, "stop_times.txt"):
            self.stop_times.setdefault(st["trip_id"], []).append(st)
        for v in self.stop_times.values():
            v.sort(key=lambda s: int(s["stop_sequence"]))

    def runs_on(self, service_id: str, d: date) -> bool:
        ymd = d.strftime("%Y%m%d")
        exc = self.calendar_dates.get(service_id, {}).get(ymd)
        if exc == "1":
            return True
        if exc == "2":
            return False
        c = self.calendar.get(service_id)
        if not c:
            return False
        day = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][d.weekday()]
        return c.get(day) == "1" and c["start_date"] <= ymd <= c["end_date"]

    def stops_near(self, lat: float, lng: float) -> set[str]:
        return {sid for sid, s in self.stops.items() if haversine_m(lat, lng, float(s["stop_lat"]), float(s["stop_lon"])) <= NEAR_M}


@lru_cache(maxsize=2)
def load_feed(folder: str) -> Feed:
    return Feed(Path(folder))


def _min(t: str) -> int:
    h, m, *_ = t.split(":")
    return int(h) * 60 + int(m)


def find_trips(feed: Feed, o: tuple[float, float], dst: tuple[float, float], d: date) -> list[BusOption]:
    origin_stops, dest_stops = feed.stops_near(*o), feed.stops_near(*dst)
    if not origin_stops or not dest_stops:
        return []
    now = utcnow()
    out = []
    for trip_id, times in feed.stop_times.items():
        trip = feed.trips.get(trip_id)
        if not trip or not feed.runs_on(trip["service_id"], d):
            continue
        board = next((s for s in times if s["stop_id"] in origin_stops and s.get("departure_time")), None)
        if not board:
            continue
        alight = next((s for s in times if s["stop_id"] in dest_stops and int(s["stop_sequence"]) > int(board["stop_sequence"]) and s.get("arrival_time")), None)
        if not alight:
            continue
        route = feed.routes.get(trip["route_id"], {})
        agency = feed.agency.get(route.get("agency_id", "")) or (next(iter(feed.agency.values())) if len(feed.agency) == 1 else {})
        dep, arr = board["departure_time"], alight["arrival_time"]
        out.append(BusOption(
            id=f"gtfs:{trip_id}",
            operator=agency.get("agency_name"),
            route_name=route.get("route_long_name") or route.get("route_short_name"),
            category=GTFS_ROUTE_TYPES.get(route.get("route_type", ""), "Bus"),
            from_stop=feed.stops[board["stop_id"]].get("stop_name"),
            to_stop=feed.stops[alight["stop_id"]].get("stop_name"),
            departure=dep[:5], arrival=arr[:5], duration_min=_min(arr) - _min(dep),
            fare=None,
            redirect_url=agency.get("agency_url") or route.get("route_url"),
            provenance=Provenance(source=f"GTFS feed: {agency.get('agency_name', 'operator')}", data_type="Scheduled", last_checked=now,
                                  note="Published timetable. No live availability or seats."),
        ))
    out.sort(key=lambda b: b.departure or "")
    return out[:20]


class GtfsBuses(Provider):
    name = "gtfs"
    label = "GTFS bus timetable"

    def configured(self) -> bool:
        return bool(self.settings.gtfs_bus_feed_dir) and Path(self.settings.gtfs_bus_feed_dir).is_dir()

    async def search(self, o: tuple[float, float], dst: tuple[float, float], d: date) -> list[BusOption]:
        self.require_configured()
        folder = self.settings.gtfs_bus_feed_dir
        return await asyncio.to_thread(lambda: find_trips(load_feed(folder), o, dst, d))
