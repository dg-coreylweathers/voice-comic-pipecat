"""Contract test: shared/protocol.schema.json <-> vc/protocol.py <-> shared/protocol.examples.json.
web/src/lib/protocol.test.ts runs the same checks against the TypeScript side."""

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from vc import protocol as p

# UsageReport totals start at zero/empty by design; everything else the schema requires the model requires.
_TOTALS = {
    "connectedMs",
    "connectedMsByTier",
    "sttSecondsByKey",
    "redactSeconds",
    "keytermSeconds",
    "ttsCharsByKey",
    "ttsCharsByFamily",
    "llmByKey",
    "inputTokens",
    "outputTokens",
    "cacheReadTokens",
    "cacheWriteTokens",
    "calls",
    "withdrawnCalls",
}


def _object_defs(schema: dict) -> dict[str, dict]:
    return {k: v for k, v in schema["$defs"].items() if v.get("type") == "object"}


def test_schema_is_valid(protocol_schema):
    Draft202012Validator.check_schema(protocol_schema)
    assert protocol_schema["protocolVersion"] == p.PROTOCOL_VERSION


def test_every_object_def_has_a_model_with_the_same_wire_fields(protocol_schema):
    defs = _object_defs(protocol_schema)
    assert set(defs) == set(p.MODELS), "schema $defs and vc.protocol.MODELS must name the same objects"
    for name, d in defs.items():
        js = p.MODELS[name].model_json_schema(by_alias=True)
        assert set(js["properties"]) == set(d["properties"]), f"{name}: field names differ"
        assert set(js.get("required", [])) - {"type"} <= set(d.get("required", [])), f"{name}: model requires more"
        # Fields the schema requires may default on the model only when the default is always a valid value
        # (empty totals, consts); anything else must be required on the model too.
        defaulted = {f.alias or n for n, f in p.MODELS[name].model_fields.items() if not f.is_required()}
        optional_in_schema = set(d["properties"]) - set(d.get("required", []))
        assert defaulted - {"type", "protocolVersion", "server"} - optional_in_schema <= _TOTALS, (
            f"{name}: schema requires a field the model lets default silently"
        )


def _validator(protocol_schema, ref: str):
    sub = {"$ref": f"#/$defs/{ref}", "$defs": protocol_schema["$defs"]}
    return Draft202012Validator(sub)


@pytest.mark.parametrize("side,ref,parse", [("server", "ServerMessage", p.parse_server_message)])
def test_server_examples(protocol_schema, protocol_examples, side, ref, parse):
    v = _validator(protocol_schema, ref)
    for ex in protocol_examples[side]:
        v.validate(ex)
        assert parse(ex).wire() == ex, f"round trip changed {ex['type']}"


def test_client_examples(protocol_schema, protocol_examples):
    v = _validator(protocol_schema, "ClientMessage")
    for ex in protocol_examples["client"]:
        v.validate(ex)
        m = p.parse_client_message(ex["type"], {k: val for k, val in ex.items() if k != "type"})
        assert m.wire() == ex


def test_session_config_query_round_trip(protocol_schema, protocol_examples):
    import base64
    import json

    cfg = protocol_examples["sessionConfig"]
    _validator(protocol_schema, "SessionConfig").validate(cfg)
    q = base64.urlsafe_b64encode(json.dumps(cfg).encode()).decode().rstrip("=")
    assert p.SessionConfig.from_query(q).wire() == cfg


def test_rejects_unknown_client_type_and_extra_fields():
    with pytest.raises(ValidationError):
        p.parse_client_message("Settings", {"agent": {}})
    with pytest.raises(ValidationError):
        p.parse_client_message("vc.update", {"experience": "duet"})  # scene change is a new connection
    with pytest.raises(ValidationError):
        p.parse_client_message("vc.say", {"id": "bad id", "text": "x"})
    with pytest.raises(ValidationError):
        p.parse_client_message("vc.say", {"id": "k-1", "text": "x" * 401})
