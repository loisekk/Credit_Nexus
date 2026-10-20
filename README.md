# CREDITNEXUS AI

**Understand Risk. Explore Intelligence.**

An immersive, 3D-first credit risk intelligence workstation built around a real
loan-default prediction model. Meet **NEXUS** — a persistent 3D AI analyst that
reacts to every application state — while a calibrated XGBoost serves live
default probabilities with the classification threshold fully in view.

> This is a **loan / credit default risk** prediction project (target
> `loan_status`), not credit-card transaction fraud detection.

---

## What was found in the original repository (audit)

The original artifacts were audited before any code was written. One critical
defect was discovered and handled transparently:

| Artifact | Finding | Resolution |
|---|---|---|
| `best_threshold.pkl` | Valid — `np.float64(0.7158444761787314)`, the notebook's F1-optimal threshold on the calibrated probability scale | Used **verbatim, unmodified** |
| `credit_risk_model.pkl` | **Not a model.** Notebook cell 81 reassigns `calibrated_model = calibrated_model_xg.predict_proba(X_test)[:,1]` and cell 82 dumps *that* — the artifact is a 6,305-element probability array, and the original `main.py` crashes on every `/predict` call | The intended pipeline (notebook cells 13→60) was re-executed exactly on the verified original dataset; the rebuild reproduces the uploaded array to **max abs diff 2.6e-05 (Pearson r = 1.0)** and is served with full provenance labeling |
| `main.py` | Contract is sound (raw 11-feature DataFrame → pipeline handles encoding internally) | Contract preserved byte-for-byte |

The dataset (`credit_risk_dataset.csv`, Kaggle *laotse/credit-risk-dataset*, CC0)
was not part of the upload; it was obtained and verified against **26/26
statistics** printed by the notebook (row/column counts, means, ranges, null
counts, duplicates, class balance, cardinalities) before the rebuild.
See `mini-services/credit-risk-api/artifacts/provenance.json` for the full
verification record, and "Swapping in your own artifact" below to replace the
rebuild with your own re-export at any time — no code changes required.

---

## Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│  Frontend — Next.js 16 (React 19 + TypeScript strict), port 3000   │
│  ├── Views: Overview · Analysis Workspace · Explainability ·       │
│  │          Model Observatory (single route, client-side)          │
│  ├── NEXUS: procedural Three.js character (R3F + Drei), pose FSM   │
│  ├── React Hook Form + Zod form (11 features, exact field names)   │
│  ├── Recharts analytics · Zustand state · Framer Motion · cmdk     │
│  └── API client: relative paths, ?XTransformPort=8000 (gateway)    │
│                     or Next rewrites proxy (direct :3000)          │
└──────────────────────────────┬─────────────────────────────────────┘
                               │  POST /predict  (JSON, 11 fields)
┌──────────────────────────────▼─────────────────────────────────────┐
│  Backend — FastAPI mini-service, port 8000                         │
│  ├── app/main.py        lifespan: load + validate artifacts once   │
│  ├── app/model_service  predict / introspect / importance / SHAP   │
│  ├── app/routes         /health · /predict · /model/*              │
│  ├── Artifacts          credit_risk_model.pkl · best_threshold.pkl │
│  │                      (+ provenance.json, aux SHAP pipeline)     │
│  └── Classification rule: class = 1 if probability >= threshold    │
└────────────────────────────────────────────────────────────────────┘
```

### Inference pipeline (from the notebook, verified)

```text
11 raw features
  → median imputation (7 numeric)
  → one-hot encoding (4 categorical, handle_unknown=ignore)
  → XGBClassifier(learning_rate=0.1, scale_pos_weight=3.6312, random_state=42)
  → CalibratedClassifierCV(method="sigmoid", cv=5)
  → threshold 0.7158 (F1-optimal, calibrated scale)
```

Measured holdout performance of the serving artifact (n = 6,305, never used
for training): accuracy 0.938 · precision 0.978 · recall 0.731 · F1 0.837 ·
ROC-AUC 0.949 · average precision 0.902. Notebook-reported values are shown
separately in the Observatory and are never mixed with measured ones.

---

## Quickstart

### 1. Backend (FastAPI + real model artifacts)

```bash
cd mini-services/credit-risk-api
python3 -m venv .venv && source .venv/bin/activate   # optional
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
# or: bun run dev   (package.json script, --reload enabled)
```

Health check: `curl http://localhost:8000/health`

### 2. Frontend

```bash
bun install
bun run dev          # http://localhost:3000
```

The frontend talks to the backend via relative paths:
- through the sandbox gateway: `/predict?XTransformPort=8000`
- directly in local dev: Next.js rewrites proxy `/predict`, `/health`,
  `/model/*` to `http://localhost:8000` (override with `CREDIT_RISK_API_ORIGIN`)
- or set `NEXT_PUBLIC_API_BASE_URL` to bypass both mechanisms

### 3. Tests

```bash
# Backend — 39 tests against the real artifacts
cd mini-services/credit-risk-api && python3 -m pytest tests -v

# Frontend — 41 tests (schema, API client, stores, pose engine, panels)
cd /home/z/my-project && bun run test
```

---

## API contract

`POST /predict` — identical to the original backend:

```json
{
  "person_age": 30, "person_income": 55000,
  "person_home_ownership": "RENT", "person_emp_length": 4,
  "loan_intent": "PERSONAL", "loan_grade": "C",
  "loan_amnt": 10000, "loan_int_rate": 12.5,
  "loan_percent_income": 0.18,
  "cb_person_default_on_file": "N", "cb_person_cred_hist_length": 4
}
```

```json
{
  "default_probability": 0.043462101407450215,
  "default_prediction": 0,
  "threshold": 0.7158444761787314,
  "Result": "Low risk"
}
```

Additional endpoints (all verified-metadata only, no internals leaked):

| Endpoint | Purpose |
|---|---|
| `GET /health` | Readiness, model-loaded status, artifact kind, uptime |
| `GET /model/info` | Pipeline structure, feature schema (live encoder categories), threshold, provenance, measured + notebook metrics, limitations |
| `GET /model/feature-importance` | Gain-based importance aggregated from one-hot columns to the 11 original features |
| `POST /model/explain` | Local SHAP explanation (notebook methodology: TreeExplainer on the uncalibrated pipeline) |

Error semantics: `422` invalid input (unknown categories return the valid
options), `503 MODEL_NOT_READY`, `500 INFERENCE_FAILED` (generic message,
details only in server logs; every response carries an `X-Request-ID`).

---

## Swapping in your own artifact

To serve your own re-exported estimator, fix the notebook's save cell:

```python
# Cell 82 — corrected
import joblib
joblib.dump(calibrated_model_xg, "credit_risk_model.pkl")   # the estimator, not the array
```

Then replace `mini-services/credit-risk-api/artifacts/credit_risk_model.pkl`
and restart. The service validates at startup that the artifact exposes
`predict_proba` and refuses to report ready otherwise — the exact failure mode
that silently shipped in the original artifact cannot recur. `best_threshold.pkl`
is already your original file, copied verbatim.

---

## The NEXUS character

- Procedural Three.js analyst (graphite suit, emissive visor, holo console) —
  no GLB dependency; the component is structured for a drop-in rigged model.
- Eight FSM states — `idle · greeting · listening · analyzing · lowRisk ·
  highRisk · error · explaining` — driven **only** by real application events.
  The character never invents or alters prediction results.
- Damped pose interpolation makes every transition interruptible; greeting is
  timed; high-risk adds a brief head-shake; analyzing runs the scan sweep.
- Degradation paths: WebGL unavailable → static fallback (all features remain
  functional) · runtime renderer crash → error boundary → fallback · weak GPU →
  PerformanceMonitor drops DPR/particles · `prefers-reduced-motion` or the
  low-performance toggle stops ambient motion.

## Product surface

- **Overview** — hero 3D chamber, verified model facts, live backend status.
- **Analysis Workspace** — 4-section validated form (training-range checks,
  `employment ≤ age` rule, ratio auto-compute, 3 illustrative samples,
  review-before-submit), NEXUS center stage, results panel with radial gauge,
  threshold marker, probability bar and the exact classification arithmetic.
- **Explainability Lab** — global gain importance, local SHAP waterfall,
  single-input sensitivity sweeps (every point is a live prediction).
- **Model Observatory** — service status, client-measured latency sparkline,
  pipeline map, live feature schema, measured vs notebook-reported metrics,
  provenance & verification record, limitations.
- Command palette (`Ctrl/⌘ K`), activity timeline (session-only),
  keyboard view shortcuts (`1–4`), responsive mobile tabs.

## Security & responsible AI

Applicant data is sensitive: it is sent only to this deployment's inference
service, never logged (request IDs and status codes only), never stored, and
never forwarded to external AI services. CORS is restricted to explicitly
configured origins. The UI states plainly that outputs are model estimates —
not guarantees, not lending decisions — and distinguishes predicted default
probability from classification correctness. No compliance claims are made.

## Repository layout

```text
├── src/                          # Next.js frontend (components/features/stores/…)
│   └── components/three/         # AnalystScene, NexusCharacter, poseEngine, …
├── mini-services/credit-risk-api/# FastAPI service (app/, artifacts/, tests/, tools/)
│   └── tools/rebuild_model.py    # Reproducible verified rebuild of the intended model
├── scripts/                      # Audit notes + verification screenshots
└── upload/                       # Your original files (never modified)
```
