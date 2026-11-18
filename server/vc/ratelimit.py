"""Fixed-window per-IP rate limiter (port of index.js rateLimit). Lane S2. /api/session 20/min, strips 12/min.
Behind Fly the client IP is the first Fly-Client-IP / X-Forwarded-For hop."""

from __future__ import annotations


class RateLimiter:
    def __init__(self, max_hits: int, window_s: float) -> None:
        raise NotImplementedError("TODO(S2)")

    def hit(self, key: str, now: float | None = None) -> bool:
        """True when allowed, False when the caller should answer 429 {"error": "rate_limited"}."""
        raise NotImplementedError
