from datetime import datetime, timezone
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, Field

DataType = Literal["Live", "Scheduled", "Estimated", "Historical"]
ProviderState = Literal["ok", "empty", "not_configured", "error", "skipped"]


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Provenance(BaseModel):
    """Attached to every data card: where it came from, what kind of data it is, and when it was fetched."""

    source: str
    data_type: DataType
    last_checked: datetime = Field(default_factory=utcnow)
    attribution: str | None = None
    note: str | None = None


class ProviderStatus(BaseModel):
    provider: str
    state: ProviderState
    message: str | None = None


T = TypeVar("T")


class Envelope(BaseModel, Generic[T]):
    data: T
    providers: list[ProviderStatus] = []
    fetched_at: datetime = Field(default_factory=utcnow)


class LatLng(BaseModel):
    lat: float
    lng: float
