"""What the scaffold guarantees: health, JSON 404 under /api, SPA fallback when a build exists."""

from fastapi.testclient import TestClient

from vc.app import create_app


def test_health_and_api_404():
    c = TestClient(create_app())
    r = c.get("/health")
    assert r.status_code == 200 and r.json()["ok"] is True
    r = c.get("/api/definitely-not-a-route")
    assert r.status_code == 404 and r.json() == {"error": "not_found"}


def test_config_repr_hides_secrets(monkeypatch):
    from vc.config import load_config

    monkeypatch.setenv("DEEPGRAM_API_KEY", "dg-secret-value")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "an-secret-value")
    assert "secret" not in repr(load_config())
