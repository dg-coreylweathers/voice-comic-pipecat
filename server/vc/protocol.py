"""The vc.* app protocol as pydantic models. Mirror of shared/protocol.schema.json; every object $def there has a
class here with the SAME name and the same camelCase wire fields (tests/test_protocol_schema.py enforces it).

Server -> client: build a model, then `push_server_message(rtvi, msg)` in vc.pipeline.messages wraps
`msg.wire()` in an RTVIServerMessageFrame. Client -> server: `parse_client_message(type, data)` from the
RTVIProcessor `on_client_message` handler. SessionConfig arrives once, in the `cfg` query param.
"""

from __future__ import annotations

import base64
import json
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter
from pydantic.alias_generators import to_camel

PROTOCOL_VERSION = 1

Key = Annotated[str, Field(pattern=r"^[a-z0-9-]{1,40}$")]
PanelId = Annotated[str, Field(max_length=64)]
Keyterm = Annotated[str, Field(min_length=1, max_length=40)]
PanelMood = Literal["neutral", "happy", "smug", "laughing", "surprised", "thinking", "upset"]
PanelSfx = Literal["POW", "BOING", "HA HA", "WOW!", "ZAP", "HMM", "DING"]
Experience = Literal["agent", "duet"]


class Wire(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)

    def wire(self) -> dict[str, Any]:
        """JSON-ready dict with camelCase keys, unset optionals dropped."""
        return self.model_dump(by_alias=True, exclude_none=True, mode="json")


# ---- shared shapes -------------------------------------------------------------


class Word(Wire):
    word: str
    start: float
    end: float
    confidence: float | None = None
    speaker: Annotated[int, Field(ge=0)] | None = None


class FluxDialValues(Wire):
    eot_threshold: Annotated[float, Field(ge=0.5, le=0.9)] | None = None
    eager_eot_threshold: Annotated[float, Field(ge=0.3, le=0.9)] | None = None


class SessionConfig(Wire):
    experience: Experience
    listen_key: Key
    speak_key: Key
    think_key: Key
    mode_key: Key
    keyterms: Annotated[list[Keyterm], Field(max_length=20)]
    redact: bool
    speakers: bool
    quiet: bool
    flux: FluxDialValues | None = None

    @classmethod
    def from_query(cls, cfg: str) -> SessionConfig:
        """Decode the base64url JSON `cfg` query parameter of WS /api/agent."""
        pad = "=" * (-len(cfg) % 4)
        return cls.model_validate(json.loads(base64.urlsafe_b64decode(cfg + pad)))


class PipelineStage(Wire):
    name: str
    cls: str
    branch: Literal["main", "nova", "switcher", "observer"]
    model: str | None = None
    active: bool | None = None
    settings: dict[str, Any] | None = None


class ConfigChange(Wire):
    field: str
    frame: str
    live: bool


class TokenUsage(Wire):
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    calls: int = 0
    withdrawn_calls: int = 0


class TierMs(Wire):
    standard: int | None = None
    advanced: int | None = None


class TtsFamilyChars(Wire):
    flux: int = 0
    aura: int = 0


class UsageReport(Wire):
    experience: Experience
    connected_at: int
    disconnected_at: int | None = None
    connected_ms: int = 0
    connected_ms_by_tier: TierMs = Field(default_factory=TierMs)
    stt_seconds_by_key: dict[str, float] = Field(default_factory=dict)
    redact_seconds: float = 0
    keyterm_seconds: float = 0
    tts_chars_by_key: dict[str, int] = Field(default_factory=dict)
    tts_chars_by_family: TtsFamilyChars = Field(default_factory=TtsFamilyChars)
    llm_by_key: dict[str, TokenUsage] = Field(default_factory=dict)
    server: Literal[True] = True


class LatencyPart(Wire):
    key: str
    label: str
    owner: str
    ms: Annotated[float, Field(ge=0)]


# ---- server -> client ----------------------------------------------------------


class VcSession(Wire):
    type: Literal["vc.session"] = "vc.session"
    id: str
    protocol_version: Literal[1] = PROTOCOL_VERSION
    experience: Experience
    config: SessionConfig
    pipeline: list[PipelineStage]


class VcConfig(Wire):
    type: Literal["vc.config"] = "vc.config"
    config: SessionConfig
    changes: list[ConfigChange]
    pipeline: list[PipelineStage]


class VcTurn(Wire):
    type: Literal["vc.turn"] = "vc.turn"
    panel_id: PanelId
    epoch: Annotated[int, Field(ge=0)]
    turn_index: Annotated[int, Field(ge=0)]
    event: Literal["StartOfTurn", "Update", "EagerEndOfTurn", "TurnResumed", "EndOfTurn"]
    transcript: str
    words: list[Word]
    end_of_turn_confidence: float | None = None
    languages: list[str] | None = None
    model: str


class VcEager(Wire):
    type: Literal["vc.eager"] = "vc.eager"
    panel_id: PanelId
    phase: Literal["predicted", "withdrawn", "released"]
    transcript: str | None = None
    reason: Literal["turn_resumed", "cancelled", "timeout"] | None = None
    held_ms: Annotated[float, Field(ge=0)] | None = None


class VcLayer(Wire):
    type: Literal["vc.layer"] = "vc.layer"
    panel_id: PanelId
    key: Key
    model: str
    is_final: bool
    speech_final: bool | None = None
    transcript: str
    words: list[Word]
    speaker: Annotated[int, Field(ge=0)] | None = None
    redacted: bool


class VcLayerStatus(Wire):
    type: Literal["vc.layer.status"] = "vc.layer.status"
    state: Literal["open", "closed", "error"]
    key: Key | None = None
    model: str | None = None
    redact: list[str] | None = None
    diarize: bool | None = None
    message: str | None = None


class VcIntel(Wire):
    type: Literal["vc.intel"] = "vc.intel"
    panel_id: PanelId
    topics: Annotated[list[str], Field(max_length=3)]
    intents: Annotated[list[str], Field(max_length=3)]
    sentiment: Literal["positive", "neutral", "negative"] | None = None
    score: float | None = None


class VcPanel(Wire):
    type: Literal["vc.panel"] = "vc.panel"
    assistant_turn: Annotated[int, Field(ge=1)]
    at: Annotated[int, Field(ge=0)]
    mood: PanelMood
    sfx: PanelSfx | None = None
    caption: Annotated[str, Field(max_length=40)] | None = None


class VcLatency(Wire):
    type: Literal["vc.latency"] = "vc.latency"
    assistant_turn: Annotated[int, Field(ge=1)]
    ms: Annotated[float, Field(ge=0)]
    from_: Literal["flux_end_of_turn", "typed_line"] = Field(alias="from")
    eager: bool | None = None


class VcLatencyBreakdown(Wire):
    type: Literal["vc.latency.breakdown"] = "vc.latency.breakdown"
    assistant_turn: Annotated[int, Field(ge=1)]
    total_ms: Annotated[float, Field(ge=0)]
    user_turn_ms: Annotated[float, Field(ge=0)] | None = None
    parts: list[LatencyPart]


class VcUsage(Wire):
    type: Literal["vc.usage"] = "vc.usage"
    usage: UsageReport


class VcError(Wire):
    type: Literal["vc.error"] = "vc.error"
    message: str
    source: str | None = None
    fatal: bool | None = None


ServerMessage = Annotated[
    VcSession
    | VcConfig
    | VcTurn
    | VcEager
    | VcLayer
    | VcLayerStatus
    | VcIntel
    | VcPanel
    | VcLatency
    | VcLatencyBreakdown
    | VcUsage
    | VcError,
    Field(discriminator="type"),
]


# ---- client -> server ----------------------------------------------------------


class VcUpdate(Wire):
    type: Literal["vc.update"] = "vc.update"
    listen_key: Key | None = None
    speak_key: Key | None = None
    think_key: Key | None = None
    mode_key: Key | None = None
    keyterms: Annotated[list[Keyterm], Field(max_length=20)] | None = None
    redact: bool | None = None
    speakers: bool | None = None
    flux: FluxDialValues | None = None


class VcSay(Wire):
    type: Literal["vc.say"] = "vc.say"
    id: Annotated[str, Field(pattern=r"^k-[A-Za-z0-9-]{1,40}$")]
    text: Annotated[str, Field(min_length=1, max_length=400)]


class VcReset(Wire):
    type: Literal["vc.reset"] = "vc.reset"
    quiet: bool | None = None


ClientMessage = Annotated[VcUpdate | VcSay | VcReset, Field(discriminator="type")]

_server_adapter: TypeAdapter[Any] = TypeAdapter(ServerMessage)
_client_adapter: TypeAdapter[Any] = TypeAdapter(ClientMessage)

# Classes by schema $def name, for the parity test and for tooling.
MODELS: dict[str, type[Wire]] = {
    c.__name__: c
    for c in (
        Word,
        FluxDialValues,
        SessionConfig,
        PipelineStage,
        ConfigChange,
        TokenUsage,
        UsageReport,
        LatencyPart,
        VcSession,
        VcConfig,
        VcTurn,
        VcEager,
        VcLayer,
        VcLayerStatus,
        VcIntel,
        VcPanel,
        VcLatency,
        VcLatencyBreakdown,
        VcUsage,
        VcError,
        VcUpdate,
        VcSay,
        VcReset,
    )
}


def parse_client_message(msg_type: str, data: dict[str, Any] | None) -> VcUpdate | VcSay | VcReset:
    """RTVI client-message (type, data) -> model. Raises pydantic.ValidationError on anything else; the caller
    answers with VcError and drops it (any non-vc.* type is rejected, as the Node proxy did)."""
    return _client_adapter.validate_python({**(data or {}), "type": msg_type})


def parse_server_message(payload: dict[str, Any]) -> Wire:
    """Used by tests and the live harness to validate what the bot sent."""
    return _server_adapter.validate_python(payload)
