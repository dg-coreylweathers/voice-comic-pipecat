"""What a saved permalink may expose (port of server/privacy.js). Lane S2.

sanitize_strip(strip, booth): booth -> events=[], title='Booth strip'; redact -> text-bearing event summaries
replaced '[omitted: redaction was on]' (event types now include vc.turn / vc.layer / vc.intel / user-input /
bot-output); topics filtered by echoes_entity, empty-but-redacted topics -> 'personal details'; title tokens that
appear redacted in panels -> ■■■. Redaction grammar comes from vc.redaction (shared/redaction.js).
"""

from __future__ import annotations

from typing import Any

BOOTH_TITLE = "Booth strip"
ENTITY_BUCKET = "personal details"


def echoes_entity(topic: str, texts: list[str]) -> bool:
    raise NotImplementedError("TODO(S2)")


def sanitize_strip(strip: dict[str, Any], *, booth: bool) -> dict[str, Any]:
    raise NotImplementedError("TODO(S2)")
