"""Currency conversion for the dashboard's placement-value total.

Uses Frankfurter (https://www.frankfurter.app), a free, keyless exchange
rate API backed by European Central Bank reference rates. No API key
means no secret to manage and no billing risk, at the cost of ECB's
daily-refresh cadence and euro-area currency coverage only — acceptable
for a dashboard rollup, not something charged money against or relied on
for anything time sensitive.
"""
import time

import httpx

from app.core import cache

_CACHE_TTL_SECONDS = 3600
# In-process fallback, used only when the shared cache (Redis) isn't
# reachable — see app/core/cache.py. Without this, every metrics request
# on an environment with no Redis would hit Frankfurter directly, same as
# before this cache existed; this keeps that path just as cheap.
_local_cache: dict[str, tuple[float, dict[str, float]]] = {}


def get_rates(base_currency: str) -> dict[str, float]:
    """Returns {currency_code: rate}, where 1 unit of base_currency equals
    `rate` units of that currency. Empty dict means conversion is
    unavailable right now (network error, unsupported currency, etc.) —
    callers should degrade to showing unconverted per-currency totals
    rather than failing the whole metrics response."""
    cache_key = f"forex:rates:{base_currency}"
    cached_shared = cache.get_json(cache_key)
    if cached_shared is not None:
        return cached_shared

    now = time.monotonic()
    local = _local_cache.get(base_currency)
    if local and now - local[0] < _CACHE_TTL_SECONDS:
        return local[1]

    try:
        response = httpx.get(
            "https://api.frankfurter.app/latest",
            params={"from": base_currency},
            timeout=5.0,
            follow_redirects=True,
        )
        response.raise_for_status()
        rates = response.json().get("rates", {})
        rates[base_currency] = 1.0
        _local_cache[base_currency] = (now, rates)
        cache.set_json(cache_key, rates, _CACHE_TTL_SECONDS)
        return rates
    except (httpx.HTTPError, ValueError):
        return local[1] if local else {}


def convert(amount: float, from_currency: str, to_currency: str) -> float | None:
    """Converts amount from_currency -> to_currency. Returns None if the
    conversion can't be done right now (rate unavailable)."""
    if from_currency == to_currency:
        return amount
    rates = get_rates(to_currency)
    rate = rates.get(from_currency)
    if not rate:
        return None
    return amount / rate
