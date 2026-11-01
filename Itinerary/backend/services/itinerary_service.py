"""Builds a full trip from live provider data. Scoring, grouping and timing live in
itinerary_engine (pure); this module fetches the inputs and assembles the result.

Variety: each day is centred on a different area of the city (destination config), places
already used anywhere in the trip are excluded, and several queries/pages per interest are
merged before ranking. If too few good places are found, the search widens step by step and
the day says what changed."""

import asyncio
from datetime import date, timedelta

from catalog import BEFORE_YOU_RENT, INTERESTS, RENTAL_GROUPS, Spec
from config import get_settings
from destinations import AreaDef, Destination, get_destination
from geo import haversine_m
from integrations import registry
from integrations.base import ProviderError
from models.common import ProviderStatus
from models.itinerary import (
    Area, Block, BudgetLine, BudgetSummary, Day, Essentials, Itinerary, Leg, LatLngPoint, ModeEstimate, RentalSection,
    TrailRoute, TrailWaypoint, TripRequest,
)
from models.place import Place
from models.weather import DailyWeather
from services import discovery_service, routing_service, search_service, transport_service
from services.discovery_dedupe import dedupe
from services.itinerary_engine import (
    MEAL_MINUTES, PACE_BUFFER, PACE_SLOTS, Candidate, budget_fit, layout, new_id,
    order_nearest, pick_day, pick_evening, score, split_parts, visit_minutes,
)

STAY_QUERY = {"hotel": "hotel", "hostel": "hostel", "homestay": "homestay", "heritage": "heritage hotel"}
STAY_GEOAPIFY = {
    "hotel": ["accommodation.hotel"], "hostel": ["accommodation.hostel"],
    "homestay": ["accommodation.guest_house"], "heritage": ["accommodation.hotel"],
}
NOT_SIGHTS = {"lodging", "hotel", "hospital", "pharmacy", "accommodation.hotel", "healthcare.hospital"}


def merge_status(statuses: list[ProviderStatus]) -> list[ProviderStatus]:
    """One row per provider; an "ok" anywhere wins, otherwise keep the first problem."""
    best: dict[str, ProviderStatus] = {}
    for s in statuses:
        cur = best.get(s.provider)
        if cur is None or (s.state == "ok" and cur.state != "ok"):
            best[s.provider] = s
    return list(best.values())


# ---------- Areas ----------

def choose_areas(dest: Destination, req: TripRequest) -> list[AreaDef]:
    """A different area per day, best interest match first (config order breaks ties)."""
    ranked = sorted(dest.areas, key=lambda a: -len(set(a.good_for) & set(req.interests)))
    return [ranked[i % len(ranked)] for i in range(req.days)]


def area_model(a: AreaDef) -> Area:
    return Area(id=a.id, name=a.name, lat=a.lat, lng=a.lng)


def search_steps(req: TripRequest) -> list[tuple[int, float, int, str | None]]:
    """(radius, min rating, min reviews, note). Each step is used only if the previous found too few places."""
    s = get_settings()
    base = int(s.day_radius_m * (1.6 if req.rental in ("two_wheeler", "car") else 1))
    return [
        (base, s.min_rating, s.min_reviews, None),
        (int(base * 1.8), s.min_rating, s.min_reviews, f"Widened the search to {base * 1.8 / 1000:.1f} km: too few matching places nearby."),
        (int(base * 3), s.min_rating, s.min_reviews, f"Widened the search to {base * 3 / 1000:.1f} km."),
        (int(base * 3), max(3.5, s.min_rating - 0.3), max(5, s.min_reviews // 2),
         f"Relaxed quality filters to {max(3.5, s.min_rating - 0.3):.1f}★ and {max(5, s.min_reviews // 2)}+ reviews: not enough places passed the stricter ones."),
    ]


# ---------- Inputs ----------

async def day_candidates(
    req: TripRequest, area: AreaDef, weather: str | None, exclude: set[str], statuses: list[ProviderStatus],
    interests: list[str] | None = None, needed: int | None = None, tag: str = "",
) -> tuple[list[Candidate], list[str]]:
    interests = interests or list(req.interests)
    needed = needed or (sum(PACE_SLOTS[req.pace].values()) + 2)
    notes: list[str] = []
    cands: list[Candidate] = []
    for radius, min_rating, min_reviews, note in search_steps(req):
        results = await asyncio.gather(*(
            search_service.fetch(INTERESTS[i], area.lat, area.lng, radius, statuses, with_hours=True, tag=f"{tag} {i}".strip())
            for i in interests
        ))
        by_id: dict[str, tuple[Place, set[str]]] = {}
        for interest, places in zip(interests, results):
            for p in search_service.filter_quality(places, min_rating, min_reviews, tag=f"{tag} {interest}".strip()):
                by_id.setdefault(p.id, (p, set()))[1].add(interest)
        unique = dedupe([p for p, _ in by_id.values()])
        missing = [i for i in interests if not any(i in m for _, m in by_id.values())]
        cands = []
        for p in unique:
            if p.id in exclude or set(p.types) & NOT_SIGHTS:
                continue
            matched = by_id[p.id][1]
            sc, reasons = score(p, matched, req, (area.lat, area.lng), area.name, weather)
            cands.append(Candidate(p, matched, sc, reasons))
        if note:
            notes.append(note)
        if len(cands) >= needed:
            break
    if len(cands) < needed:
        notes.append(f"Only {len(cands)} places passed the filters around {area.name}. The day has fewer stops rather than weaker picks.")
    for i in missing:
        notes.append(f"No places matching {INTERESTS[i].label} were found around {area.name}"
                     + ("" if registry.google_places().configured() else " in OpenStreetMap data (Google Places, which covers activities better, isn't configured)") + ".")
    search_service.record(tag=tag, step="ranked", area=area.name,
                          top=[{"name": c.place.name, "score": c.score, "reasons": c.place.score_reasons} for c in sorted(cands, key=lambda c: -c.score)[:12]])
    return cands, notes


async def day_meals(req: TripRequest, area: AreaDef, exclude: set[str], statuses: list[ProviderStatus], tag: str = "") -> list[Place]:
    spec = INTERESTS["food"]
    for radius, min_rating, min_reviews, _ in search_steps(req):
        places = await search_service.fetch(spec, area.lat, area.lng, radius, statuses, with_hours=True, tag=f"{tag} meals".strip())
        places = [p for p in search_service.filter_quality(places, min_rating, min_reviews, tag=f"{tag} meals".strip())
                  if p.id not in exclude and budget_fit(p, req.budget_tier) > -1]
        if len(places) >= 4:
            break
    for p in places:
        sc, reasons = score(p, {"food"}, req, (area.lat, area.lng), area.name)
        p.score, p.score_reasons = sc, reasons
    return sorted(places, key=lambda p: -(p.score or 0))


async def collect_stays(req: TripRequest, dest: Destination, statuses: list[ProviderStatus]) -> list[Place]:
    if not req.stay_type:
        return []
    spec = Spec(key="stays", label="Stays", queries=[STAY_QUERY[req.stay_type]], geoapify=STAY_GEOAPIFY[req.stay_type])
    places = await search_service.fetch(spec, dest.lat, dest.lng, dest.search_radius_m, statuses, pages=1, tag="stays")
    places = [p for p in places if search_service.quality_ok(p, 3.8, 10)[0]]
    places.sort(key=lambda p: (-(budget_fit(p, req.budget_tier)), -(p.rating or 0)))
    return places[:6]


async def fetch_weather(req: TripRequest, dest: Destination, statuses: list[ProviderStatus]) -> dict[date, DailyWeather]:
    end = req.start_date + timedelta(days=req.days - 1)
    try:
        rep = await registry.open_meteo().report(dest.lat, dest.lng, req.start_date, end, dest.timezone)
    except ProviderError as exc:
        statuses.append(ProviderStatus(provider="Open-Meteo", state="error", message=str(exc)))
        return {}
    statuses.append(ProviderStatus(provider="Open-Meteo", state="ok"))
    return {d.date: d for d in rep.daily}


async def collect_essentials(dest: Destination, statuses: list[ProviderStatus]) -> Essentials:
    try:
        page, st = await discovery_service.nearby(dest.lat, dest.lng, 6000, "health", None)
        statuses.extend(st)
        places = page.places
    except Exception as exc:  # essentials must never break the trip
        statuses.append(ProviderStatus(provider="Essentials lookup", state="error", message=str(exc)))
        places = []
    is_pharmacy = lambda p: "pharmacy" in p.types or "healthcare.pharmacy" in p.types or "drugstore" in p.types  # noqa: E731
    return Essentials(
        emergency=dest.emergency, emergency_source=dest.emergency_source,
        hospitals=[p for p in places if not is_pharmacy(p)][:3],
        pharmacies=[p for p in places if is_pharmacy(p)][:3],
        documents=dest.documents, money_notes=dest.money_notes,
    )


def rental_section(req: TripRequest, dest: Destination, first_area: AreaDef) -> RentalSection | None:
    if req.rental == "none":
        return None
    group = req.rental if req.rental in RENTAL_GROUPS else "unsure"
    arrival = dest.arrival_points.get(req.transport) or dest.arrival_points["train"]
    label = arrival.name + ("" if req.transport in dest.arrival_points else " (central arrival point)")
    return RentalSection(
        choice=req.rental, group=group, arrival_label=label, arrival=LatLngPoint(lat=arrival.lat, lng=arrival.lng),
        stay_label=f"{first_area.name} (day 1 area)", stay=LatLngPoint(lat=first_area.lat, lng=first_area.lng), advice=BEFORE_YOU_RENT,
    )


# ---------- Day building ----------

def _visit_block(c: Candidate, part: str) -> Block:
    return Block(
        id=new_id(), kind="visit", part=part, duration_min=visit_minutes(c.matched), title=c.place.name, place=c.place,
        indoor=c.indoor, reason=" · ".join(c.place.score_reasons[:3]) or None, interests=sorted(c.matched),
    )


def _meal_block(meal: str, near: tuple[float, float], meals: list[Place], used: set[str]) -> Block:
    options = [m for m in meals if m.id not in used]
    title = "Lunch" if meal == "lunch" else "Dinner"
    part = "afternoon" if meal == "lunch" else "evening"
    if not options:
        return Block(id=new_id(), kind="meal", meal=meal, part=part, duration_min=MEAL_MINUTES[meal],
                     title=f"{title}: choose a place nearby", reason="No restaurant passed the filters for this area.")
    # Closest of the better-ranked options: rank 0..n with distance in km as the main factor.
    pick = min(options, key=lambda m: (haversine_m(near[0], near[1], m.lat, m.lng) / 1000 - (m.score or 0) * 0.3, m.id))
    used.add(pick.id)
    return Block(id=new_id(), kind="meal", meal=meal, part=part, duration_min=MEAL_MINUTES[meal], title=f"{title} at {pick.name}",
                 place=pick, indoor=True, interests=["food"], reason=" · ".join(pick.score_reasons[:2]) or None)


def plan_blocks(
    pool: list[Candidate], req: TripRequest, weather: DailyWeather | None, anchor: tuple[float, float],
    meals: list[Place], used: set[str],
) -> tuple[list[Block], set[str]]:
    """Choose and order one day's stops (no timing yet). `used` holds every place id already in the
    trip; the ids picked here are added to it and also returned."""
    slots = PACE_SLOTS[req.pace]
    w = weather.suggestion if weather else None
    pool = [c for c in pool if c.place.id not in used]
    spread = 3000 if req.rental in ("two_wheeler", "car") else 1500  # a vehicle makes farther stops reasonable
    day = pick_day(pool, slots["morning"] + slots["afternoon"], w, get_settings().hidden_gem_share, spread)
    picked = {c.place.id for c in day}
    ordered = order_nearest(day, anchor)
    morning, afternoon = split_parts(ordered, req.pace, w)
    last = morning[-1].pos if morning else anchor
    evening = pick_evening([c for c in pool if c.place.id not in picked], afternoon[-1].pos if afternoon else last)
    if evening:
        picked.add(evening.place.id)
    taken = used | picked
    blocks: list[Block] = [_visit_block(c, "morning") for c in morning]
    blocks.append(_meal_block("lunch", last, meals, taken))
    blocks.append(Block(id=new_id(), kind="buffer", part="afternoon", duration_min=PACE_BUFFER[req.pace],
                        title="Buffer: rest, travel slack or a café break"))
    blocks += [_visit_block(c, "afternoon") for c in afternoon]
    if evening:
        blocks.append(_visit_block(evening, "evening"))
    end = evening.pos if evening else (afternoon[-1].pos if afternoon else last)
    blocks.append(_meal_block("dinner", end, meals, taken))
    picked |= {b.place.id for b in blocks if b.place}
    used |= picked
    return blocks, picked


async def time_day(blocks: list[Block], d: date, req: TripRequest, anchor: tuple[float, float], zones=()) -> tuple[list[Block], list, dict]:
    """Route between consecutive stops for every mode, then lay the day out on the clock."""
    pts: list[tuple[float, float]] = [anchor]
    targets: list[int] = []
    for i, b in enumerate(blocks):
        if b.place and not b.auto:
            pts.append((b.place.lat, b.place.lng))
            targets.append(i)
    legs, totals = await routing_service.mode_legs(pts, req.rental, zones)
    per_block: list[Leg | None] = [None] * len(blocks)
    for leg, i in zip(legs, targets):
        per_block[i] = leg
    return layout(blocks, per_block, d, req.pace), totals, routing_service.navigation_urls(pts[:11])


async def walking_trail(blocks: list[Block], statuses: list[ProviderStatus]) -> TrailRoute | None:
    """The longest run of stops joined by walking legs becomes a walking trail card.
    Its per-mode times are the sum of the day's legs, so no extra routing calls are needed."""
    runs: list[list[Block]] = []
    cur: list[Block] = []
    for b in blocks:
        if not b.place:
            continue
        if cur and b.leg_from_previous and b.leg_from_previous.mode == "walk":
            cur.append(b)
        else:
            if len(cur) >= 2:
                runs.append(cur)
            cur = [b]
    if len(cur) >= 2:
        runs.append(cur)
    runs = [r for r in runs if len(r) >= 3 or sum(b.leg_from_previous.distance_m for b in r[1:]) >= 700]
    if not runs:
        return None
    best = max(runs, key=len)
    wps = [TrailWaypoint(name=b.place.name, lat=b.place.lat, lng=b.place.lng, place_id=b.place.id) for b in best]
    trail, st = await routing_service.build_trail(f"Walk: {wps[0].name} to {wps[-1].name}", wps, "walk")
    statuses.extend(st)
    if trail:
        sums = []
        for mode in routing_service.MODES:
            es = [next(e for e in b.leg_from_previous.modes if e.mode == mode) for b in best[1:] if b.leg_from_previous and b.leg_from_previous.modes]
            if es:
                sums.append(ModeEstimate(mode=mode, distance_m=sum(e.distance_m for e in es), duration_s=sum(e.duration_s for e in es),
                                         data_type="Estimated" if any(e.data_type == "Estimated" for e in es) else "Live",
                                         source=es[0].source, suitable=all(e.suitable for e in es), note=next((e.note for e in es if e.note), None)))
        trail.mode_estimates = sums
    return trail


def weather_note(w: DailyWeather | None) -> str | None:
    if not w:
        return "No weather data for this date."
    return {
        "indoor": "Rain is likely, so indoor places come first.",
        "mixed": "Hot or showery: outdoor stops are in the morning, indoor ones in the afternoon.",
        "outdoor": "Good weather for outdoor stops.",
    }[w.suggestion]


async def build_day(
    index: int, req: TripRequest, dest: Destination, area: AreaDef, weather: dict[date, DailyWeather],
    used: set[str], statuses: list[ProviderStatus], avoid: set[str] | None = None,
) -> Day:
    """`used`: places in the trip (never reused). `avoid`: places seen before, used only if nothing else is left."""
    d = req.start_date + timedelta(days=index)
    w = weather.get(d)
    tag = f"day {index + 1}"
    exclude = used | (avoid or set())
    (pool, notes), meals = await asyncio.gather(
        day_candidates(req, area, w.suggestion if w else None, exclude, statuses, tag=tag),
        day_meals(req, area, exclude, statuses, tag=tag),
    )
    if avoid and len(pool) < sum(PACE_SLOTS[req.pace].values()):
        (pool, notes), meals = await asyncio.gather(
            day_candidates(req, area, w.suggestion if w else None, used, statuses, tag=tag),
            day_meals(req, area, used, statuses, tag=tag),
        )
        notes.append("Ran out of new places here, so some earlier suggestions may come back.")
    anchor = (area.lat, area.lng)
    blocks, _ = plan_blocks(pool, req, w, anchor, meals, used)
    blocks, totals, nav = await time_day(blocks, d, req, anchor, dest.narrow_lane_zones)
    trail = await walking_trail(blocks, statuses)
    return Day(index=index, date=d, area=area_model(area), weather=w, weather_note=weather_note(w), blocks=blocks,
               trails=[trail] if trail else [], mode_totals=totals, navigation_urls=nav, search_notes=notes)


# ---------- Budget ----------

def budget_summary(req: TripRequest, days: list[Day], transport) -> BudgetSummary:
    lines: list[BudgetLine] = []
    notes: list[str] = []
    travellers = req.adults + req.children

    meal_blocks = [b for d in days for b in d.blocks if b.kind == "meal"]
    priced = [b.place.price_range for b in meal_blocks if b.place and b.place.price_range and b.place.price_range.currency == "INR"]
    if priced:
        lo = sum(p.min or 0 for p in priced)
        hi = sum(p.max or p.min or 0 for p in priced)
        lines.append(BudgetLine(
            label=f"Meals with published price ranges ({len(priced)} of {len(meal_blocks)}), for {travellers} traveller(s)",
            amount_min=lo * travellers, amount_max=hi * travellers if hi else None,
            basis="Sum of Google price ranges per person × travellers", data_type="Live",
        ))
    if len(priced) < len(meal_blocks):
        notes.append(f"{len(meal_blocks) - len(priced)} meal stop(s) have no price data, so they are not included.")

    if transport:
        for kind, items in (("Flights", transport.flights), ("Trains", transport.trains), ("Buses", transport.buses)):
            prices = [(o.price if kind == "Flights" else o.fare) for o in items]
            prices = [p for p in prices if p and p.currency == "INR"]
            if prices:
                src = items[0].provenance
                lines.append(BudgetLine(
                    label=f"{kind}: one way, lowest to highest listed",
                    amount_min=min(p.amount for p in prices), amount_max=max(p.amount for p in prices),
                    basis=f"Fares returned by {src.source}. Check whether the fare is per person or total on the provider.",
                    data_type=src.data_type,
                ))
    notes.append("Entry tickets, stay prices and rental rates are not available from our data providers. Check them with the place directly.")
    if req.budget_min_per_day is not None or req.budget_max_per_day is not None:
        lines.append(BudgetLine(
            label="Your daily budget", amount_min=req.budget_min_per_day, amount_max=req.budget_max_per_day,
            basis="Entered by you", data_type="User",
        ))
    return BudgetSummary(
        lines=lines,
        user_range_per_day=(req.budget_min_per_day, req.budget_max_per_day) if (req.budget_min_per_day or req.budget_max_per_day) else None,
        notes=notes,
    )


# ---------- Entry points ----------

async def generate(req: TripRequest) -> Itinerary:
    dest = get_destination(req.destination_id)
    statuses: list[ProviderStatus] = []
    areas = choose_areas(dest, req)

    async def transport():
        if not req.origin:
            return None
        try:
            res, st = await transport_service.search(req, dest)
            statuses.extend(st)
            return res
        except Exception as exc:
            statuses.append(ProviderStatus(provider="Transport", state="error", message=str(exc)))
            return None

    weather, stays, essentials, trans = await asyncio.gather(
        fetch_weather(req, dest, statuses), collect_stays(req, dest, statuses), collect_essentials(dest, statuses), transport(),
    )
    rentals = rental_section(req, dest, areas[0])
    used: set[str] = set()
    days: list[Day] = []
    for i in range(req.days):
        days.append(await build_day(i, req, dest, areas[i], weather, used, statuses))

    return Itinerary(
        request=req, destination_name=dest.name, days=days, stays=stays, transport=trans,
        budget=budget_summary(req, days, trans), essentials=essentials, rentals=rentals, providers=merge_status(statuses),
    )


async def regenerate_day(
    req: TripRequest, index: int, other_day_ids: set[str], seen_ids: set[str], area_id: str | None = None,
) -> tuple[Day, list[ProviderStatus]]:
    """Rebuild one day with different places: other days' places are never reused, and places the
    traveller has already been shown for this day are avoided while alternatives exist."""
    if not 0 <= index < req.days:
        raise ValueError("Day index out of range")
    dest = get_destination(req.destination_id)
    statuses: list[ProviderStatus] = []
    areas = choose_areas(dest, req)
    area = next((a for a in dest.areas if a.id == area_id), areas[index])
    weather = await fetch_weather(req, dest, statuses)
    day = await build_day(index, req, dest, area, weather, set(other_day_ids), statuses, avoid=set(seen_ids))
    return day, merge_status(statuses)


async def alternative_for_block(
    req: TripRequest, day: Day, block_id: str, exclude_ids: set[str],
) -> tuple[Day, list[ProviderStatus]]:
    """Swap one stop for the next-best place serving the same interests in the same area."""
    dest = get_destination(req.destination_id)
    statuses: list[ProviderStatus] = []
    blocks = [b for b in day.blocks if not b.auto]
    idx = next((i for i, b in enumerate(blocks) if b.id == block_id), None)
    if idx is None:
        raise ValueError("Unknown stop")
    target = blocks[idx]
    area_def = next((a for a in dest.areas if day.area and a.id == day.area.id), choose_areas(dest, req)[day.index % len(dest.areas)])
    prev = next((b.place for b in reversed(blocks[:idx]) if b.place), None)
    near = (prev.lat, prev.lng) if prev else (area_def.lat, area_def.lng)
    if target.kind == "meal":
        meals = await day_meals(req, area_def, exclude_ids, statuses, tag="swap")
        new = _meal_block(target.meal or "lunch", near, meals, set(exclude_ids))
        new.id = target.id
    elif target.kind == "visit":
        interests = [i for i in target.interests if i in INTERESTS] or list(req.interests)
        pool, notes = await day_candidates(req, area_def, day.weather.suggestion if day.weather else None, exclude_ids,
                                           statuses, interests=interests, needed=1, tag="swap")
        if not pool:
            raise LookupError("No other places matching this stop were found nearby.")
        best = max(pool, key=lambda c: (c.score - haversine_m(near[0], near[1], c.place.lat, c.place.lng) / 1500, c.place.id))
        new = _visit_block(best, target.part)
        new.id = target.id
    else:
        raise ValueError("Only visits and meals can be swapped")
    blocks[idx] = new
    out = await relayout_day(req, day.model_copy(update={"blocks": blocks}))
    return out, merge_status(statuses)


async def relayout_day(req: TripRequest, day: Day) -> Day:
    """Re-route and re-time a day after the traveller added, removed, swapped or reordered stops."""
    dest = get_destination(req.destination_id)
    statuses: list[ProviderStatus] = []
    anchor = (day.area.lat, day.area.lng) if day.area else (dest.lat, dest.lng)
    blocks = [b for b in day.blocks if not b.auto]
    blocks, totals, nav = await time_day(blocks, day.date, req, anchor, dest.narrow_lane_zones)
    trail = await walking_trail(blocks, statuses)
    return day.model_copy(update={"blocks": blocks, "trails": [trail] if trail else [], "mode_totals": totals, "navigation_urls": nav})

