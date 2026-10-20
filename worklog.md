# CREDITNEXUS AI — Multi-Agent Worklog

---
Task ID: 1
Agent: main
Task: Initialize fullstack environment

Work Log:
- Ran init-fullstack.sh; Next.js 16 scaffold ready (React 19, TS, Tailwind 4, shadcn/ui full set, framer-motion, zustand, RHF, zod, recharts, cmdk preinstalled)
- Dev server auto-managed on port 3000; Caddy gateway exposes one port; mini-services pattern for extra ports
- Python venv at /home/z/.venv (3.12.15): sklearn 1.5.2, pandas 2.2.3, fastapi 0.128.0, uvicorn, xgboost 2.1.3, joblib 1.5.3, pytest, httpx

Stage Summary:
- Environment ready. Frontend = Next.js 16 single-route app; backend = FastAPI mini-service on port 8000.

---
Task ID: 2
Agent: main
Task: Audit existing repository (notebook, main.py, pkl artifacts)

Work Log:
- Parsed all 91 notebook cells (sources + outputs) → scripts/audit_notebook_output.txt
- Inspected artifacts → scripts/audit_artifacts_output.txt

**CRITICAL FINDINGS:**

1. `credit_risk_model.pkl` is NOT a model. It is a numpy ndarray shape (6305,) of float64 probabilities.
   Root cause (notebook cells 81-82):
   - Cell 81 line 1: `calibrated_model = calibrated_model_xg.predict_proba(X_test)[:,1]` — overwrites the model variable with its test-set output
   - Cell 82: `joblib.dump(calibrated_model, 'credit_risk_model.pkl')` — dumps the array, not `calibrated_model_xg`
   - The original main.py would crash on every /predict call (`'numpy.ndarray' object has no attribute 'predict_proba'`)
   - Ground truth check: saved array head [0.75711989 0.04616006 0.94900388 ...] EXACTLY matches cell 61 output of `calibrated_model_xg.predict_proba(X_test)[:,1]` → the array is the intended model's test-set output and can verify a faithful rebuild.

2. `best_threshold.pkl` is VALID: np.float64(0.7158444761787314), within [0,1]. F1-optimal threshold on the CALIBRATED model's probability scale (notebook cell 81).

3. Intended final model (from notebook):
   - Cleaning (cell 13): drop_duplicates → age∈[18,100] → emp_length ≤ age AND ≤ 60 (NaNs drop via False comparison) → loan_amnt>0 & person_income>0. 32581 → 31522 rows.
   - Split (cell 17): train_test_split(test_size=0.2, random_state=42, stratify=y). X_train 25217 / X_test 6305. y_train: 19772/5445. scale_pos_weight = 3.6312213039485766.
   - preprocessor_xg (cell 25): ColumnTransformer → num [person_age, person_income, person_emp_length, loan_amnt, loan_int_rate, loan_percent_income, cb_person_cred_hist_length]: SimpleImputer(median); cat [person_home_ownership, loan_intent, loan_grade, cb_person_default_on_file]: SimpleImputer(constant 'Missing') + OneHotEncoder(handle_unknown='ignore').
   - xg_model (cell 40): Pipeline(preprocessor_xg, XGBClassifier(random_state=42, scale_pos_weight=3.6312, learning_rate=0.1)) — DEFAULTS otherwise (n_estimators=100, max_depth=6). NOTE: RandomizedSearchCV best params (cell 50) were NOT applied to the final calibrated model.
   - calibrated_model_xg (cell 60): CalibratedClassifierCV(xg_model, method='sigmoid', cv=5, n_jobs=-1).fit(X_train, y_train)
   - Model accepts RAW string categories (pipeline includes OneHot) → main.py's raw-DataFrame approach is compatible with the INTENDED artifact.
4. Notebook-verified metrics (will display as "reported in notebook"): 5-fold CV XGBoost ROC-AUC 0.9465±0.0045, Acc 0.9218, P 0.8361, R 0.7936, F1 0.8142; holdout (uncalibrated xg_model): Acc 0.92, P 0.82, R 0.79, F1 0.81; baseline LR 0.82/0.56/0.79/0.65; RF 0.94/0.98/0.72/0.83. SHAP TreeExplainer was used in the notebook (supports SHAP-based explainability narrative).
5. Dataset: `credit_risk_dataset.csv` NOT in uploads. Identified public source: Kaggle "Credit Risk Dataset" by Lao Tse (laotse/credit-risk-dataset), CC0. Downloaded via kagglehub (1,804,682 bytes).

Stage Summary:
- Artifact bug confirmed and root-caused. Threshold valid. Intended pipeline fully documented. Dataset obtained pending verification. Plan: rebuild intended model faithfully, VERIFY against saved probability array, serve with clear provenance labeling; keep original artifacts untouched.

---
Task ID: 2b/3/4/5
Agent: main
Task: Rebuild + verify intended model; build hardened FastAPI backend; backend tests

Work Log:
- Downloaded public dataset (Kaggle laotse/credit-risk-dataset, CC0) via kagglehub; verified 26/26 statistics vs notebook + 5/5 pipeline structure checks (31522 cleaned rows, 6305 test, scale_pos_weight 3.6312213039485766)
- Rebuilt intended model exactly as notebook cells 13,15,17,20,22-25,40,60; after matching library versions (sklearn 1.9.1, xgboost 3.4.1) the rebuild matches the uploaded probability array with max_abs_diff 2.6e-05, pearson 1.0, 100% same-side → verified faithful reconstruction
- Artifacts saved to mini-services/credit-risk-api/artifacts/: credit_risk_model.pkl (calibrated estimator), best_threshold.pkl (verbatim 0.7158444761787314), xg_model_aux_explainer.pkl (uncalibrated pipeline for SHAP, notebook methodology), provenance.json (incl. measured holdout metrics: acc .9383 / prec .9784 / rec .7305 / f1 .8365 / roc_auc .9486)
- Backend: app/{config,schemas,model_service,main}.py, routes/{health,predict,model}.py, services/request_context.py; CORS explicit origins, X-Request-ID middleware, structured JSON logs (no payload logging), categorical validation vs learned encoder categories, 503 MODEL_NOT_READY / 422 INVALID_CATEGORY / 500 INFERENCE_FAILED shapes
- Service running on port 8000 (nohup uvicorn); /health, /predict, /model/info, /model/feature-importance, /model/explain all smoke-tested OK
- pytest: 39/39 passed (contract shape, threshold rule, determinism, missing/invalid fields, unknown categories w/ options, risk ordering, 503 not-ready, info schema, importance shares sum to 1, SHAP explain)

Stage Summary:
- REAL inference live on :8000 through Caddy gateway via ?XTransformPort=8000. Frontend must use relative paths with that query param. Ready to build the Next.js 16 frontend.

---
Task ID: 6-14
Agent: main
Task: Frontend build (design system, 3D NEXUS, views, tests) + E2E browser verification

Work Log:
- Design system: globals.css rewritten dark-first (nexus-* tokens, glass panels, custom scrollbars, reduced-motion guard); Inter + JetBrains Mono via next/font; layout.tsx metadata
- Frontend structure: types/api.ts, schemas/creditRisk.ts (zod, training-range bounds, emp<=age rule, 3 samples), services/api.ts (XTransformPort routing, dedupe, seq guard, contract validation, latency signal), 4 zustand stores, hooks (health polling, animated number, env detection), config/modelFacts.ts
- 3D suite: poseEngine.ts (pure FSM→pose math + module-scope runtime), CharacterController, NexusCharacter (procedural graphite analyst, blinking visor, chest core, holo console, scan ring, fake contact shadow, particles 160-pts, data shards, drei Grid), SceneLighting (state-reactive rim), CameraRig (presets, safe zoom, one-time auto-orbit, reset), AnalystScene (dpr limits, PerformanceMonitor downgrade, WebGL fallback, error boundary)
- Views: WelcomeView (facts chips, CTAs, live status), AnalysisView (desktop 3-panel / mobile 3-tab), ApplicantForm (RHF+zod, 4 sections, compute ratio, samples, ReviewStep dialog), ResultsPanel (gauge+threshold tick, probability bar, exact classification arithmetic, retry, explain link), ExplainabilityView (global importance, local SHAP diverging bars, sensitivity sweep w/ 9 real calls), ObservatoryView (status cards, latency sparkline, pipeline chips, schema table, measured-vs-notebook metrics, provenance story, limitations)
- Layout: TopBar (nav, health pill w/ EMA latency, palette button), CommandPalette (Ctrl+K, nav+actions), ActivityTimeline (session events sheet), CreditNexusApp root (view transitions, keyboard 1-4, lazy secondary views)
- next.config.ts: added rewrites proxying /health,/predict,/model/* → :8000 so relative-path API calls work at any entry point
- Refactors for React-Compiler-era lint rules: lazy useRef → JSX materials + callback refs; pose runtime at module scope; useWatch instead of watch; effects restructured (0 errors, 0 warnings)
- Tests: vitest + RTL, 41 tests passing (format, schema, API client incl. dedupe/contract/stale, pose engine incl. interruptibility+reduced-motion, stores incl. seq guard, ResultsPanel rendering incl. retry, SceneFallback)
- Browser verification (agent-browser): welcome renders + WebGL canvas alive; full E2E golden path (sample → review → confirm → result 95.70% ≥ 71.58% threshold, cross-verified EXACT vs direct curl 0.9570012398898212); low-risk flow 0.94%; simulated backend failure (network abort) → graceful error → retry recovery; SHAP local explanation loads; sensitivity sweep = exactly 9 real /predict calls; Observatory all sections; command palette + timeline actions; mobile 390x844 tabbed layout, canvas renders, no horizontal overflow; VLM screenshot review: professional, no overlaps/cut-offs; zero page errors in final pass

Stage Summary:
- Frontend complete and verified end-to-end against the live backend. Lint clean, 41/41 frontend + 39/39 backend tests green. Screenshots in scripts/verify_*.png and scripts/final_*.png.
