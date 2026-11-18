"""SQLite strips + WAV audio on the data volume (port of server/store.js, sqlite3 stdlib, WAL). Lane S2.

Schema (unchanged from the Node app so a data dir could be carried over):
  strips(id TEXT PK, created_at INT, title TEXT, body TEXT JSON, has_audio INT DEFAULT 0, booth INT DEFAULT 0)
  index strips_created(created_at); audio at {data_dir}/audio/{id}.wav
Limits: body 5 MB, ids 10-char base64url with -_ replaced by x.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal


class Store:
    def __init__(self, data_dir: Path) -> None:
        raise NotImplementedError("TODO(S2): open strips.db, PRAGMA journal_mode=WAL; synchronous=NORMAL")

    def save(self, strip: dict[str, Any], now_ms: int) -> str: ...
    def get(self, strip_id: str) -> dict[str, Any] | None: ...
    def attach_audio(self, strip_id: str, wav: bytes) -> Literal["ok", "missing", "booth"]: ...
    def audio_file(self, strip_id: str) -> Path | None: ...
    def purge_audio(self, ttl_ms: float) -> int: ...
    def purge_strips(self, booth_ttl_ms: float) -> int: ...
    def close(self) -> None: ...
