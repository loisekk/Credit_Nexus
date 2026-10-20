"""Request context: request IDs + structured logging. Never logs payloads."""
from __future__ import annotations

import json
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attaches an X-Request-ID and emits one structured JSON log per request.

    Applicant data is treated as sensitive: request bodies are never read or
    logged here — only method, path, status and latency.
    """

    def __init__(self, app, service_name: str = "credit-risk-api") -> None:
        super().__init__(app)
        self.logger = logging.getLogger("creditrisk.http")

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:  # noqa: BLE001
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            self.logger.error(
                json.dumps({
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": 500,
                    "duration_ms": duration_ms,
                    "event": "request_failed",
                })
            )
            raise
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        self.logger.info(
            json.dumps({
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
                "event": "request_completed",
            })
        )
        return response


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )
