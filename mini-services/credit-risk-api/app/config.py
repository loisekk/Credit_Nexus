"""Application configuration loaded from environment variables."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # mini-services/credit-risk-api


def _parse_origins(raw: str) -> list[str]:
    return [o.strip() for o in raw.split(",") if o.strip()]


class Settings:
    """Immutable runtime settings. Values are read once at import time."""

    def __init__(self) -> None:
        self.service_name: str = os.getenv("SERVICE_NAME", "credit-risk-api")
        self.service_version: str = "1.0.0"

        # Artifact locations. Defaults keep the original file names so a
        # correctly re-exported artifact can simply replace the file in place.
        self.artifacts_dir: Path = Path(
            os.getenv("MODEL_ARTIFACTS_DIR", str(BASE_DIR / "artifacts"))
        )
        self.model_path: Path = Path(
            os.getenv("MODEL_PATH", str(self.artifacts_dir / "credit_risk_model.pkl"))
        )
        self.threshold_path: Path = Path(
            os.getenv("THRESHOLD_PATH", str(self.artifacts_dir / "best_threshold.pkl"))
        )
        self.provenance_path: Path = Path(
            os.getenv("PROVENANCE_PATH", str(self.artifacts_dir / "provenance.json"))
        )
        self.aux_explainer_path: Path = Path(
            os.getenv(
                "AUX_EXPLAINER_PATH",
                str(self.artifacts_dir / "xg_model_aux_explainer.pkl"),
            )
        )

        # CORS: explicitly configured origins only (never wildcard in production).
        default_origins = "http://localhost:3000,http://127.0.0.1:3000"
        self.cors_allow_origins: list[str] = _parse_origins(
            os.getenv("CORS_ALLOW_ORIGINS", default_origins)
        )
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()


settings = Settings()
