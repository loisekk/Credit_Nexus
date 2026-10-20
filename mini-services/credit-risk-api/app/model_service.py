"""Model artifact lifecycle: load, validate, serve predictions, introspect.

Hard guarantees implemented here:
- The estimator artifact is validated to expose `predict_proba` before the
  service reports ready (guards against the original notebook bug where a
  probability array was saved instead of the model).
- The threshold artifact is validated to be a scalar in [0, 1].
- Predictions always flow through the loaded estimator — there is no
  fallback/dummy path. If the model is unavailable the service degrades to
  an explicit "not ready" state instead of inventing results.
- The classification rule is exactly the original one:
      predicted_class = 1 if default_probability >= threshold else 0
"""
from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any

import joblib
import numpy as np
import pandas as pd

from .config import settings
from .schemas import CATEGORICAL_FALLBACK, FEATURE_ORDER

logger = logging.getLogger("creditrisk.model")

# Training-distribution reference (from the development notebook), used purely
# for informational endpoints — never to reject requests.
TRAINING_RANGES: dict[str, dict[str, float]] = {
    "person_age": {"min": 18.0, "max": 100.0},
    "person_income": {"min": 4000.0, "max": 6_000_000.0},
    "person_emp_length": {"min": 0.0, "max": 60.0},
    "loan_amnt": {"min": 500.0, "max": 35000.0},
    "loan_int_rate": {"min": 5.42, "max": 23.22},
    "loan_percent_income": {"min": 0.0, "max": 0.83},
    "cb_person_cred_hist_length": {"min": 2.0, "max": 30.0},
}

NUMERIC_FIELDS = [
    "person_age", "person_income", "person_emp_length", "loan_amnt",
    "loan_int_rate", "loan_percent_income", "cb_person_cred_hist_length",
]

FIELD_LABELS = {
    "person_age": "Age",
    "person_income": "Annual income",
    "person_home_ownership": "Home ownership",
    "person_emp_length": "Employment length (years)",
    "loan_intent": "Loan intent",
    "loan_grade": "Loan grade",
    "loan_amnt": "Loan amount",
    "loan_int_rate": "Interest rate (%)",
    "loan_percent_income": "Loan-to-income ratio",
    "cb_person_default_on_file": "Historical default on file",
    "cb_person_cred_hist_length": "Credit history length (years)",
}

FIELD_DESCRIPTIONS = {
    "person_age": "Applicant age in years.",
    "person_income": "Applicant annual income.",
    "person_home_ownership": "Whether the applicant rents, owns, or holds a mortgage.",
    "person_emp_length": "How long the applicant has been employed, in years.",
    "loan_intent": "Stated purpose of the loan.",
    "loan_grade": "Credit grade of the loan (A is best, G is worst).",
    "loan_amnt": "Requested loan amount.",
    "loan_int_rate": "Interest rate of the loan in percent.",
    "loan_percent_income": "Loan amount as a fraction of annual income.",
    "cb_person_default_on_file": "Whether the applicant has a historical default on file.",
    "cb_person_cred_hist_length": "Length of the applicant's credit history in years.",
}


def _safe_float(x: Any) -> float:
    return float(np.asarray(x).ravel()[0])


class ModelNotReadyError(RuntimeError):
    """Raised when a prediction is requested before artifacts load."""


class ModelService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.model: Any | None = None
        self.threshold: float | None = None
        self.provenance: dict[str, Any] | None = None
        self.aux_explainer: Any | None = None
        self.learned_categories: dict[str, list[str]] = dict(CATEGORICAL_FALLBACK)
        self.load_error: str | None = None
        self.loaded_at: float | None = None
        self._shap_explainer: Any | None = None
        self._shap_lock = threading.Lock()

    # ------------------------------------------------------------------ loading
    def load(self) -> None:
        """Load and validate artifacts. Never raises — records load_error."""
        with self._lock:
            self.model = None
            self.threshold = None
            self.provenance = None
            self.aux_explainer = None
            self._shap_explainer = None
            self.load_error = None
            try:
                model = joblib.load(settings.model_path)
                if not (hasattr(model, "predict_proba") and hasattr(model, "predict")):
                    raise TypeError(
                        f"artifact is a {type(model).__name__} without predict_proba — "
                        "expected a fitted scikit-learn estimator"
                    )
                threshold_raw = joblib.load(settings.threshold_path)
                threshold = _safe_float(threshold_raw)
                if not (0.0 <= threshold <= 1.0):
                    raise ValueError(f"threshold {threshold} outside [0, 1]")

                self.model = model
                self.threshold = threshold
                self.loaded_at = time.time()

                # Optional companions
                try:
                    self.provenance = json.loads(settings.provenance_path.read_text())
                except Exception:  # noqa: BLE001 - provenance is optional
                    self.provenance = None
                try:
                    self.aux_explainer = joblib.load(settings.aux_explainer_path)
                except Exception:  # noqa: BLE001 - aux explainer is optional
                    self.aux_explainer = None

                self.learned_categories = self._extract_categories()
                logger.info(
                    "artifacts loaded: model=%s threshold=%.6f categories=%s",
                    type(model).__name__, threshold, self.learned_categories,
                )
            except Exception as exc:  # noqa: BLE001 - recorded, surfaced via /health
                self.load_error = f"{type(exc).__name__}: {exc}"
                logger.error("artifact loading failed: %s", self.load_error)

    # ------------------------------------------------------------------ status
    @property
    def ready(self) -> bool:
        return self.model is not None and self.threshold is not None

    def ensure_ready(self) -> None:
        if not self.ready:
            raise ModelNotReadyError(
                self.load_error or "model artifacts are not loaded"
            )

    # ------------------------------------------------------------ introspection
    def _extract_categories(self) -> dict[str, list[str]]:
        try:
            pipeline = self._inner_pipeline()
            pre = pipeline.named_steps["preprocessor"]
            ohe = pre.named_transformers_["cat"].named_steps["onehot"]
            cat_cols = list(pre.transformers_[1][2])
            cats = {
                col: [str(v) for v in values]
                for col, values in zip(cat_cols, ohe.categories_)
            }
            return cats if cats else dict(CATEGORICAL_FALLBACK)
        except Exception:  # noqa: BLE001
            return dict(CATEGORICAL_FALLBACK)

    def _inner_pipeline(self) -> Any:
        """Return the underlying sklearn Pipeline (works for a bare pipeline
        or a CalibratedClassifierCV wrapping one)."""
        if hasattr(self.model, "named_steps"):
            return self.model
        if hasattr(self.model, "calibrated_classifiers_"):
            return self.model.calibrated_classifiers_[0].estimator
        raise TypeError("unsupported estimator structure")

    def _pipeline_description(self) -> dict[str, Any]:
        try:
            pipe = self._inner_pipeline()
            pre = pipe.named_steps["preprocessor"]
            transformers = []
            for name, trans, cols in pre.transformers_:
                step_names = (
                    [type(s).__name__ for s in trans.steps]
                    if hasattr(trans, "steps") else [type(trans).__name__]
                )
                transformers.append({
                    "name": name,
                    "columns": [str(c) for c in cols],
                    "steps": step_names,
                })
            clf = pipe.named_steps["classifier"]
            clf_params = {
                k: (v if isinstance(v, (int, float, str, bool, type(None))) else str(v))
                for k, v in clf.get_params(deep=False).items()
                if k in {
                    "n_estimators", "max_depth", "learning_rate",
                    "scale_pos_weight", "random_state",
                }
            }
            return {
                "transformers": transformers,
                "classifier": type(clf).__name__,
                "classifier_params": clf_params,
            }
        except Exception:  # noqa: BLE001
            return {"note": "pipeline structure not introspectable"}

    # -------------------------------------------------------------- prediction
    def predict(self, data: dict[str, Any]) -> dict[str, Any]:
        self.ensure_ready()
        df = pd.DataFrame([{k: data[k] for k in FEATURE_ORDER}])
        probability = _safe_float(
            np.asarray(self.model.predict_proba(df))[:, 1][0]
        )
        if not np.isfinite(probability) or not (0.0 <= probability <= 1.0):
            raise RuntimeError("model produced an invalid probability")
        prediction = 1 if probability >= self.threshold else 0
        return {
            "default_probability": probability,
            "default_prediction": prediction,
            "threshold": float(self.threshold),
            "Result": "High risk" if prediction == 1 else "Low risk",
        }

    # -------------------------------------------------------- feature metadata
    def feature_schema(self) -> list[dict[str, Any]]:
        schema: list[dict[str, Any]] = []
        for name in FEATURE_ORDER:
            entry: dict[str, Any] = {
                "name": name,
                "label": FIELD_LABELS[name],
                "description": FIELD_DESCRIPTIONS[name],
                "type": "categorical" if name in self.learned_categories else "numeric",
            }
            if name in self.learned_categories:
                entry["options"] = self.learned_categories[name]
            if name in TRAINING_RANGES:
                entry["training_range"] = TRAINING_RANGES[name]
            schema.append(entry)
        return schema

    # ------------------------------------------------------- feature importance
    def feature_importance(self) -> dict[str, Any]:
        """Gain-based importance of the underlying XGBoost, aggregated from
        one-hot encoded columns back to the 11 original applicant features.

        Values come from the fitted estimator — nothing is estimated here.
        """
        self.ensure_ready()
        pipe = self.aux_explainer if self.aux_explainer is not None else self._inner_pipeline()
        pre = pipe.named_steps["preprocessor"]
        clf = pipe.named_steps["classifier"]
        if not hasattr(clf, "feature_importances_"):
            return {"available": False, "reason": "estimator exposes no feature_importances_"}

        encoded_names = [str(n) for n in pre.get_feature_names_out()]
        importances = np.asarray(clf.feature_importances_, dtype=float)

        # Map encoded column -> original feature
        def original_of(encoded: str) -> str:
            body = encoded.split("__", 1)[1] if "__" in encoded else encoded
            for col in FEATURE_ORDER:
                if body == col or body.startswith(col + "_"):
                    return col
            return body

        agg: dict[str, float] = {f: 0.0 for f in FEATURE_ORDER}
        detail: list[dict[str, Any]] = []
        for name, imp in zip(encoded_names, importances):
            orig = original_of(name)
            agg[orig] = agg.get(orig, 0.0) + float(imp)
            detail.append({
                "encoded_feature": name,
                "original_feature": orig,
                "importance": float(imp),
            })

        total = sum(agg.values()) or 1.0
        features = [
            {
                "feature": f,
                "label": FIELD_LABELS[f],
                "importance": round(v, 6),
                "share": round(v / total, 6),
            }
            for f, v in sorted(agg.items(), key=lambda kv: -kv[1])
        ]
        return {
            "available": True,
            "method": "XGBoost gain importance, aggregated from one-hot columns to original features",
            "importance_type": str(getattr(clf, "importance_type", "gain")),
            "features": features,
            "encoded_detail": sorted(detail, key=lambda d: -d["importance"]),
        }

    # -------------------------------------------------------------- explanation
    def _get_shap_explainer(self) -> Any:
        with self._shap_lock:
            if self._shap_explainer is None:
                import shap  # heavy import — deferred until first use

                pipe = (
                    self.aux_explainer
                    if self.aux_explainer is not None
                    else self._inner_pipeline()
                )
                clf = pipe.named_steps["classifier"]
                self._shap_explainer = shap.TreeExplainer(clf)
            return self._shap_explainer

    def explain(self, data: dict[str, Any]) -> dict[str, Any]:
        """Local SHAP explanation for one applicant.

        Follows the development notebook's methodology (cells 67-73): SHAP
        TreeExplainer runs on the underlying *uncalibrated* XGBoost pipeline.
        Contributions therefore explain the model's margin (log-odds space),
        not a decomposition of the calibrated probability — this limitation is
        surfaced to callers in `note`.
        """
        self.ensure_ready()
        pipe = (
            self.aux_explainer
            if self.aux_explainer is not None
            else self._inner_pipeline()
        )
        pre = pipe.named_steps["preprocessor"]
        df = pd.DataFrame([{k: data[k] for k in FEATURE_ORDER}])
        transformed = pre.transform(df)
        encoded_names = [str(n) for n in pre.get_feature_names_out()]
        X = pd.DataFrame(transformed, columns=encoded_names)

        explainer = self._get_shap_explainer()
        shap_values = np.asarray(explainer.shap_values(X))
        if shap_values.ndim == 3:  # (n, features, classes)
            shap_values = shap_values[:, :, -1]
        row = shap_values[0].ravel()
        base_value = _safe_float(explainer.expected_value)

        def original_of(encoded: str) -> str:
            body = encoded.split("__", 1)[1] if "__" in encoded else encoded
            for col in FEATURE_ORDER:
                if body == col or body.startswith(col + "_"):
                    return col
            return body

        agg: dict[str, float] = {f: 0.0 for f in FEATURE_ORDER}
        detail: list[dict[str, Any]] = []
        for name, val in zip(encoded_names, row):
            orig = original_of(name)
            agg[orig] = agg.get(orig, 0.0) + float(val)
            if abs(float(val)) > 1e-9:
                detail.append({
                    "encoded_feature": name,
                    "original_feature": orig,
                    "contribution": float(val),
                })

        prediction = self.predict(data)
        return {
            "prediction": prediction,
            "base_value": base_value,
            "margin_sum": float(base_value + row.sum()),
            "contributions": [
                {
                    "feature": f,
                    "label": FIELD_LABELS[f],
                    "contribution": round(v, 6),
                }
                for f, v in sorted(agg.items(), key=lambda kv: -abs(kv[1]))
            ],
            "encoded_detail": sorted(detail, key=lambda d: -abs(d["contribution"])),
            "note": (
                "SHAP TreeExplainer contributions computed on the underlying "
                "uncalibrated XGBoost pipeline (same methodology as the development "
                "notebook, cells 67-73). Values are in log-odds margin space and "
                "explain the direction and relative magnitude of each feature's "
                "influence; they are not an additive decomposition of the calibrated "
                "default probability."
            ),
        }

    # -------------------------------------------------------------------- info
    def health(self) -> dict[str, Any]:
        return {
            "status": "ok" if self.ready else "degraded",
            "service": settings.service_name,
            "version": settings.service_version,
            "ready": self.ready,
            "model_loaded": self.model is not None,
            "threshold_loaded": self.threshold is not None,
            "artifact_kind": (
                (self.provenance or {}).get("artifact_kind", "unknown")
                if self.ready else "unavailable"
            ),
            "load_error": self.load_error,
            "uptime_seconds": (
                round(time.time() - self.loaded_at, 1) if self.loaded_at else None
            ),
        }

    def info(self) -> dict[str, Any]:
        import platform

        import sklearn
        import xgboost

        self.ensure_ready()
        is_calibrated = hasattr(self.model, "calibrated_classifiers_")
        info: dict[str, Any] = {
            "ready": True,
            "model": {
                "class": type(self.model).__name__,
                "task": "binary classification — probability of loan default (loan_status = 1)",
                "target": "loan_status",
                "positive_class": "default",
                "calibrated": is_calibrated,
                "calibration": (
                    {"method": getattr(self.model, "method", None),
                     "cv": getattr(self.model, "cv", None)}
                    if is_calibrated else None
                ),
                "pipeline": self._pipeline_description(),
                "feature_names_in": FEATURE_ORDER,
                "n_features": len(FEATURE_ORDER),
            },
            "threshold": {
                "value": float(self.threshold),
                "rule": "predicted_class = 1 if default_probability >= threshold else 0",
                "source": (
                    (self.provenance or {}).get("threshold", {}).get(
                        "source", "best_threshold.pkl"
                    )
                ),
            },
            "feature_schema": self.feature_schema(),
            "categorical_options": self.learned_categories,
            "explainability": {
                "shap": self.aux_explainer is not None or is_calibrated,
                "feature_importance": True,
                "note": (
                    "SHAP explanations follow the notebook methodology: TreeExplainer "
                    "on the uncalibrated XGBoost pipeline."
                ),
            },
            "runtime": {
                "python": platform.python_version(),
                "scikit_learn": sklearn.__version__,
                "xgboost": xgboost.__version__,
            },
            "limitations": [
                "Model estimates are statistical, not guarantees of future behavior.",
                "Not a lending decision and not verified for regulatory compliance.",
                "Trained on a single public dataset of 32,581 US loan records; distribution shift will degrade accuracy.",
                "Inputs far outside the training distribution are extrapolations.",
                "The optimized threshold was selected on the holdout test set during development (see notebook).",
            ],
        }
        if self.provenance:
            info["provenance"] = self.provenance
        return info


model_service = ModelService()
