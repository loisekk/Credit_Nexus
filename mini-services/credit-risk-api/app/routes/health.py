from __future__ import annotations

from fastapi import APIRouter

from ..model_service import model_service

router = APIRouter(tags=["health"])


@router.get("/health", summary="Service readiness and model-loaded status")
def health() -> dict:
    return model_service.health()
