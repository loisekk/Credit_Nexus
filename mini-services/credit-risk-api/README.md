# credit-risk-api

FastAPI inference service for CREDITNEXUS AI. Serves the (verified) calibrated
XGBoost loan-default model and its F1-optimal threshold.

## Run

```bash
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
# dev (auto-reload): bun run dev
```

Configuration via environment (see `.env.example`): `CORS_ALLOW_ORIGINS`,
`MODEL_ARTIFACTS_DIR`, `MODEL_PATH`, `THRESHOLD_PATH`, `LOG_LEVEL`.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Readiness + artifact status (no internals) |
| POST | `/predict` | Original contract: `{default_probability, default_prediction, threshold, Result}` |
| GET | `/model/info` | Verified metadata, feature schema (live encoder categories), provenance, metrics |
| GET | `/model/feature-importance` | Gain importance aggregated to the 11 original features |
| POST | `/model/explain` | Local SHAP contributions (TreeExplainer on the uncalibrated pipeline) |

## Tests

```bash
python3 -m pytest tests -v      # 39 tests, real artifacts
```

## Artifacts

- `credit_risk_model.pkl` — the serving estimator (verified rebuild; see
  `provenance.json` for the full equivalence record against the uploaded
  probability array).
- `best_threshold.pkl` — the uploaded threshold file, copied verbatim
  (0.7158444761787314).
- `xg_model_aux_explainer.pkl` — uncalibrated pipeline used only for SHAP
  explanations (notebook cells 67–73 methodology). Never used for serving.
- `provenance.json` — rebuild record: dataset verification, equivalence stats,
  measured holdout metrics, environment versions.

## Reproducing the rebuild

```bash
python3 tools/rebuild_model.py
```

The script verifies the public dataset against 26 notebook statistics,
re-executes the notebook's exact pipeline (cleaning → stratified split →
ColumnTransformer → XGBClassifier → sigmoid calibration), compares the result
against the uploaded artifact's probability array, and rewrites the artifacts
plus provenance.

## Replacing with your own model

Fix the notebook's save cell (`joblib.dump(calibrated_model_xg, ...)`), export,
and overwrite `artifacts/credit_risk_model.pkl`. The service validates at
startup that the artifact is an estimator with `predict_proba`; invalid
artifacts leave the service in a `degraded` state with the reason surfaced on
`/health` — predictions are never fabricated.

## Hardening notes

- Model + threshold loaded once at startup (lifespan), thread-safe.
- Categorical inputs validated against the encoder's learned categories;
  unknown values return `422` with the valid options.
- Numeric safety bounds reject impossible values (negative ages, non-finite
  numbers) without imposing arbitrary distribution limits.
- Structured JSON logs with request IDs; applicant payloads never logged.
- Consistent error envelopes: `INVALID_CATEGORY`, `MODEL_NOT_READY`,
  `INFERENCE_FAILED`; no tracebacks or filesystem paths exposed.
- CORS from explicit origins only.
