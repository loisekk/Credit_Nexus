"""Shared fixtures — tests run against the REAL model artifacts."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SERVICE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_ROOT))

from app.main import app  # noqa: E402
from app.model_service import model_service  # noqa: E402


@pytest.fixture(scope="session")
def client() -> TestClient:
    model_service.load()
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def valid_sample() -> dict:
    return {
        "person_age": 30,
        "person_income": 55000.0,
        "person_home_ownership": "RENT",
        "person_emp_length": 4.0,
        "loan_intent": "PERSONAL",
        "loan_grade": "C",
        "loan_amnt": 10000.0,
        "loan_int_rate": 12.5,
        "loan_percent_income": 0.18,
        "cb_person_default_on_file": "N",
        "cb_person_cred_hist_length": 4,
    }
