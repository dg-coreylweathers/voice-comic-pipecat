"""Stateless browser session tokens `{exp_ms}.{hmac_sha256_b64url}` (port of voice-comic server/auth.js). Lane S2.

The Pipecat JS WebSocketTransport sends the token as the `token` query parameter (not the old
`access_token.<t>` subprotocol), so WS /api/agent reads `ws.query_params["token"]`. TTL 1 h.
"""

from __future__ import annotations


class Auth:
    def __init__(self, secret: str | None = None, ttl_ms: int = 3_600_000) -> None:
        raise NotImplementedError("TODO(S2): port createAuth (random secret when None, hmac.compare_digest)")

    def issue(self, now_ms: int | None = None) -> str:
        raise NotImplementedError

    def verify(self, token: str | None, now_ms: int | None = None) -> bool:
        raise NotImplementedError
