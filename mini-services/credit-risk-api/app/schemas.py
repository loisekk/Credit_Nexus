"""Pydantic request/response schemas for the credit risk API.

The request model preserves the field names, order and types of the original
backend contract (upload/main.py) exactly. Numeric bounds below are *safety*
bounds chosen to reject impossible values (negative ages, infinite rates,
malformed magnitudes) — they are intentionally looser than the model's
training distribution; out-of-distribution guidance is the frontend's job.
"""
from __future__ import annotations

import math
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Fallback categorical options, verified from the fitted OneHotEncoder inside
# the serving pipeline (see model_service.learned_categories). Used only when
# the pipeline cannot be introspected; /model/info always serves live values.
CATEGORICAL_FALLBACK: dict[str, list[str]] = {
    "person_home_ownership": ["MORTGAGE", "OTHER", "OWN", "RENT"],
    "loan_intent": [
        "DEBTCONSOLIDATION", "EDUCATION", "HOMEIMPROVEMENT",
        "MEDICAL", "PERSONAL", "VENTURE",
    ],
    "loan_grade": ["A", "B", "C", "D", "E", "F", "G"],
    "cb_person_default_on_file": ["N", "Y"],
}

CATEGORICAL_FIELDS = (
    "person_home_ownership",
    "loan_intent",
    "loan_grade",
    "cb_person_default_on_file",
)

FEATURE_ORDER: list[str] = [
    "person_age",
    "person_income",
    "person_home_ownership",
    "person_emp_length",
    "loan_intent",
    "loan_grade",
    "loan_amnt",
    "loan_int_rate",
    "loan_percent_income",
    "cb_person_default_on_file",
    "cb_person_cred_hist_length",
]


class CreditRiskInput(BaseModel):
    """Applicant features — identical contract to the original /predict."""

    person_age: int = Field(ge=18, le=120, description="Applicant age in years")
    person_income: float = Field(gt=0, le=10_000_000, description="Annual income")
    person_home_ownership: str = Field(description="Home ownership status")
    person_emp_length: float = Field(ge=0, le=80, description="Employment length in years")
    loan_intent: str = Field(description="Purpose of the loan")
    loan_grade: str = Field(description="Loan grade (A best … G worst)")
    loan_amnt: float = Field(gt=0, le=1_000_000, description="Requested loan amount")
    loan_int_rate: float = Field(ge=0, le=100, description="Interest rate (%)")
    loan_percent_income: float = Field(ge=0, le=1, description="Loan amount / income")
    cb_person_default_on_file: str = Field(description="Historical default on file (Y/N)")
    cb_person_cred_hist_length: int = Field(ge=0, le=80, description="Credit history length in years")

    @field_validator(
        "person_income", "person_emp_length", "loan_amnt",
        "loan_int_rate", "loan_percent_income",
        mode="after",
    )
    @classmethod
    def _must_be_finite(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("value must be finite (NaN/Infinity rejected)")
        return v

    @field_validator("person_home_ownership", "loan_intent", "loan_grade",
                     "cb_person_default_on_file", mode="before")
    @classmethod
    def _strip_strings(cls, v):
        if isinstance(v, str):
            return v.strip()
        return v


class PredictionResult(BaseModel):
    """Response contract — byte-for-byte the original shape."""

    default_probability: float
    default_prediction: Literal[0, 1]
    threshold: float
    Result: Literal["High risk", "Low risk"]


class ServiceError(BaseModel):
    detail: str
    error_code: str
    request_id: str | None = None
