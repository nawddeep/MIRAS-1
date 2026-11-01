"""SQLite (default) or PostgreSQL storage for saved itineraries.

Google Places content may not be stored (place IDs may), so before saving every
Google place is reduced to its ID and re-fetched from Place Details when opened.
OpenStreetMap/Geoapify places are stored as-is (ODbL, attribution kept)."""

import hashlib
import logging
import secrets
import uuid
from pathlib import Path
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, String, create_engine, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from config import get_settings

log = logging.getLogger("db")


class Base(DeclarativeBase):
    pass


JsonType = JSON().with_variant(JSONB(), "postgresql")


class SavedItinerary(Base):
    __tablename__ = "itineraries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    share_token: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    edit_token_hash: Mapped[str] = mapped_column(String(64))
    destination_id: Mapped[str] = mapped_column(String(40))
    preferences: Mapped[dict] = mapped_column(JsonType)  # the TripRequest (search preferences)
    plan: Mapped[dict] = mapped_column(JsonType)  # days/blocks with Google places reduced to IDs
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


_engine = None


class DatabaseUnavailable(Exception):
    pass


def engine():
    global _engine
    if _engine is None:
        url = get_settings().database_url
        kwargs: dict = {"pool_pre_ping": True}
        if url.startswith("sqlite"):
            path = url.split("///", 1)[-1]
            if path and path != ":memory:":
                file = Path(path)
                if not file.is_absolute():  # relative paths are relative to backend/, not the working directory
                    file = Path(__file__).resolve().parent / file
                    url = f"sqlite:///{file}"
                file.parent.mkdir(parents=True, exist_ok=True)
            kwargs["connect_args"] = {"check_same_thread": False}
        _engine = create_engine(url, **kwargs)
    return _engine


def set_engine(e) -> None:
    global _engine
    _engine = e


def init_db() -> bool:
    try:
        Base.metadata.create_all(engine())
        return True
    except SQLAlchemyError as exc:
        log.error("Database not reachable, saving itineraries is disabled: %s", exc)
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create(destination_id: str, preferences: dict, plan: dict) -> tuple[str, str, str]:
    share, edit = secrets.token_urlsafe(12), secrets.token_urlsafe(24)
    row = SavedItinerary(share_token=share, edit_token_hash=hash_token(edit), destination_id=destination_id, preferences=preferences, plan=plan)
    try:
        with Session(engine()) as s:
            s.add(row)
            s.commit()
            return row.id, share, edit
    except SQLAlchemyError as exc:
        raise DatabaseUnavailable(str(exc)) from exc


def update(share_token: str, edit_token: str, preferences: dict, plan: dict) -> bool:
    try:
        with Session(engine()) as s:
            row = s.scalar(select(SavedItinerary).where(SavedItinerary.share_token == share_token))
            if not row or not secrets.compare_digest(row.edit_token_hash, hash_token(edit_token)):
                return False
            row.preferences, row.plan = preferences, plan
            row.updated_at = datetime.now(timezone.utc)
            s.commit()
            return True
    except SQLAlchemyError as exc:
        raise DatabaseUnavailable(str(exc)) from exc


def get_by_share(share_token: str) -> SavedItinerary | None:
    try:
        with Session(engine()) as s:
            row = s.scalar(select(SavedItinerary).where(SavedItinerary.share_token == share_token))
            if row:
                s.expunge(row)
            return row
    except SQLAlchemyError as exc:
        raise DatabaseUnavailable(str(exc)) from exc
