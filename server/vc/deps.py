"""The seams between lanes. S2 (HTTP) builds these objects in app.py; S1 (pipeline) consumes them in run_bot.
Change a signature here only with both lane owners' agreement: it is the contract, not an implementation."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Protocol

import aiohttp

from vc.catalog import Catalog
from vc.config import Config
from vc.protocol import UsageReport


@dataclass(frozen=True)
class ThemeTurn:
    """One finished visitor turn for the themes tally. Text is matched against the taxonomy, then forgotten."""

    text: str
    topics: list[str]
    intents: list[str]
    sentiment: float | None
    redacted: bool  # redaction or booth was on: entity-like topics are filtered/bucketed


class ThemesSink(Protocol):
    """Implemented by vc.themes.Themes (S2). Called by the themes_intel processor (S1), never on the audio path."""

    def record(self, event: str, turn: ThemeTurn) -> None: ...


class PromptBook(Protocol):
    """Implemented by vc.prompts (S2). Prompt text lives only there."""

    def prompt_for(self, mode: str, *, redact: bool, experience: str = "agent") -> str: ...

    def greeting_for(self, mode: str) -> str: ...


class UsageRegistry(Protocol):
    """Implemented by vc.sessions.Sessions (S1). Server-metered usage by session id, 2 h TTL.
    POST /api/strips (S2) replaces the client's usage with `get(sessionId)` when present."""

    def put(self, session_id: str, usage: UsageReport) -> None: ...

    def get(self, session_id: str) -> UsageReport | None: ...


@dataclass(frozen=True)
class BotDeps:
    config: Config
    catalog: Catalog
    prompts: PromptBook
    themes: ThemesSink
    usage: UsageRegistry
    http: aiohttp.ClientSession  # shared, created on app startup; /v1/read goes through it
    slots: asyncio.Semaphore  # Config.max_sessions concurrent bots per machine
