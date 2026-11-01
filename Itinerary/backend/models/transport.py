from typing import Literal

from pydantic import BaseModel

from models.common import Provenance


class Money(BaseModel):
    amount: float
    currency: str


class FlightSegment(BaseModel):
    airline: str | None = None
    flight_number: str | None = None
    from_airport: str | None = None
    to_airport: str | None = None
    departure: str | None = None  # ISO local time as returned by the provider
    arrival: str | None = None
    duration_min: int | None = None


class FlightOption(BaseModel):
    kind: Literal["flight"] = "flight"
    id: str
    airline: str | None = None
    flight_number: str | None = None
    departure: str | None = None
    arrival: str | None = None
    duration_min: int | None = None
    stops: int | None = None
    segments: list[FlightSegment] = []
    price: Money | None = None
    redirect_url: str | None = None
    redirect_label: str = "View on provider"
    provenance: Provenance


class TrainOption(BaseModel):
    kind: Literal["train"] = "train"
    id: str
    train_number: str | None = None
    train_name: str | None = None
    from_station: str | None = None
    to_station: str | None = None
    departure: str | None = None
    arrival: str | None = None
    duration_min: int | None = None
    fare: Money | None = None
    running_status: str | None = None
    redirect_url: str | None = None
    redirect_label: str = "Check on IRCTC"
    provenance: Provenance


class BusOption(BaseModel):
    kind: Literal["bus"] = "bus"
    id: str
    operator: str | None = None
    route_name: str | None = None
    category: str | None = None
    from_stop: str | None = None
    to_stop: str | None = None
    departure: str | None = None
    arrival: str | None = None
    duration_min: int | None = None
    fare: Money | None = None
    redirect_url: str | None = None
    redirect_label: str = "View operator"
    provenance: Provenance


class TransportResults(BaseModel):
    origin_label: str
    destination_label: str
    date: str
    flights: list[FlightOption] = []
    trains: list[TrainOption] = []
    buses: list[BusOption] = []
    origin_airport: str | None = None
    destination_airport: str | None = None
    notes: list[str] = []
