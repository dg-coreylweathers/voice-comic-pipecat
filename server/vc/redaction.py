"""Deepgram redaction-token grammar, read from shared/redaction.js so the server and the browser can never disagree.
The JS file stays the single source; this module extracts its String.raw pattern at import."""

import re

from vc.paths import SHARED_DIR

_JS = (SHARED_DIR / "redaction.js").read_text(encoding="utf-8")
_m = re.search(r"REDACTION_SOURCE = String\.raw`([^`]+)`", _JS)
if not _m:
    raise RuntimeError("shared/redaction.js: REDACTION_SOURCE not found")
REDACTION_SOURCE: str = _m.group(1)
REDACTION_RE = re.compile(REDACTION_SOURCE)


def has_redaction(text: str) -> bool:
    return bool(REDACTION_RE.search(text))
