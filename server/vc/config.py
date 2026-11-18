"""Runtime configuration from the environment. Secrets are read here and nowhere else, and never logged."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

_TRUE = re.compile(r"^(1|true|yes|on)$", re.IGNORECASE)


@dataclass(frozen=True)
class Config:
    deepgram_api_key: str
    anthropic_api_key: str
    session_secret: str | None  # random per boot if unset (tokens die on restart)
    port: int
    data_dir: Path
    audio_ttl_hours: float
    booth_mode: bool
    strip_ttl_hours: float  # booth strips; minimum one minute
    event_name: str
    agent_prompt: str | None
    mip_opt_out: bool  # Deepgram model-improvement opt-out on every Deepgram service
    max_sessions: int  # semaphore on concurrent bots per machine
    allowed_origins: tuple[str, ...]

    def __repr__(self) -> str:  # never print secrets
        return f"Config(port={self.port}, booth_mode={self.booth_mode}, event_name={self.event_name!r})"


def _flag(name: str, default: bool = False) -> bool:
    v = os.environ.get(name)
    return default if v is None or v == "" else bool(_TRUE.match(v))


def load_config(*, require_keys: bool = False) -> Config:
    """`require_keys=True` is what the bot path uses; HTTP-only tests run without keys."""
    dg = os.environ.get("DEEPGRAM_API_KEY", "")
    an = os.environ.get("ANTHROPIC_API_KEY", "")
    if require_keys and not (dg and an):
        raise RuntimeError("DEEPGRAM_API_KEY and ANTHROPIC_API_KEY are required (copy .env.example to .env)")
    return Config(
        deepgram_api_key=dg,
        anthropic_api_key=an,
        session_secret=os.environ.get("SESSION_SECRET") or None,
        port=int(os.environ.get("PORT", "8080")),
        data_dir=Path(os.environ.get("DATA_DIR", "data")).resolve(),
        audio_ttl_hours=float(os.environ.get("AUDIO_TTL_HOURS", "24")),
        booth_mode=_flag("BOOTH_MODE"),
        strip_ttl_hours=max(1 / 60, float(os.environ.get("STRIP_TTL_HOURS") or 2)),
        event_name=os.environ.get("EVENT_NAME") or "default",
        agent_prompt=os.environ.get("AGENT_PROMPT") or None,
        mip_opt_out=_flag("MIP_OPT_OUT"),
        max_sessions=int(os.environ.get("MAX_SESSIONS", "4")),
        allowed_origins=tuple(o for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o),
    )
