"""Open-Meteo: current weather and a daily forecast up to 16 days ahead. For dates further
out, the same calendar dates from last year come from the archive API, labelled Historical.
Also provides elevation lookups for route profiles. No key needed (non-commercial use)."""

from datetime import date, timedelta

from models.common import Provenance, utcnow
from models.weather import CurrentWeather, DailyWeather, WeatherReport
from integrations.base import Provider

FORECAST_DAYS = 16

# WMO weather interpretation codes, as documented by Open-Meteo.
WMO = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
    56: "Freezing drizzle", 57: "Freezing drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Freezing rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
    77: "Snow grains", 80: "Rain showers", 81: "Rain showers", 82: "Violent rain showers",
    85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
}
WET_CODES = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99}


def suggest(code: int | None, rain_prob: float | None, tmax: float | None, precip_mm: float | None = None) -> str:
    """indoor = mostly indoor plans, outdoor = good for outdoor, mixed = outdoor early/late."""
    if (rain_prob is not None and rain_prob >= 60) or (code in {65, 82, 95, 96, 99}) or (precip_mm is not None and precip_mm >= 10):
        return "indoor"
    if (tmax is not None and tmax >= 36) or (rain_prob is not None and rain_prob >= 35) or code in WET_CODES:
        return "mixed"
    return "outdoor"


def _at(arr: list | None, i: int):
    return arr[i] if arr and i < len(arr) else None


def normalise_forecast(data: dict) -> WeatherReport:
    now = utcnow()
    cur = data.get("current") or {}
    current = None
    if cur:
        code = cur.get("weather_code")
        current = CurrentWeather(
            temperature_c=cur.get("temperature_2m"), weather_code=code, condition=WMO.get(code),
            wind_kmh=cur.get("wind_speed_10m"), precipitation_mm=cur.get("precipitation"),
            provenance=Provenance(source="Open-Meteo", data_type="Live", last_checked=now, attribution="Weather data by Open-Meteo.com"),
        )
    d = data.get("daily") or {}
    days = []
    for i, day in enumerate(d.get("time", [])):
        code, rp, tmax = _at(d.get("weather_code"), i), _at(d.get("precipitation_probability_max"), i), _at(d.get("temperature_2m_max"), i)
        days.append(DailyWeather(
            date=date.fromisoformat(day), temp_max_c=tmax, temp_min_c=_at(d.get("temperature_2m_min"), i),
            rain_probability_pct=rp, condition=WMO.get(code), weather_code=code,
            wind_max_kmh=_at(d.get("wind_speed_10m_max"), i),
            sunrise=(_at(d.get("sunrise"), i) or "")[11:16] or None, sunset=(_at(d.get("sunset"), i) or "")[11:16] or None,
            suggestion=suggest(code, rp, tmax),
            provenance=Provenance(source="Open-Meteo forecast", data_type="Live", last_checked=now, attribution="Weather data by Open-Meteo.com", note="Forecast"),
        ))
    return WeatherReport(current=current, daily=days)


def normalise_archive(data: dict, shift_years: int) -> list[DailyWeather]:
    now = utcnow()
    d = data.get("daily") or {}
    out = []
    for i, day in enumerate(d.get("time", [])):
        past = date.fromisoformat(day)
        try:
            target = past.replace(year=past.year + shift_years)
        except ValueError:  # 29 Feb
            target = past + timedelta(days=365 * shift_years)
        code, tmax, pmm = _at(d.get("weather_code"), i), _at(d.get("temperature_2m_max"), i), _at(d.get("precipitation_sum"), i)
        out.append(DailyWeather(
            date=target, temp_max_c=tmax, temp_min_c=_at(d.get("temperature_2m_min"), i),
            precipitation_mm=pmm, condition=WMO.get(code), weather_code=code,
            wind_max_kmh=_at(d.get("wind_speed_10m_max"), i),
            suggestion=suggest(code, None, tmax, pmm),
            provenance=Provenance(
                source="Open-Meteo archive", data_type="Historical", last_checked=now, attribution="Weather data by Open-Meteo.com",
                note=f"Observed on {past.isoformat()} (same date in an earlier year). Not a forecast.",
            ),
        ))
    return out


class OpenMeteo(Provider):
    name = "open_meteo"
    label = "Open-Meteo"
    cache_ttl = 30 * 60
    rate_per_second = 5

    async def report(self, lat: float, lng: float, start: date, end: date, tz: str) -> WeatherReport:
        today = date.today()
        horizon = today + timedelta(days=FORECAST_DAYS - 1)
        report = WeatherReport()
        f_start, f_end = max(start, today), min(end, horizon)
        data = await self.request("GET", "https://api.open-meteo.com/v1/forecast", params={
            "latitude": lat, "longitude": lng, "timezone": tz,
            "current": "temperature_2m,weather_code,wind_speed_10m,precipitation",
            "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset",
            **({"start_date": f_start.isoformat(), "end_date": f_end.isoformat()} if f_start <= f_end else {"forecast_days": 1}),
        })
        fr = normalise_forecast(data)
        report.current = fr.current
        if f_start <= f_end:
            report.daily.extend(fr.daily)
        if end > horizon:
            a_start = max(start, horizon + timedelta(days=1))
            # Shift back whole years until the window is safely in the archive (about 5 days delay).
            years = 1
            while _years_back(end, years) > today - timedelta(days=6):
                years += 1
            a_start_ly, a_end_ly = _years_back(a_start, years), _years_back(end, years)
            arch = await self.request("GET", "https://archive-api.open-meteo.com/v1/archive", params={
                "latitude": lat, "longitude": lng, "timezone": tz,
                "start_date": a_start_ly.isoformat(), "end_date": a_end_ly.isoformat(),
                "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
            })
            report.daily.extend(normalise_archive(arch, a_start.year - a_start_ly.year))
        return report

    async def elevations(self, points: list[tuple[float, float]]) -> list[float]:
        out: list[float] = []
        for i in range(0, len(points), 100):
            chunk = points[i:i + 100]
            data = await self.request("GET", "https://api.open-meteo.com/v1/elevation", params={
                "latitude": ",".join(f"{p[0]:.5f}" for p in chunk),
                "longitude": ",".join(f"{p[1]:.5f}" for p in chunk),
            })
            out.extend(data.get("elevation", []))
        return out


def _years_back(d: date, years: int) -> date:
    try:
        return d.replace(year=d.year - years)
    except ValueError:  # 29 Feb
        return d.replace(year=d.year - years, day=28)
