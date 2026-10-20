"""CREDITNEXUS AI — credit risk inference API.

FastAPI application factory. The trained model and optimized threshold are
loaded once during startup (lifespan); the service reports readiness via
/health and refuses to fabricate predictions if artifacts are unavailable.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .model_service import model_service
from .routes import health, model, predict
from .services.request_context import RequestContextMiddleware, configure_logging

logger = logging.getLogger("creditrisk.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(settings.log_level)
    logger.info("starting %s v%s", settings.service_name, settings.service_version)
    model_service.load()
    if model_service.ready:
        logger.info("service READY — serving predictions")
    else:
        logger.error("service DEGRADED — artifacts failed to load: %s", model_service.load_error)
    yield
    logger.info("shutting down %s", settings.service_name)


def create_app() -> FastAPI:
    app = FastAPI(
        title="CREDITNEXUS AI — Credit Risk API",
        description=(
            "Loan default risk inference for the CREDITNEXUS AI platform. "
            "Powered by a calibrated XGBoost model with an F1-optimized "
            "classification threshold. This is a model estimate, not a "
            "lending decision."
        ),
        version=settings.service_version,
        lifespan=lifespan,
    )

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    @app.get("/", tags=["meta"])
    def root() -> dict:
        return {
            "service": settings.service_name,
            "version": settings.service_version,
            "status": "ok" if model_service.ready else "degraded",
            "endpoints": ["/health", "/predict", "/model/info",
                          "/model/feature-importance", "/model/explain"],
        }

    app.include_router(health.router)
    app.include_router(predict.router)
    app.include_router(model.router)
    return app


app = create_app()
