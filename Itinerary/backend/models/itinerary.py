from datetime import date, timedelta
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from models.common import Provenance, ProviderStatus, utcnow
from models.place import Place
from models.transport import TransportResults
from models.weather import DailyWeather

Interest = Literal[
    "cafes", "food", "adventure", "shopping", "heritage", "museums",
    "nature", "nightlife", "arts", "wellness", "photography",
]
Rental = Literal["none", "two_wheeler", "car", "unsure"]
Pace = Literal["relaxed", "balanced", "packed"]
BudgetTier = Literal["budget", "mid", "premium"]
TransportPref = Literal["flight", "train", "bus", "any"]
StayType = Literal["hotel", "hostel", "homestay", "heritage"]
TravelMode = Literal["walk", "cycle", "scooter", "car"]


class Origin(BaseModel):
    label: str
    lat: float
    lng: float
    airport_code: str | None = None  # IATA, optional override
    station_code: str | None = None  # Indian Railways station code, optional


class TripRequest(BaseModel):
    destination_id: str = "udaipur"
    origin: Origin | None = None
    start_date: date
    days: int = Field(ge=1, le=10)
    adults: int = Field(default=1, ge=1, le=12)
    children: int = Field(default=0, ge=0, le=12)
    budget_tier: BudgetTier = "mid"
    budget_min_per_day: int | None = Field(default=None, ge=0)
    budget_max_per_day: int | None = Field(default=None, ge=0)
    transport: TransportPref = "any"
    interests: list[Interest] = Field(min_length=1)
    pace: Pace = "balanced"
    stay_type: StayType | None = None
    rental: Rental = "none"
    preset: str | None = None

    @field_validator("start_date")
    @classmethod
    def not_in_past(cls, v: date) -> date:
        # Allow "today" in any timezone that is at most one day behind UTC.
        if v < date.today() - timedelta(days=1):
            raise ValueError("Start date is in the past")
        return v

    @model_validator(mode="after")
    def budget_order(self):
        if self.budget_min_per_day is not None and self.budget_max_per_day is not None:
            if self.budget_min_per_day > self.budget_max_per_day:
                raise ValueError("Minimum budget is higher than maximum budget")
        return self


class ModeEstimate(BaseModel):
    """Distance and time for one travel mode. data_type is "Estimated" when derived (e.g. two-wheeler from car)."""

    mode: TravelMode
    distance_m: float
    duration_s: float
    data_type: Literal["Live", "Estimated"]
    source: str
    traffic_aware: bool = False
    suitable: bool = True
    note: str | None = None


class Leg(BaseModel):
    """Travel between two consecutive stops: the suggested mode plus every mode for comparison."""

    distance_m: float
    duration_s: float
    mode: TravelMode
    provenance: Provenance
    modes: list[ModeEstimate] = []


BlockKind = Literal["visit", "meal", "buffer", "free"]
DayPart = Literal["morning", "afternoon", "evening"]


class Block(BaseModel):
    id: str
    kind: BlockKind
    part: DayPart
    start: str = ""  # "HH:MM", local; filled in by the layout step
    end: str = ""
    duration_min: int
    title: str
    place: Place | None = None
    visit_minutes_is_estimate: bool = True
    hours_note: str | None = None  # e.g. "Open 09:30-17:30 on Monday (Google)" or "Hours not available"
    indoor: bool | None = None
    leg_from_previous: Leg | None = None
    reason: str | None = None  # why this stop was chosen
    meal: Literal["lunch", "dinner"] | None = None
    interests: list[str] = []  # which interests this stop serves (used for "show me a different place")
    auto: bool = False  # free-time filler created by the layout step; recomputed on every relayout


class TrailWaypoint(BaseModel):
    name: str
    lat: float
    lng: float
    place_id: str | None = None


class Difficulty(BaseModel):
    level: Literal["Easy", "Moderate", "Hard"]
    basis: str
    is_estimate: bool = True


class TrailRoute(BaseModel):
    id: str
    title: str
    label: Literal["Suggested route"] = "Suggested route"
    mode: TravelMode
    waypoints: list[TrailWaypoint]
    geometry: list[tuple[float, float]]  # [lat, lng]
    distance_m: float
    duration_s: float
    elevation_gain_m: float | None = None
    elevation_profile: list[tuple[float, float]] | None = None  # [distance_m, elevation_m]
    difficulty: Difficulty
    navigation_url: str
    navigation_urls: dict[str, str] = {}  # per travel mode
    mode_estimates: list[ModeEstimate] = []  # empty = fetch on demand via /api/routes/modes
    provenance: Provenance


class Area(BaseModel):
    id: str
    name: str
    lat: float
    lng: float


class Day(BaseModel):
    index: int
    date: date
    area: Area | None = None  # each day is centred on a different area
    weather: DailyWeather | None = None
    weather_note: str | None = None
    blocks: list[Block]
    trails: list[TrailRoute] = []
    mode_totals: list[ModeEstimate] = []  # whole-day route by mode
    navigation_urls: dict[str, str] = {}
    search_notes: list[str] = []  # e.g. "Widened search to 4.5 km: too few cafes nearby"


class BudgetLine(BaseModel):
    label: str
    amount_min: float | None = None
    amount_max: float | None = None
    currency: str = "INR"
    basis: str
    data_type: Literal["Live", "Scheduled", "Estimated", "Historical", "User"]


class BudgetSummary(BaseModel):
    lines: list[BudgetLine]
    user_range_per_day: tuple[int | None, int | None] | None = None
    notes: list[str]


class EmergencyContact(BaseModel):
    label: str
    number: str


class Essentials(BaseModel):
    emergency: list[EmergencyContact]
    emergency_source: str
    hospitals: list[Place]
    pharmacies: list[Place]
    documents: list[str]
    money_notes: list[str]


class LatLngPoint(BaseModel):
    lat: float
    lng: float


class RentalSection(BaseModel):
    """Where to look for rental shops. Shops are loaded separately (Explore endpoint, category = `group`)
    so a slow provider never delays the itinerary."""

    choice: Rental
    group: str
    arrival_label: str
    arrival: LatLngPoint
    stay_label: str
    stay: LatLngPoint
    near_arrival: list[Place] = []
    near_stay: list[Place] = []
    advice: list[str] = []
    notes: list[str] = []


class Itinerary(BaseModel):
    id: str | None = None
    share_token: str | None = None
    request: TripRequest
    destination_name: str
    generated_at: str = Field(default_factory=lambda: utcnow().isoformat())
    days: list[Day]
    stays: list[Place] = []
    transport: TransportResults | None = None
    budget: BudgetSummary
    essentials: Essentials
    rentals: RentalSection | None = None
    providers: list[ProviderStatus] = []
