"""Common plumbing for every provider: timeout, retry with backoff, a per-provider
rate limiter, an optional TTL cache, and clear "not configured" errors.

Caching is per provider and off by default. Only turn it on where the provider's
terms allow storing responses (e.g. Google Places content must not be cached)."""

import asyncio
import hashlib
import json
import logging
import random
import time
from collections import OrderedDict
from typing import Any, Awaitable, Callable, TypeVar

import httpx

from config import get_settings
from models.common import ProviderStatus

log = logging.getLogger("integrations")
T = TypeVar("T")


class ProviderNotConfigured(Exception):
    pass


class ProviderError(Exception):
    pass


class TTLCache:
    def __init__(self, max_items: int = 512):
        self._data: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self.max_items = max_items

    def get(self, key: str) -> Any | None:
        item = self._data.get(key)
        if not item:
            return None
        expires, value = item
        if expires < time.monotonic():
            self._data.pop(key, None)
            return None
        self._data.move_to_end(key)
        return value

    def set(self, key: str, value: Any, ttl: float) -> None:
        self._data[key] = (time.monotonic() + ttl, value)
        self._data.move_to_end(key)
        while len(self._data) > self.max_items:
            self._data.popitem(last=False)


class RateLimiter:
    """Token bucket: `rate` requests per second, bursting up to `burst`."""

    def __init__(self, rate: float, burst: int = 1):
        self.rate = rate
        self.capacity = burst
        self.tokens = float(burst)
        self.updated = time.monotonic()
        self._lock: asyncio.Lock | None = None
        self._loop = None

    async def acquire(self) -> None:
        loop = asyncio.get_running_loop()
        if self._lock is None or self._loop is not loop:  # locks are bound to one event loop
            self._lock, self._loop = asyncio.Lock(), loop
        async with self._lock:
            while True:
                now = time.monotonic()
                self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
                self.updated = now
                if self.tokens >= 1:
                    self.tokens -= 1
                    return
                await asyncio.sleep((1 - self.tokens) / self.rate)


# One shared client; tests swap it for one with a MockTransport.
_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=get_settings().http_timeout_seconds)
    return _client


def set_client(client: httpx.AsyncClient | None) -> None:
    global _client
    _client = client


RETRY_STATUS = {429, 500, 502, 503, 504}
AUTH_STATUS = {401, 403}
AUTH_COOLDOWN_S = 300


class Provider:
    name: str = "provider"
    label: str = "Provider"  # shown to users as the source
    cache_ttl: float = 0  # seconds; 0 = never cache (default, safest for terms)
    rate_per_second: float = 5
    burst: int = 5
    timeout_s: float | None = None  # per-provider override of HTTP_TIMEOUT_SECONDS
    max_retries: int | None = None  # per-provider override of HTTP_MAX_RETRIES

    def __init__(self) -> None:
        self.settings = get_settings()
        self._limiter = RateLimiter(self.rate_per_second, self.burst)
        self._cache = TTLCache()
        self._blocked_until = 0.0
        self._blocked_reason = ""

    def configured(self) -> bool:
        return True

    def blocked(self) -> str | None:
        """After a 401/403 (bad key, API not enabled) skip this provider for a while
        instead of failing every request against it."""
        if self._blocked_until > time.monotonic():
            return self._blocked_reason
        return None

    def require_configured(self) -> None:
        if not self.configured():
            raise ProviderNotConfigured(f"{self.label} is not configured (missing API key)")

    async def request(
        self,
        method: str,
        url: str,
        *,
        params: dict | None = None,
        json_body: dict | None = None,
        form: dict | None = None,
        headers: dict | None = None,
        cache: bool = True,
        expect_json: bool = True,
    ) -> Any:
        key = None
        if cache and self.cache_ttl > 0:
            raw = json.dumps([method, url, params, json_body, form], sort_keys=True, default=str)
            key = hashlib.sha256(raw.encode()).hexdigest()
            hit = self._cache.get(key)
            if hit is not None:
                return hit

        retries = self.settings.http_max_retries if self.max_retries is None else min(self.max_retries, self.settings.http_max_retries)
        last_exc: Exception | None = None
        for attempt in range(retries + 1):
            await self._limiter.acquire()
            try:
                resp = await get_client().request(method, url, params=params, json=json_body, data=form, headers=headers,
                                                  timeout=self.timeout_s or self.settings.http_timeout_seconds)
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_exc = exc
                log.warning("%s network error (attempt %s): %s", self.name, attempt + 1, exc)
            else:
                if resp.status_code in RETRY_STATUS and attempt < retries:
                    last_exc = ProviderError(f"{self.label} returned HTTP {resp.status_code}")
                    retry_after = resp.headers.get("retry-after")
                    if retry_after and retry_after.isdigit():
                        await asyncio.sleep(min(float(retry_after), 5))
                        continue
                elif resp.status_code >= 400:
                    if resp.status_code in AUTH_STATUS:
                        self._blocked_until = time.monotonic() + AUTH_COOLDOWN_S
                        self._blocked_reason = f"{self.label} rejected the request (HTTP {resp.status_code}). Check the key and that the API is enabled."
                    raise ProviderError(f"{self.label} returned HTTP {resp.status_code}: {_short(resp.text)}")
                else:
                    data = resp.json() if expect_json else resp
                    if key:
                        self._cache.set(key, data, self.cache_ttl)
                    return data
            if attempt < retries:
                await asyncio.sleep((0.4 * 2**attempt) + random.uniform(0, 0.2))
        raise ProviderError(f"{self.label} failed after {retries + 1} attempts: {last_exc}")


def _short(text: str, n: int = 200) -> str:
    return text[:n].replace("\n", " ")


async def try_chain(
    providers: list[Provider],
    call: Callable[[Provider], Awaitable[T]],
    *,
    is_empty: Callable[[T], bool] = lambda r: not r,
) -> tuple[T | None, list[ProviderStatus]]:
    """Run `call` against each provider in order until one returns a non-empty result.
    Returns the result and a status per provider so the UI can explain fallbacks."""
    statuses: list[ProviderStatus] = []
    for p in providers:
        if not p.configured():
            statuses.append(ProviderStatus(provider=p.label, state="not_configured", message=f"{p.label} key not set"))
            continue
        if reason := p.blocked():
            statuses.append(ProviderStatus(provider=p.label, state="skipped", message=reason))
            continue
        try:
            result = await call(p)
        except ProviderNotConfigured as exc:
            statuses.append(ProviderStatus(provider=p.label, state="not_configured", message=str(exc)))
            continue
        except ProviderError as exc:
            log.warning("%s", exc)
            statuses.append(ProviderStatus(provider=p.label, state="error", message=str(exc)))
            continue
        if is_empty(result):
            statuses.append(ProviderStatus(provider=p.label, state="empty", message="No results"))
            continue
        statuses.append(ProviderStatus(provider=p.label, state="ok"))
        return result, statuses
    return None, statuses


async def gather_all(
    providers: list[Provider],
    call: Callable[[Provider], Awaitable[T]],
) -> tuple[list[tuple[Provider, T]], list[ProviderStatus]]:
    """Run `call` on every configured provider concurrently (used to merge sources)."""
    statuses: list[ProviderStatus] = []
    active = []
    for p in providers:
        if reason := p.blocked():
            statuses.append(ProviderStatus(provider=p.label, state="skipped", message=reason))
        elif p.configured():
            active.append(p)
        else:
            statuses.append(ProviderStatus(provider=p.label, state="not_configured", message=f"{p.label} key not set"))
    results = await asyncio.gather(*(call(p) for p in active), return_exceptions=True)
    out: list[tuple[Provider, T]] = []
    for p, r in zip(active, results):
        if isinstance(r, ProviderNotConfigured):
            statuses.append(ProviderStatus(provider=p.label, state="not_configured", message=str(r)))
        elif isinstance(r, BaseException):
            statuses.append(ProviderStatus(provider=p.label, state="error", message=str(r)))
        elif not r:
            statuses.append(ProviderStatus(provider=p.label, state="empty", message="No results"))
            out.append((p, r))
        else:
            statuses.append(ProviderStatus(provider=p.label, state="ok"))
            out.append((p, r))
    return out, statuses
