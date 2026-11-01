"""Indian Railways.

data.gov.in publishes a static railway timetable dataset. It is reference data only:
results are labelled Historical with the dataset caveat, never as live availability.
Set DATA_GOV_IN_TRAIN_RESOURCE_ID to the timetable resource you have access to. The
normaliser expects the timetable columns (train_no, train_name, station_code, seq,
arrival_time, departure_time) and ignores rows without them.

Qrail: no public API specification was available to build against, so this adapter
reports "not configured" instead of guessing endpoints."""

from models.common import Provenance, utcnow
from models.transport import TrainOption
from integrations.base import Provider, ProviderNotConfigured

IRCTC_SEARCH = "https://www.irctc.co.in/nget/train-search"


def _get(row: dict, *keys: str):
    lower = {k.lower().replace(" ", "_").replace(".", ""): v for k, v in row.items()}
    for k in keys:
        if lower.get(k) not in (None, "", "NA"):
            return lower[k]
    return None


def _minutes(t: str | None) -> int | None:
    if not t or ":" not in t:
        return None
    h, m = t.split(":")[:2]
    try:
        return int(h) * 60 + int(m)
    except ValueError:
        return None


def normalise_timetable(origin_rows: list[dict], dest_rows: list[dict], origin_code: str, dest_code: str) -> list[TrainOption]:
    """Trains that call at the origin station before the destination station."""
    now = utcnow()
    at_origin = {}
    for r in origin_rows:
        no = _get(r, "train_no", "train_number")
        if no:
            at_origin[str(no)] = r
    out = []
    for r in dest_rows:
        no = _get(r, "train_no", "train_number")
        o = at_origin.get(str(no)) if no else None
        if not o:
            continue
        try:
            if int(_get(o, "seq", "sequence") or 0) >= int(_get(r, "seq", "sequence") or 0):
                continue  # runs the other way
        except ValueError:
            continue
        dep, arr = _get(o, "departure_time"), _get(r, "arrival_time")
        dm, am = _minutes(dep), _minutes(arr)
        duration = None
        if dm is not None and am is not None:
            # Distance-based day offsets aren't in the dataset; only same-day/overnight is inferred.
            duration = am - dm if am >= dm else am + 1440 - dm
        out.append(TrainOption(
            id=f"datagovin:{no}",
            train_number=str(no),
            train_name=_get(r, "train_name"),
            from_station=_get(o, "station_name") or origin_code,
            to_station=_get(r, "station_name") or dest_code,
            departure=dep, arrival=arr, duration_min=duration,
            fare=None, running_status=None,
            redirect_url=IRCTC_SEARCH,
            provenance=Provenance(
                source="data.gov.in railway timetable", data_type="Historical", last_checked=now,
                note="Reference timetable from a static open dataset. Timings may have changed and it shows no availability. Check IRCTC.",
            ),
        ))
    return out


class DataGovInTrains(Provider):
    name = "data_gov_in"
    label = "data.gov.in (railway timetable)"
    cache_ttl = 24 * 3600
    rate_per_second = 2

    def configured(self) -> bool:
        return bool(self.settings.data_gov_in_api_key and self.settings.data_gov_in_train_resource_id)

    async def _station_rows(self, code: str) -> list[dict]:
        data = await self.request(
            "GET", f"https://api.data.gov.in/resource/{self.settings.data_gov_in_train_resource_id}",
            params={"api-key": self.settings.data_gov_in_api_key, "format": "json", "limit": 500, "filters[station_code]": code},
        )
        return data.get("records") or []

    async def search(self, origin_code: str, dest_code: str) -> list[TrainOption]:
        self.require_configured()
        o = await self._station_rows(origin_code)
        d = await self._station_rows(dest_code)
        return normalise_timetable(o, d, origin_code, dest_code)


class QrailTrains(Provider):
    name = "qrail"
    label = "Qrail"

    def configured(self) -> bool:
        return False

    async def search(self, origin_code: str, dest_code: str) -> list[TrainOption]:
        raise ProviderNotConfigured("Qrail adapter needs the provider's API documentation and credentials")
