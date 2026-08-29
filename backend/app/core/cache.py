"""Optional shared cache (Redis) — every call degrades to a no-op if Redis
isn't reachable, so local dev (which usually doesn't run Redis) and any
environment without it keep working exactly as before this existed; only
production is expected to actually have it running. Nothing in this
module ever raises out to a caller — a cache is allowed to fail silently,
correctness must never depend on it.
"""
import json
import logging
import os
from typing import Any

logger = logging.getLogger("uvicorn.error")

try:
    import redis
except ImportError:  # pragma: no cover — redis is in requirements.txt, but
    # keep this import optional so a stripped-down env still boots.
    redis = None  # type: ignore[assignment]

_client: "redis.Redis | None" = None
_checked = False


def _get_client() -> "redis.Redis | None":
    global _client, _checked
    if _checked:
        return _client
    _checked = True
    if redis is None:
        return None
    url = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")
    try:
        client = redis.from_url(url, socket_connect_timeout=0.5, socket_timeout=0.5)
        client.ping()
        _client = client
        logger.info("Redis cache connected at %s", url)
    except Exception:
        logger.warning("Redis not reachable at %s — running without a shared cache", url)
        _client = None
    return _client


def get_json(key: str) -> Any | None:
    client = _get_client()
    if client is None:
        return None
    try:
        raw = client.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


def set_json(key: str, value: Any, ttl_seconds: int) -> None:
    client = _get_client()
    if client is None:
        return
    try:
        client.setex(key, ttl_seconds, json.dumps(value))
    except Exception:
        pass
