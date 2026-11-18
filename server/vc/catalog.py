"""Loader for shared/catalog.json, the single source of truth for models, list prices, modes, scenes and Flux dials.

The JSON Schema (shared/catalog.schema.json) is the contract; these pydantic models mirror it and
tests/test_catalog.py checks both the file against the schema and the cross-references (defaults, diarizedKey).
Prices that are still `[fill from Claude docs]` load as `None` via `price()`.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from vc.paths import SHARED_DIR

PLACEHOLDER = "[fill from Claude docs]"
Money = float | Literal["[fill from Claude docs]"]


class _M(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True, frozen=True)


class ListenModel(_M):
    key: str
    family: Literal["flux", "nova"]
    version: Literal["v1", "v2"]
    model: str
    language: Literal["en", "multi"] | None = None
    label: str
    role: Literal["primary", "tap"]
    rate_per_min: float = Field(alias="ratePerMin")
    regular_per_min: float | None = Field(default=None, alias="regularPerMin")
    diarized_key: str | None = Field(default=None, alias="diarizedKey")
    blurb: str


class SpeakModel(_M):
    key: str
    family: Literal["flux", "aura"]
    version: Literal["v1", "v2"]
    model: str
    label: str
    rate_per_1k: float = Field(alias="ratePer1k")
    regular_per_1k: float | None = Field(default=None, alias="regularPer1k")


class Thinking(_M):
    type: Literal["disabled", "enabled", "between_tools", "adaptive"]
    budget_tokens: int | None = Field(default=None, alias="budgetTokens")


class LlmSettings(_M):
    effort: Literal["low", "medium", "high", "xhigh", "max"] | None
    thinking: Thinking | None
    max_tokens: int = Field(alias="maxTokens")


class TokenPrices(_M):
    input: Money
    output: Money
    cache_read: Money = Field(alias="cacheRead")
    cache_write_5m: Money = Field(alias="cacheWrite5m")


class ThinkModel(_M):
    key: str
    provider: Literal["anthropic"]
    model: str
    label: str
    tier: Literal["standard", "advanced"]
    llm: LlmSettings
    price_per_1m_tokens: TokenPrices = Field(alias="pricePer1MTokens")


class Mode(_M):
    key: str
    label: str
    short: str
    badges: list[str]
    blurb: str


class Experience(_M):
    key: Literal["agent", "duet"]
    label: str
    short: str
    badges: list[str] | None = None
    blurb: str


class Range(_M):
    min: float
    max: float
    step: float
    default: float


class FluxDials(_M):
    eot_threshold: Range = Field(alias="eotThreshold")
    eager_eot_threshold: Range = Field(alias="eagerEotThreshold")
    eot_timeout_ms: int = Field(alias="eotTimeoutMs")


class TierRate(_M):
    label: str
    promo: float
    regular: float


class Rates(_M):
    as_of: str = Field(alias="asOf")
    source: str
    promo_ends: str = Field(alias="promoEnds")
    agent_per_min_by_tier: dict[Literal["standard", "advanced"], TierRate] = Field(alias="agentPerMinByTier")
    redaction_per_min: float = Field(alias="redactionPerMin")
    keyterm_per_min: float = Field(alias="keytermPerMin")
    diarization_per_min: float = Field(default=0, alias="diarizationPerMin")
    llm_as_of: str = Field(alias="llmAsOf")
    llm_source: str = Field(alias="llmSource")


class Defaults(_M):
    listen: str
    speak: str
    think: str
    mode: str


class Catalog(_M):
    schema_ref: str | None = Field(default=None, alias="$schema")
    schema_version: Literal[1] = Field(alias="schemaVersion")
    listen: list[ListenModel]
    speak: list[SpeakModel]
    think: list[ThinkModel]
    modes: list[Mode]
    experiences: list[Experience]
    flux: FluxDials
    rates: Rates
    defaults: Defaults

    def find_listen(self, key: str) -> ListenModel | None:
        return next((m for m in self.listen if m.key == key), None)

    def find_speak(self, key: str) -> SpeakModel | None:
        return next((m for m in self.speak if m.key == key), None)

    def find_think(self, key: str) -> ThinkModel | None:
        return next((m for m in self.think if m.key == key), None)

    def find_mode(self, key: str) -> Mode | None:
        return next((m for m in self.modes if m.key == key), None)

    def tap_key_for(self, listen_key: str) -> str | None:
        """The Nova-3 twin that runs in the tap branch / duet for a primary listen key."""
        m = self.find_listen(listen_key)
        if m is None:
            return None
        return m.key if m.role == "tap" else m.diarized_key


def price(v: Money) -> float | None:
    """A catalog price, or None while it is still a placeholder."""
    return None if v == PLACEHOLDER else float(v)


def raw_catalog() -> dict[str, Any]:
    return json.loads((SHARED_DIR / "catalog.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_catalog() -> Catalog:
    return Catalog.model_validate(raw_catalog())


def public_catalog(*, event: str, booth_enabled: bool, transcript_ttl_hours: float) -> dict[str, Any]:
    """The GET /api/catalog body: the file as-is (camelCase) plus deployment facts. No prompt text, no secrets."""
    body = raw_catalog()
    body.pop("$schema", None)
    body["event"] = event
    body["booth"] = {"enabled": booth_enabled, "transcriptTtlHours": transcript_ttl_hours}
    return body
