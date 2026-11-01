from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from destinations import DESTINATIONS
from integrations import registry
from integrations.base import ProviderError
from models.common import Envelope, ProviderStatus
from models.weather import WeatherReport

router = APIRouter(prefix="/api/weather", tags=["weather"])


@router.get("", response_model=Envelope[WeatherReport])
async def weather(
    destination: str = "udaipur", lat: float | None = None, lng: float | None = None,
    start: date | None = None, days: int = Query(default=7, ge=1, le=16),
):
    d = DESTINATIONS.get(destination)
    if not d:
        raise HTTPException(400, "Unknown destination")
    start = start or date.today()
    try:
        rep = await registry.open_meteo().report(lat if lat is not None else d.lat, lng if lng is not None else d.lng, start, start + timedelta(days=days - 1), d.timezone)
    except ProviderError as exc:
        return Envelope(data=WeatherReport(), providers=[ProviderStatus(provider="Open-Meteo", state="error", message=str(exc))])
    return Envelope(data=rep, providers=[ProviderStatus(provider="Open-Meteo", state="ok")])
