"""Shared fixtures. Unit tests never need API keys and never touch the network."""

import json

import pytest

from vc.paths import SHARED_DIR


@pytest.fixture(scope="session")
def protocol_schema() -> dict:
    return json.loads((SHARED_DIR / "protocol.schema.json").read_text())


@pytest.fixture(scope="session")
def protocol_examples() -> dict:
    return json.loads((SHARED_DIR / "protocol.examples.json").read_text())
