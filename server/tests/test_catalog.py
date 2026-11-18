"""shared/catalog.json is valid, self-consistent, and loads into vc.catalog."""

import json
from typing import get_args

from jsonschema import Draft202012Validator

from vc.catalog import PLACEHOLDER, load_catalog, price, public_catalog, raw_catalog
from vc.paths import SHARED_DIR


def test_catalog_matches_schema():
    schema = json.loads((SHARED_DIR / "catalog.schema.json").read_text())
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(raw_catalog())


def test_cross_references():
    c = load_catalog()
    assert c.find_listen(c.defaults.listen) and c.find_listen(c.defaults.listen).role == "primary"
    assert c.find_speak(c.defaults.speak) and c.find_think(c.defaults.think) and c.find_mode(c.defaults.mode)
    for m in c.listen:
        if m.role == "primary":
            assert m.family == "flux", "only Flux owns turn detection, so only Flux may be primary"
            twin = c.find_listen(m.diarized_key or "")
            assert twin and twin.role == "tap", f"{m.key}: diarizedKey must name a tap model"
    assert {m.key for m in c.experiences} == {"agent", "duet"}
    assert len({m.key for m in c.listen + c.speak + c.think}) == len(c.listen) + len(c.speak) + len(c.think)
    d = c.flux
    assert d.eager_eot_threshold.default < d.eot_threshold.default


def test_think_models_are_tool_free_and_have_explicit_reasoning_settings():
    for t in load_catalog().think:
        assert (t.llm.effort is None) != (t.llm.thinking is None), f"{t.key}: set exactly one of effort / thinking"
        if t.model.startswith("claude-sonnet-5-5"):
            assert not (t.llm.thinking and t.llm.thinking.type == "disabled"), "Sonnet 5.5 rejects thinking=disabled"


def test_placeholder_prices_load_as_unknown():
    t = load_catalog().think[0]
    for v in (t.price_per_1m_tokens.input, t.price_per_1m_tokens.output):
        assert price(v) is None or price(v) >= 0
    assert price(PLACEHOLDER) is None and price(0.5) == 0.5


def test_public_catalog_adds_deployment_facts_only():
    body = public_catalog(event="booth", booth_enabled=True, transcript_ttl_hours=2)
    assert body["booth"] == {"enabled": True, "transcriptTtlHours": 2} and body["event"] == "booth"
    assert "$schema" not in body and "prompt" not in json.dumps(body).lower()


def test_protocol_vocab_is_not_in_catalog():
    from vc.protocol import PanelMood

    assert "neutral" in get_args(PanelMood)
