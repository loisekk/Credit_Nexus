"""Health endpoint behavior."""


def test_health_ready(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["ready"] is True
    assert body["model_loaded"] is True
    assert body["threshold_loaded"] is True
    assert body["load_error"] is None


def test_health_leaks_no_paths_or_tracebacks(client):
    body = client.get("/health").json()
    serialized = str(body)
    assert "/" not in serialized or "home" not in serialized.lower()
    assert "Traceback" not in serialized


def test_root_service_descriptor(client):
    body = client.get("/").json()
    assert body["service"] == "credit-risk-api"
    assert "/predict" in body["endpoints"]
