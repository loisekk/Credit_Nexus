"""Model intelligence endpoints: verified metadata, feature importance, SHAP."""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request, status

from ..model_service import ModelNotReadyError, model_service
from ..schemas import CATEGORICAL_FIELDS, CreditRiskInput

router = APIRouter(prefix="/model", tags=["model"])
logger = logging.getLogger("creditrisk.model_routes")


@router.get("/info", summary="Verified model metadata, schema, provenance and metrics")
def model_info() -> dict:
    try:
        return model_service.info()
    except ModelNotReadyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error_code": "MODEL_NOT_READY", "message": str(exc)},
        ) from exc


@router.get(
    "/feature-importance",
    summary="Gain-based feature importance from the fitted XGBoost",
)
def feature_importance() -> dict:
    try:
        return model_service.feature_importance()
    except ModelNotReadyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error_code": "MODEL_NOT_READY", "message": str(exc)},
        ) from exc


@router.post(
    "/explain",
    summary="Local SHAP explanation for one applicant (notebook methodology)",
)
def explain(payload: CreditRiskInput, request: Request) -> dict:
    data = payload.model_dump()
    for field in CATEGORICAL_FIELDS:
        value = data[field]
        options = model_service.learned_categories.get(field)
        if options and value not in options:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "INVALID_CATEGORY",
                    "field": field,
                    "message": f"'{value}' is not a category the model was trained on.",
                    "valid_options": options,
                },
            )
    try:
        return model_service.explain(data)
    except ModelNotReadyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"error_code": "MODEL_NOT_READY", "message": str(exc)},
        ) from exc
    except Exception as exc:  # noqa: BLE001
        request_id = getattr(request.state, "request_id", None)
        logger.exception("explanation failed (request_id=%s)", request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "EXPLANATION_FAILED",
                "message": "The explanation could not be computed. The failure was logged.",
                "request_id": request_id,
            },
        ) from exc
