"""Pure itinerary logic, no network calls: scoring, grouping stops by proximity,
opening-hours checks and laying blocks out on a timeline. Tested directly."""

import math
import uuid
from datetime import date

from geo import haversine_m
from models.itinerary import Block, Leg, TripRequest
from models.place import Place
from catalog import INTERESTS

# Visits per day part, by pace.
PACE_SLOTS = {
    "relaxed": {"morning": 1, "afternoon": 1, "evening": 1},
    "balanced": {"morning": 2, "afternoon": 1, "evening": 1},
    "packed": {"morning": 2, "afternoon": 2, "evening": 1},
}
PACE_START = {"relaxed": "09:30", "balanced": "09:00", "packed": "08:30"}
PACE_BUFFER = {"relaxed": 45, "balanced": 30, "packed": 15}
LUNCH_EARLIEST, DINNER_EARLIEST, EVENING_EARLIEST = 12 * 60 + 30, 19 * 60 + 30, 17 * 60
MEAL_MINUTES = {"lunch": 60, "dinner": 75}

PRICE_LEVEL = {
    "PRICE_LEVEL_FREE": 0, "PRICE_LEVEL_INEXPENSIVE": 1, "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3, "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}
EVENING_INTERESTS = {"nightlife", "photography", "food"}


def new_id() -> str:
    return uuid.uuid4().hex[:10]


def to_min(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def to_hhmm(minutes: int) -> str:
    minutes = max(0, min(minutes, 24 * 60 - 1))
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def round_up_5(minutes: float) -> int:
    return int(math.ceil(minutes / 5) * 5)


# ---------- Scoring ----------

def budget_fit(place: Place, tier: str) -> float:
    level = PRICE_LEVEL.get(place.price_level or "")
    if level is None:
        return 0.0
    if tier == "budget":
        return -1.2 if level >= 3 else (0.2 if level <= 1 else 0.0)
    if tier == "mid":
        return -0.6 if level == 4 else 0.0
    return 0.3 if level >= 3 else 0.0  # premium


BAYES_M, BAYES_PRIOR = 50, 4.0  # a place needs ~50 reviews before its own rating dominates


def bayes_rating(p: Place) -> float | None:
    if p.rating is None:
        return None
    v = p.rating_count or 0
    return (v * p.rating + BAYES_M * BAYES_PRIOR) / (v + BAYES_M)


def quality(p: Place) -> tuple[float, str]:
    """0..1 quality and a reason. Google: Bayesian rating. OSM: how well documented the place is."""
    br = bayes_rating(p)
    if br is not None:
        q = max(0.0, min(1.0, (br - 3.5) / 1.4))
        return q, f"{p.rating:.1f}★ from {(p.rating_count or 0):,} Google reviews"
    q = 0.35 + (0.3 if p.wikidata else 0) + (0.1 if p.website else 0) + (0.1 if p.opening_hours else 0) + (0.05 if p.phone else 0)
    bits = [b for b, ok in (("Wikidata entry", p.wikidata), ("website", p.website), ("opening hours", p.opening_hours)) if ok]
    return min(q, 1.0), "No rating (OpenStreetMap)" + (f"; has {', '.join(bits)}" if bits else "")


def hidden_gem(p: Place) -> bool:
    if p.provider == "google":
        return (p.rating or 0) >= 4.3 and 20 <= (p.rating_count or 0) <= 600 and p.primary_type != "tourist_attraction"
    # OSM has no reviews: "lesser-known" = not famous (no Wikidata/brand) but documented (website, hours or phone).
    return (not p.wikidata and not any(t.startswith("tourism.attraction") for t in p.types)
            and bool(p.website or p.opening_hours or p.phone))


def score(
    place: Place, matched: set[str], req: TripRequest, anchor: tuple[float, float],
    area_name: str = "the day's area", weather: str | None = None,
) -> tuple[float, list[str]]:
    """Transparent score: 2×quality + interest match + budget fit + weather fit − 0.15 per km from the day's area."""
    q, q_reason = quality(place)
    reasons = [q_reason]
    match = min(1.0, 0.6 * len(matched))
    labels = [INTERESTS[i].label for i in sorted(matched) if i in INTERESTS]
    if labels:
        reasons.append("Matches " + " and ".join(labels))
    km = haversine_m(anchor[0], anchor[1], place.lat, place.lng) / 1000
    reasons.append(f"{km:.1f} km from {area_name}")
    b = budget_fit(place, req.budget_tier)
    if b < 0:
        reasons.append("Pricier than your budget")
    indoor = place_indoor(matched)
    wfit = 0.0
    if weather == "indoor":
        wfit = 0.3 if indoor else (-0.8 if indoor is False else 0)
        if indoor:
            reasons.append("Indoor: good for a rainy day")
    elif weather == "outdoor" and indoor is False:
        wfit = 0.15
    total = round(2 * q + match + b + wfit - 0.15 * km, 3)
    return total, reasons


def place_indoor(matched: set[str]) -> bool | None:
    flags = {INTERESTS[i].indoor for i in matched if i in INTERESTS}
    if flags == {True}:
        return True
    if False in flags:
        return False
    return None


def visit_minutes(matched: set[str]) -> int:
    vals = [INTERESTS[i].visit_minutes for i in matched if i in INTERESTS]
    return max(vals) if vals else 60


# ---------- Grouping ----------

class Candidate:
    def __init__(self, place: Place, matched: set[str], score: float, reasons: list[str] | None = None):
        self.place = place
        self.matched = matched
        self.score = score
        self.indoor = place_indoor(matched)
        self.evening_only = all(INTERESTS[i].evening_only for i in matched if i in INTERESTS) and bool(matched)
        self.evening_ok = any(INTERESTS[i].evening for i in matched if i in INTERESTS)
        self.gem = hidden_gem(place)
        place.score = score
        place.hidden_gem = self.gem
        place.score_reasons = (reasons or []) + (["Hidden gem: well reviewed but less crowded"] if self.gem and place.provider == "google" else
                                                 ["Lesser-known spot"] if self.gem else [])

    @property
    def pos(self) -> tuple[float, float]:
        return (self.place.lat, self.place.lng)


def _dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return haversine_m(a[0], a[1], b[0], b[1])


def pick_day(pool: list[Candidate], n: int, weather: str | None, gem_share: float = 0.34, spread_m: float = 1500) -> list[Candidate]:
    """Best candidates for the day, keeping stops close together, with about `gem_share`
    lesser-known picks when any exist. Rainy days push outdoor places back."""
    usable = [c for c in pool if not c.evening_only]
    if not usable or n <= 0:
        return []

    def eff(c: Candidate) -> float:
        return c.score - (1.2 if weather == "indoor" and c.indoor is False else 0)

    ranked = sorted(usable, key=lambda c: (-eff(c), c.place.id))
    chosen = [ranked[0]]
    want_gems = max(0, round(n * gem_share)) if any(c.gem for c in usable) else 0
    rest = ranked[1:]
    while len(chosen) < n and rest:
        centre = (sum(c.pos[0] for c in chosen) / len(chosen), sum(c.pos[1] for c in chosen) / len(chosen))
        gems_have = sum(1 for c in chosen if c.gem)
        need_gem = gems_have < want_gems and (n - len(chosen)) <= (want_gems - gems_have)
        options = [c for c in rest if c.gem] if need_gem and any(c.gem for c in rest) else rest
        nxt = max(options, key=lambda c: (eff(c) - _dist(centre, c.pos) / spread_m, c.place.id))
        chosen.append(nxt)
        rest.remove(nxt)
    return chosen


def pick_evening(pool: list[Candidate], near: tuple[float, float]) -> Candidate | None:
    options = [c for c in pool if c.evening_ok or c.evening_only]
    if not options:
        return None
    return max(options, key=lambda c: (c.score - _dist(near, c.pos) / 1500, c.place.id))


def order_nearest(cands: list[Candidate], start: tuple[float, float]) -> list[Candidate]:
    out, cur, rest = [], start, list(cands)
    while rest:
        nxt = min(rest, key=lambda c: (_dist(cur, c.pos), c.place.id))
        out.append(nxt)
        rest.remove(nxt)
        cur = nxt.pos
    return out


def split_parts(ordered: list[Candidate], pace: str, weather: str | None) -> tuple[list[Candidate], list[Candidate]]:
    """Morning gets outdoor places when it is hot or showery ("mixed"); the afternoon gets indoor ones."""
    slots = PACE_SLOTS[pace]
    if weather == "mixed":
        ordered = sorted(ordered, key=lambda c: 0 if c.indoor is False else (2 if c.indoor else 1))
    return ordered[: slots["morning"]], ordered[slots["morning"]: slots["morning"] + slots["afternoon"]]


# ---------- Opening hours ----------

def google_weekday(d: date) -> int:
    return (d.weekday() + 1) % 7  # Google: 0 = Sunday


def is_open(place: Place, d: date, start_min: int, end_min: int) -> bool | None:
    """True/False when the provider gave structured hours; None when unknown."""
    oh = place.opening_hours
    if not oh or not oh.periods:
        return None
    gd = google_weekday(d)
    for p in oh.periods:
        if p.close_time is None:  # Google: open 24 hours
            return True
        o = to_min(p.open_time)
        c = to_min(p.close_time)
        if p.open_day == gd:
            if p.close_day is not None and p.close_day != p.open_day:
                c += 24 * 60
            if o <= start_min and end_min <= c:
                return True
        elif p.close_day == gd and p.close_day != p.open_day:  # opened yesterday, closes today
            if end_min <= c:
                return True
    return False


def hours_note(place: Place, d: date) -> str:
    oh = place.opening_hours
    if not oh:
        return "Opening hours not available from the provider. Check before visiting."
    if oh.weekday_text and len(oh.weekday_text) == 7:
        return f"{oh.weekday_text[d.weekday()]} ({place.provenance.source})"  # Google lists Monday first
    if oh.raw:
        return f"Hours: {oh.raw} ({place.provenance.source})"
    return "Opening hours not available from the provider. Check before visiting."


# ---------- Timeline ----------

def part_for(minutes: int) -> str:
    return "morning" if minutes < 12 * 60 else ("afternoon" if minutes < EVENING_EARLIEST else "evening")


def layout(blocks: list[Block], legs: list[Leg | None], d: date, pace: str) -> list[Block]:
    """Assign start/end times in order. `legs[i]` is travel into blocks[i] (None if no move).
    Inserts free-time blocks when a meal or evening stop has to wait for its usual hour,
    and flags visits that fall outside known opening hours."""
    out: list[Block] = []
    t = to_min(PACE_START[pace])
    for b, lg in zip(blocks, legs):
        if b.auto:
            continue
        b.leg_from_previous = lg
        if lg:
            t += round_up_5(lg.duration_s / 60)
        earliest = None
        if b.meal == "lunch":
            earliest = LUNCH_EARLIEST
        elif b.meal == "dinner":
            earliest = DINNER_EARLIEST
        elif b.kind == "visit" and b.part == "evening":
            earliest = EVENING_EARLIEST
        if earliest and t < earliest:
            gap = earliest - t
            if gap >= 20:
                out.append(Block(
                    id=new_id(), kind="free", part=part_for(t), start=to_hhmm(t), end=to_hhmm(earliest),
                    duration_min=gap, title="Free time", auto=True,
                ))
            t = earliest
        b.start = to_hhmm(t)
        t += b.duration_min
        b.end = to_hhmm(t)
        b.part = part_for(to_min(b.start))
        if b.place and b.kind in ("visit", "meal"):
            status = is_open(b.place, d, to_min(b.start), to_min(b.end))
            note = hours_note(b.place, d)
            b.hours_note = ("May be closed at this time. " + note) if status is False else note
            if status is True:
                b.place.score_reasons = [r for r in b.place.score_reasons if not r.startswith("Open at ")] + [f"Open at {b.start} (per provider)"]
        out.append(b)
    return out
