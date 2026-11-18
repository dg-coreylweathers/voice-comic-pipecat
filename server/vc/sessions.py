"""In-memory server-metered usage by session id (replaces the Node usageBook). Lane S1. Implements
vc.deps.UsageRegistry. 2 h TTL, swept every 10 min. One machine, one process: no shared store needed."""

from __future__ import annotations

from vc.protocol import UsageReport


class Sessions:
    def __init__(self, ttl_s: float = 7200) -> None:
        raise NotImplementedError("TODO(S1)")

    def put(self, session_id: str, usage: UsageReport) -> None: ...
    def get(self, session_id: str) -> UsageReport | None: ...
    def sweep(self, now: float | None = None) -> int: ...
