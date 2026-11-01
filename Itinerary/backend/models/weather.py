from datetime import date

from pydantic import BaseModel

from models.common import Provenance


class CurrentWeather(BaseModel):
    temperature_c: float | None = None
    condition: str | None = None
    weather_code: int | None = None
    wind_kmh: float | None = None
    precipitation_mm: float | None = None
    provenance: Provenance


class DailyWeather(BaseModel):
    date: date
    temp_max_c: float | None = None
    temp_min_c: float | None = None
    rain_probability_pct: float | None = None  # forecast only
    precipitation_mm: float | None = None  # historical only
    condition: str | None = None
    weather_code: int | None = None
    wind_max_kmh: float | None = None
    sunrise: str | None = None
    sunset: str | None = None
    suggestion: str  # "outdoor" | "indoor" | "mixed": drives the itinerary
    provenance: Provenance


class WeatherReport(BaseModel):
    current: CurrentWeather | None = None
    daily: list[DailyWeather] = []
