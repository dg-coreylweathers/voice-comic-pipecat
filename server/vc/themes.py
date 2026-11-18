"""Themes tally (port of server/themes.js). Lane S2. Implements vc.deps.ThemesSink.

Table themes(event, day, kind[meta|topic|intent|category], term, count, sentiment_sum, first_at, last_at) in the
same strips.db; 11-category regex taxonomy; safe_topics entity filter; text matched then forgotten.
Budget rule (anti-pollution): only turns the pipeline actually finalized are tallied. The themes_intel processor
calls record() once per finished visitor turn, so a client can no longer inject turns (there is no vc.intel
client message any more).
"""

from __future__ import annotations

from typing import Any

from vc.deps import ThemeTurn


def event_key(name: str | None) -> str:
    raise NotImplementedError("TODO(S2): port eventKey")


class Themes:
    def __init__(self, db: Any) -> None:
        raise NotImplementedError("TODO(S2)")

    def record(self, event: str, turn: ThemeTurn) -> None: ...
    def summary(self, event: str, *, since_days: float | None = None) -> dict[str, Any]: ...
    def events(self) -> list[dict[str, Any]]: ...
    def csv(self, event: str) -> str: ...
