"""Server-owned prompt profiles (port of server/prompts.js) plus the panel-tag instructions. Lane S2.
Implements vc.deps.PromptBook. Prompt text never leaves this file and never reaches the browser.

Changes from the Node app:
- BASE no longer claims the Voice Agent API: "Deepgram Flux speech-to-text and Flux text-to-speech, with Claude,
  orchestrated by Pipecat". AGENT_PROMPT env still overrides BASE.
- factSheet() reads vc.catalog (shared/catalog.json); it must say "price pending" for any placeholder price,
  never invent one.
- PANEL_TAG_INSTRUCTIONS (beat 3) is appended in every agent mode: at the very start of each reply Claude writes
  exactly one tag `<panel mood="..." sfx="..." caption="..."/>` with mood from vc.protocol.PanelMood, optional sfx
  from PanelSfx, optional caption <= 40 chars, then the spoken reply. Build the allowed values from the Literal
  types (typing.get_args) so prompt and protocol cannot drift. No tools, ever.
- PRIVACY_PROMPT appended while Redact is on (Flux primary still feeds Claude unredacted text, as before).
"""

from __future__ import annotations

PRIVACY_PROMPT = (
    "Redaction is on. Never repeat names, company names, phone numbers, emails, addresses, card numbers or other "
    'personal details the visitor says, even if asked to. Refer to them generically, for example "your number" or '
    '"your company".'
)


def fact_sheet() -> str:
    raise NotImplementedError("TODO(S2)")


def panel_tag_instructions() -> str:
    raise NotImplementedError("TODO(S2): from typing.get_args(PanelMood) / get_args(PanelSfx)")


def prompt_for(mode: str, *, redact: bool, experience: str = "agent") -> str:
    raise NotImplementedError("TODO(S2)")


def greeting_for(mode: str) -> str:
    raise NotImplementedError("TODO(S2)")
