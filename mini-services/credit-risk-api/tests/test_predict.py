"""Prediction endpoint: contract, validation, threshold logic, failures."""
import copy

import pytest


def test_predict_valid_response_shape(client, valid_sample):
    r = client.post("/predict", json=valid_sample)
    assert r.status_code == 200
    body = r.json()
    # Exact original contract keys
    assert set(body.keys()) == {
        "default_probability", "default_prediction", "threshold", "Result"
    }
    assert isinstance(body["default_probability"], float)
    assert 0.0 <= body["default_probability"] <= 1.0
    assert body["default_prediction"] in (0, 1)
    assert 0.0 <= body["threshold"] <= 1.0
    assert body["Result"] in ("High risk", "Low risk")


def test_predict_threshold_classification_rule(client, valid_sample):
    body = client.post("/predict", json=valid_sample).json()
    expected = 1 if body["default_probability"] >= body["threshold"] else 0
    assert body["default_prediction"] == expected
    assert body["Result"] == ("High risk" if expected == 1 else "Low risk")


def test_predict_is_deterministic(client, valid_sample):
    a = client.post("/predict", json=valid_sample).json()
    b = client.post("/predict", json=valid_sample).json()
    assert a == b


@pytest.mark.parametrize("field", [
    "person_age", "person_income", "person_home_ownership", "person_emp_length",
    "loan_intent", "loan_grade", "loan_amnt", "loan_int_rate",
    "loan_percent_income", "cb_person_default_on_file", "cb_person_cred_hist_length",
])
def test_predict_missing_fields_rejected(client, valid_sample, field):
    payload = copy.deepcopy(valid_sample)
    del payload[field]
    r = client.post("/predict", json=payload)
    assert r.status_code == 422


@pytest.mark.parametrize("field,bad_value", [
    ("person_age", -5),            # impossible age
    ("person_age", 500),           # impossible age
    ("person_income", -1000),      # negative income
    ("person_emp_length", -1),     # negative employment
    ("loan_amnt", 0),              # zero loan
    ("loan_int_rate", -3),         # negative rate
    ("loan_percent_income", 5),    # > 1 fraction
    ("cb_person_cred_hist_length", -2),
    ("person_age", "thirty"),      # wrong type
])
def test_predict_invalid_numeric_values_rejected(client, valid_sample, field, bad_value):
    payload = copy.deepcopy(valid_sample)
    payload[field] = bad_value
    r = client.post("/predict", json=payload)
    assert r.status_code == 422


@pytest.mark.parametrize("field,bad_value", [
    ("person_home_ownership", "CASTLE"),
    ("loan_intent", "WEDDING"),
    ("loan_grade", "Z"),
    ("cb_person_default_on_file", "MAYBE"),
])
def test_predict_unknown_categories_rejected_with_options(client, valid_sample, field, bad_value):
    payload = copy.deepcopy(valid_sample)
    payload[field] = bad_value
    r = client.post("/predict", json=payload)
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["error_code"] == "INVALID_CATEGORY"
    assert detail["field"] == field
    assert isinstance(detail["valid_options"], list) and detail["valid_options"]


def test_predict_risk_ordering_two_profiles(client, valid_sample):
    """A strongly risky profile must not score lower than a strong profile."""
    strong = copy.deepcopy(valid_sample)
    strong.update({
        "person_income": 120000.0, "loan_grade": "A", "loan_int_rate": 6.0,
        "loan_percent_income": 0.05, "cb_person_default_on_file": "N",
        "loan_amnt": 5000.0, "person_emp_length": 10.0,
    })
    risky = copy.deepcopy(valid_sample)
    risky.update({
        "person_income": 12000.0, "loan_grade": "G", "loan_int_rate": 22.0,
        "loan_percent_income": 0.75, "cb_person_default_on_file": "Y",
        "loan_amnt": 30000.0,
    })
    p_strong = client.post("/predict", json=strong).json()["default_probability"]
    p_risky = client.post("/predict", json=risky).json()["default_probability"]
    assert p_risky > p_strong


def test_request_id_header_present(client, valid_sample):
    r = client.post("/predict", json=valid_sample)
    assert r.headers.get("x-request-id")


def test_model_not_ready_returns_503(monkeypatch, valid_sample):
    from app.routes import predict as predict_route

    class FakeNotReady:
        learned_categories = {}
        ready = False

        def predict(self, _):
            from app.model_service import ModelNotReadyError
            raise ModelNotReadyError("artifacts not loaded")

    monkeypatch.setattr(predict_route, "model_service", FakeNotReady())
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.post("/predict", json=valid_sample)
        assert r.status_code == 503
        assert r.json()["detail"]["error_code"] == "MODEL_NOT_READY"
