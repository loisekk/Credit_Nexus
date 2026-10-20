"""POST /predict — the original inference contract, hardened.

Response shape is identical to the original backend:
    {default_probability, default_prediction, threshold, Result}
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request, status

from ..model_service import ModelNotReadyError, model_service
from ..schemas import CATEGORICAL_FIELDS, CreditRiskInput, PredictionResult

router = APIRouter(tags=["predict"])
logger = logging.getLogger("creditrisk.predict")


@router.post(
    "/predict",
    response_model=PredictionResult,
    summary="Predict loan default risk for one applicant",
    responses={
        422: {"description": "Invalid input (missing fields, bad types, unknown categories)"},
        503: {"description": "Model artifacts not loaded"},
        500: {"description": "Inference failure"},
    },
)
def predict(payload: CreditRiskInput, request: Request) -> dict:
    data = payload.model_dump()

    # Categorical validation against the categories the model actually learned.
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
        result = model_service.predict(data)
    except ModelNotReadyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error_code": "MODEL_NOT_READY",
                "message": "The prediction service is not ready. Please retry shortly.",
                "reason": str(exc),
            },
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 — generic to client, detailed in logs
        request_id = getattr(request.state, "request_id", None)
        logger.exception("inference failed (request_id=%s)", request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error_code": "INFERENCE_FAILED",
                "message": "The prediction could not be computed. The failure was logged.",
                "request_id": request_id,
            },
        ) from exc

    logger.info(
        "prediction served (request_id=%s, probability=%.4f, class=%d)",
        getattr(request.state, "request_id", None),
        result["default_probability"],
        result["default_prediction"],
    )
    return result
