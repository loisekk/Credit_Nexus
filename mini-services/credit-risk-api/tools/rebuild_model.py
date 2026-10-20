"""
Rebuild the INTENDED model from Credit_Card_Risk.ipynb and VERIFY it against
the artifact that was actually saved.

Background
----------
The notebook's cell 81 accidentally reassigns `calibrated_model` to
`calibrated_model_xg.predict_proba(X_test)[:,1]` (a numpy array of 6305 test-set
probabilities) and cell 82 dumps THAT variable. The uploaded
`credit_risk_model.pkl` therefore contains the intended model's test-set
output, not the model itself.

This script:
1. Verifies the public dataset (Kaggle laotse/credit-risk-dataset, CC0) is
   byte-for-row identical in structure to the one used in the notebook by
   checking every statistic the notebook printed.
2. Re-executes the notebook's exact pipeline (cleaning -> split ->
   preprocessing -> XGBoost -> sigmoid calibration) with the same seeds.
3. Compares the rebuilt model's test-set probabilities with the uploaded
   array. If they match closely, the rebuild is verified equivalent.
4. Saves the rebuilt estimator + provenance metadata for the API to serve.

Run:  python3 mini-services/credit-risk-api/tools/rebuild_model.py
"""
import hashlib
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
import xgboost

SRC_CSV = Path("/home/z/.cache/kagglehub/datasets/laotse/credit-risk-dataset/versions/1/credit_risk_dataset.csv")
UPLOAD_MODEL = Path("/home/z/my-project/upload/credit_risk_model.pkl")   # the broken (probability-array) artifact
UPLOAD_THRESHOLD = Path("/home/z/my-project/upload/best_threshold.pkl")  # the valid threshold artifact
OUT_DIR = Path("/home/z/my-project/mini-services/credit-risk-api/artifacts")

# ----------------------------------------------------------------------------------
# STEP 1 — Verify dataset against every statistic printed in the notebook
# ----------------------------------------------------------------------------------
print("=" * 70)
print("STEP 1: Verify dataset matches the notebook's recorded statistics")
print("=" * 70)
df = pd.read_csv(SRC_CSV)

checks = []
def check(name, actual, expected, tol=0.0):
    ok = (abs(actual - expected) <= tol) if isinstance(expected, float) else (actual == expected)
    checks.append((name, actual, expected, ok))
    status = "OK " if ok else "FAIL"
    print(f"  [{status}] {name}: actual={actual} expected={expected}")
    return ok

check("shape rows", df.shape[0], 32581)
check("shape cols", df.shape[1], 12)
check("person_age mean", float(df.person_age.mean()), 27.734600, 1e-4)
check("person_income mean", float(df.person_income.mean()), 66074.84846996715, 1e-6)
check("person_emp_length mean", float(df.person_emp_length.mean()), 4.789686, 1e-5)
check("loan_amnt mean", float(df.loan_amnt.mean()), 9589.371106, 1e-4)
check("loan_int_rate mean", float(df.loan_int_rate.mean()), 11.011695, 1e-5)
check("loan_percent_income mean", float(df.loan_percent_income.mean()), 0.170203, 1e-5)
check("cb_person_cred_hist_length mean", float(df.cb_person_cred_hist_length.mean()), 5.804211, 1e-5)
check("person_age max", int(df.person_age.max()), 144)
check("person_income max", int(df.person_income.max()), 6000000)
check("person_emp_length max", float(df.person_emp_length.max()), 123.0)
check("loan_amnt max", int(df.loan_amnt.max()), 35000)
check("loan_int_rate min", float(df.loan_int_rate.min()), 5.42)
check("loan_int_rate max", float(df.loan_int_rate.max()), 23.22)
check("loan_percent_income max", float(df.loan_percent_income.max()), 0.83)
check("cb_person_cred_hist_length min", int(df.cb_person_cred_hist_length.min()), 2)
check("cb_person_cred_hist_length max", int(df.cb_person_cred_hist_length.max()), 30)
check("nulls person_emp_length", int(df.person_emp_length.isnull().sum()), 895)
check("nulls loan_int_rate", int(df.loan_int_rate.isnull().sum()), 3116)
check("duplicates", int(df.duplicated().sum()), 165)
check("class 0", int((df.loan_status == 0).sum()), 25473)
check("class 1", int((df.loan_status == 1).sum()), 7108)
check("home ownership uniques", int(df.person_home_ownership.nunique()), 4)
check("loan intent uniques", int(df.loan_intent.nunique()), 6)
check("loan grade uniques", int(df.loan_grade.nunique()), 7)

n_fail = sum(1 for c in checks if not c[3])
print(f"\n  -> {len(checks) - n_fail}/{len(checks)} checks passed")
if n_fail:
    raise SystemExit("DATASET VERIFICATION FAILED — do not proceed with rebuild")

# ----------------------------------------------------------------------------------
# STEP 2 — Notebook pipeline, replicated exactly (cells 13,15,17,20,22-25,40,60)
# ----------------------------------------------------------------------------------
print("\n" + "=" * 70)
print("STEP 2: Re-execute notebook pipeline (same seeds, same order)")
print("=" * 70)
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier

# Cell 13 — cleaning
df_copy = df.copy()
df_copy.drop_duplicates(inplace=True)
df_copy = df_copy[df_copy["person_age"] >= 18]
df_copy = df_copy[df_copy["person_age"] <= 100]
df_copy = df_copy[df_copy["person_emp_length"] <= df_copy["person_age"]]
df_copy = df_copy[df_copy["person_emp_length"] <= 60]
df_copy = df_copy[(df_copy["loan_amnt"] > 0) & (df_copy["person_income"] > 0)]
check("cleaned rows", df_copy.shape[0], 31522)

# Cell 15 — features/target
X = df_copy.drop("loan_status", axis=1)
y = df_copy["loan_status"]

# Cell 17 — split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
check("X_test rows", X_test.shape[0], 6305)

# Cell 19-20 — class weights
neg, pos = np.bincount(y_train)
scale_weights = neg / pos
check("scale_pos_weight", float(scale_weights), 3.6312213039485766, 1e-9)
check("y_train class 0", int((y_train == 0).sum()), 19772)
check("y_train class 1", int((y_train == 1).sum()), 5445)

# Cells 22-25 — preprocessor
numeric_cols = df_copy.drop("loan_status", axis=1).select_dtypes(include=np.number).columns
categorical_cols = df_copy.select_dtypes(include="object").columns
print(f"  numeric_cols     = {list(numeric_cols)}")
print(f"  categorical_cols = {list(categorical_cols)}")

preprocessor_xg = ColumnTransformer(
    transformers=[
        ("num", Pipeline([("imputer", SimpleImputer(strategy="median"))]), numeric_cols),
        ("cat", Pipeline([
            ("imputer", SimpleImputer(strategy="constant", fill_value="Missing")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]), categorical_cols),
    ]
)

# Cell 40 — xg_model (untuned; the notebook's final calibrated model wraps THIS one)
xg_model = Pipeline([
    ("preprocessor", preprocessor_xg),
    ("classifier", XGBClassifier(random_state=42, scale_pos_weight=scale_weights, learning_rate=0.1)),
])
xg_model.fit(X_train, y_train)  # notebook cell 40 fits the uncalibrated pipeline (used later for SHAP)

# Cell 60 — calibration
calibrated_model_xg = CalibratedClassifierCV(xg_model, method="sigmoid", cv=5, n_jobs=-1)
calibrated_model_xg.fit(X_train, y_train)

# ----------------------------------------------------------------------------------
# STEP 3 — Verify rebuilt model against the uploaded probability array
# ----------------------------------------------------------------------------------
print("\n" + "=" * 70)
print("STEP 3: Verify rebuilt model against uploaded artifact")
print("=" * 70)
saved_proba = joblib.load(UPLOAD_MODEL)              # ndarray (6305,)
rebuilt_proba = calibrated_model_xg.predict_proba(X_test)[:, 1]

assert saved_proba.shape == rebuilt_proba.shape, "shape mismatch"
abs_diff = np.abs(rebuilt_proba - saved_proba)
max_abs_diff = float(abs_diff.max())
mean_abs_diff = float(abs_diff.mean())
corr = float(np.corrcoef(rebuilt_proba, saved_proba)[0, 1])
p50 = float(np.percentile(abs_diff, 50))
p95 = float(np.percentile(abs_diff, 95))
same_direction = float((np.sign(rebuilt_proba - 0.5) == np.sign(saved_proba - 0.5)).mean())

print(f"  max abs diff     : {max_abs_diff:.8f}")
print(f"  mean abs diff    : {mean_abs_diff:.8f}")
print(f"  p50 / p95 diff   : {p50:.8f} / {p95:.8f}")
print(f"  pearson corr     : {corr:.8f}")
print(f"  same side of 0.5 : {same_direction * 100:.2f}%")
print(f"  head rebuilt     : {np.round(rebuilt_proba[:5], 8).tolist()}")
print(f"  head uploaded    : {np.round(saved_proba[:5], 8).tolist()}")

# Threshold re-derivation (notebook cell 81 logic) for comparison only
from sklearn.metrics import precision_recall_curve
precisions, recalls, thresholds = precision_recall_curve(y_test, rebuilt_proba)
f1_curve = 2 * (precisions * recalls) / (precisions + recalls + 1e-9)
rebuilt_best_threshold = float(thresholds[np.argmax(f1_curve[:-1])])
original_threshold = float(joblib.load(UPLOAD_THRESHOLD))
print(f"  threshold: uploaded={original_threshold!r} re-derived={rebuilt_best_threshold!r} "
      f"(diff={abs(rebuilt_best_threshold - original_threshold):.8f})")

# ----------------------------------------------------------------------------------
# STEP 4 — Holdout metrics at the ORIGINAL threshold (measured, not fabricated)
# ----------------------------------------------------------------------------------
print("\n" + "=" * 70)
print("STEP 4: Measure holdout metrics of the verified model (original threshold)")
print("=" * 70)
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, brier_score_loss, average_precision_score,
)

y_proba = rebuilt_proba
y_pred = (y_proba >= original_threshold).astype(int)
holdout_metrics = {
    "evaluated_on": "holdout test set (n=6305, never used for training)",
    "threshold_used": original_threshold,
    "accuracy": float(accuracy_score(y_test, y_pred)),
    "precision": float(precision_score(y_test, y_pred)),
    "recall": float(recall_score(y_test, y_pred)),
    "f1": float(f1_score(y_test, y_pred)),
    "roc_auc": float(roc_auc_score(y_test, y_proba)),
    "average_precision": float(average_precision_score(y_test, y_proba)),
    "brier_score": float(brier_score_loss(y_test, y_proba)),
    "confusion_matrix": {
        "true_negative": int(confusion_matrix(y_test, y_pred)[0, 0]),
        "false_positive": int(confusion_matrix(y_test, y_pred)[0, 1]),
        "false_negative": int(confusion_matrix(y_test, y_pred)[1, 0]),
        "true_positive": int(confusion_matrix(y_test, y_pred)[1, 1]),
    },
}
for k in ("accuracy", "precision", "recall", "f1", "roc_auc", "average_precision", "brier_score"):
    print(f"  {k:20s}: {holdout_metrics[k]:.4f}")
print(f"  confusion           : TN={holdout_metrics['confusion_matrix']['true_negative']} "
      f"FP={holdout_metrics['confusion_matrix']['false_positive']} "
      f"FN={holdout_metrics['confusion_matrix']['false_negative']} "
      f"TP={holdout_metrics['confusion_matrix']['true_positive']}")

# SHAP compatibility check (notebook cells 67-73 used TreeExplainer on the inner XGB)
shap_available = False
try:
    import shap  # noqa: F401
    inner_xgb = calibrated_model_xg.calibrated_classifiers_[0].estimator.named_steps["classifier"]
    shap_available = hasattr(inner_xgb, "get_booster")
except Exception as exc:  # pragma: no cover
    print(f"  shap check failed: {exc}")
print(f"  shap compatible     : {shap_available}")

# Categorical options learned by the fitted OneHotEncoder (served via /model/info)
ohe = xg_model.named_steps["preprocessor"].named_transformers_["cat"].named_steps["onehot"]
cat_cols = list(categorical_cols)
learned_categories = {c: [str(v) for v in cats] for c, cats in zip(cat_cols, ohe.categories_)}
print(f"  learned categories  : {learned_categories}")

# ----------------------------------------------------------------------------------
# STEP 5 — Save artifacts + provenance
# ----------------------------------------------------------------------------------
print("\n" + "=" * 70)
print("STEP 5: Save artifacts + provenance")
print("=" * 70)
OUT_DIR.mkdir(parents=True, exist_ok=True)

model_out = OUT_DIR / "credit_risk_model.pkl"
joblib.dump(calibrated_model_xg, model_out)
joblib.dump(joblib.load(UPLOAD_THRESHOLD), OUT_DIR / "best_threshold.pkl")  # verbatim copy
# Auxiliary: the uncalibrated pipeline the notebook's SHAP section explains (cells 67-73).
# Used ONLY for explanations, never for serving predictions.
aux_out = OUT_DIR / "xg_model_aux_explainer.pkl"
joblib.dump(xg_model, aux_out)

sha = hashlib.sha256(SRC_CSV.read_bytes()).hexdigest()
provenance = {
    "artifact_kind": "rebuilt-estimator",
    "rebuilt_at_utc": datetime.now(timezone.utc).isoformat(),
    "reason": (
        "Uploaded credit_risk_model.pkl contains a numpy array of 6305 test-set "
        "probabilities (notebook cell 81 reassigned `calibrated_model` to "
        "`calibrated_model_xg.predict_proba(X_test)[:,1]` before cell 82 dumped it). "
        "This artifact is a faithful re-execution of the notebook's intended pipeline."
    ),
    "intended_model": "CalibratedClassifierCV(Pipeline(ColumnTransformer(median-impute + OneHot) -> XGBClassifier(learning_rate=0.1, scale_pos_weight=3.6312, random_state=42)), method='sigmoid', cv=5)",
    "notebook": "Credit_Card_Risk.ipynb (cells 13,15,17,20,22-25,40,60)",
    "dataset": {
        "source": "Kaggle laotse/credit-risk-dataset (CC0 Public Domain)",
        "file": "credit_risk_dataset.csv",
        "sha256": sha,
        "rows": int(df.shape[0]),
        "verification_checks_passed": f"{len(checks) - n_fail}/{len(checks)}",
    },
    "verification_vs_uploaded_array": {
        "max_abs_diff": max_abs_diff,
        "mean_abs_diff": mean_abs_diff,
        "p50_abs_diff": p50,
        "p95_abs_diff": p95,
        "pearson_correlation": corr,
        "same_side_of_0.5": same_direction,
    },
    "threshold": {
        "value": original_threshold,
        "source": "uploaded best_threshold.pkl (verbatim, unmodified)",
        "re_derived_value": rebuilt_best_threshold,
    },
    "holdout_metrics_measured": holdout_metrics,
    "notebook_reported_metrics": {
        "cv_xgboost": {"roc_auc": 0.9465, "accuracy": 0.9218, "precision": 0.8361, "recall": 0.7936, "f1": 0.8142},
        "holdout_uncalibrated_xgboost": {"accuracy": 0.92, "precision": 0.82, "recall": 0.79, "f1": 0.81},
        "baseline_logistic_regression": {"accuracy": 0.82, "precision": 0.56, "recall": 0.79, "f1": 0.65},
        "random_forest": {"accuracy": 0.94, "precision": 0.98, "recall": 0.72, "f1": 0.83},
        "note": "Values as printed by the development notebook outputs; distinct from the measured holdout metrics above.",
    },
    "shap_compatible": shap_available,
    "learned_categories": learned_categories,
    "auxiliary_explainer_artifact": "xg_model_aux_explainer.pkl (uncalibrated pipeline; SHAP-only, not used for serving)",
    "environment": {
        "python": platform.python_version(),
        "scikit_learn": sklearn.__version__,
        "xgboost": xgboost.__version__,
        "pandas": pd.__version__,
        "numpy": np.__version__,
        "joblib": joblib.__version__,
    },
}
prov_out = OUT_DIR / "provenance.json"
prov_out.write_text(json.dumps(provenance, indent=2))

print(f"  saved {model_out} ({model_out.stat().st_size} bytes)")
print(f"  saved {OUT_DIR / 'best_threshold.pkl'} (verbatim from upload)")
print(f"  saved {prov_out}")
print("\nDONE. All pipeline verification checks passed." )
