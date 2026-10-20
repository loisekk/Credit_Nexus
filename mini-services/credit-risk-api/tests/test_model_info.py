"""Model intelligence endpoints: info, feature importance, SHAP explain."""


def test_model_info_schema(client):
    body = client.get("/model/info").json()
    assert body["ready"] is True
    assert len(body["feature_schema"]) == 11
    names = [f["name"] for f in body["feature_schema"]]
    assert names[0] == "person_age" and names[-1] == "cb_person_cred_hist_length"
    # Categorical options come from the fitted encoder, not hardcoded guesses
    grades = next(f for f in body["feature_schema"] if f["name"] == "loan_grade")
    assert grades["options"] == ["A", "B", "C", "D", "E", "F", "G"]


def test_model_info_threshold_and_provenance(client):
    body = client.get("/model/info").json()
    assert body["threshold"]["value"] == pytest.approx(0.7158444761787314, abs=1e-9)
    assert "provenance" in body
    prov = body["provenance"]
    assert prov["artifact_kind"] == "rebuilt-estimator"
    assert prov["verification_vs_uploaded_array"]["pearson_correlation"] > 0.99999


def test_model_info_measured_vs_notebook_metrics_distinct(client):
    body = client.get("/model/info").json()
    assert "holdout_metrics_measured" in body["provenance"]
    assert "notebook_reported_metrics" in body["provenance"]


def test_feature_importance(client):
    body = client.get("/model/feature-importance").json()
    assert body["available"] is True
    features = body["features"]
    assert len(features) == 11
    shares = [f["share"] for f in features]
    assert sum(shares) == pytest.approx(1.0, abs=1e-6)
    assert all(0.0 <= s <= 1.0 for s in shares)
    # loan_grade + loan_int_rate must rank among the top features
    names_top5 = [f["feature"] for f in features[:5]]
    assert "loan_grade" in names_top5 and "loan_int_rate" in names_top5


def test_explain_local_shap(client, valid_sample):
    r = client.post("/model/explain", json=valid_sample)
    assert r.status_code == 200
    body = r.json()
    assert body["prediction"]["default_probability"] >= 0
    assert isinstance(body["base_value"], float)
    assert len(body["contributions"]) == 11
    contribs = {c["feature"]: c["contribution"] for c in body["contributions"]}
    assert all(isinstance(v, float) for v in contribs.values())
    assert "note" in body and "uncalibrated" in body["note"]


def test_explain_rejects_unknown_category(client, valid_sample):
    payload = dict(valid_sample, loan_grade="Z")
    r = client.post("/model/explain", json=payload)
    assert r.status_code == 422


import pytest  # noqa: E402  (used in approx above)
