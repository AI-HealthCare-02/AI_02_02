from __future__ import annotations

import importlib
import sys
from dataclasses import dataclass
from pathlib import Path

from sklearn.model_selection import train_test_split

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

_train_module = importlib.import_module("scripts.ml.train_diabetic_track_model")
ARTIFACT_DIR = _train_module.ARTIFACT_DIR
find_best_f1_threshold = _train_module.find_best_f1_threshold
load_diabetic_dataset = _train_module.load_diabetic_dataset
score_binary = _train_module.score_binary
train_catboost = _train_module.train_catboost

OUTPUT_PATH = ARTIFACT_DIR / "ablation_report.md"


BASE_NUMERIC = [
    "age_midpoint",
    "bmi",
    "has_hypertension",
    "glucose_risk_flag",
    "bp_stage_flag",
    "obesity_flag",
    "severe_obesity_flag",
    "family_history_flag",
    "inactivity_flag",
    "smoking_flag",
    "alcohol_risk_flag",
    "poor_sleep_flag",
    "diet_risk_flag",
    "waist_risk_flag",
    "lifestyle_burden_score",
    "metabolic_burden_score",
    "bmi_age_interaction",
    "htn_obesity_interaction",
]

BASE_CATEGORICAL = [
    "dataset_source",
    "track_relation",
    "gender",
    "age_bucket",
    "family_history",
    "exercise_frequency",
    "sleep_duration_bucket",
    "diet_risk",
    "smoking_status",
    "alcohol_frequency",
    "bmi_class",
    "fasting_glucose_range",
    "bp_stage",
    "waist_risk",
]


@dataclass
class AblationCase:
    name: str
    description: str
    drop_columns: list[str]


def evaluate_case(dataset, case: AblationCase) -> dict[str, float | str]:
    numeric_features = [col for col in BASE_NUMERIC if col not in case.drop_columns]
    categorical_features = [col for col in BASE_CATEGORICAL if col not in case.drop_columns]

    x = dataset[numeric_features + categorical_features].copy()
    y = dataset["target"].astype(int)

    for column in categorical_features:
        x[column] = x[column].astype(str)

    x_train, x_temp, y_train, y_temp = train_test_split(
        x, y, test_size=0.3, random_state=42, stratify=y
    )
    x_valid, x_test, y_valid, y_test = train_test_split(
        x_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
    )

    model = train_catboost(x_train, y_train, x_valid, y_valid, categorical_features)
    valid_prob = model.predict_proba(x_valid)[:, 1]
    threshold = find_best_f1_threshold(y_valid, valid_prob)
    valid_score = score_binary(y_valid, valid_prob, threshold)
    test_score = score_binary(y_test, model.predict_proba(x_test)[:, 1], threshold)

    return {
        "name": case.name,
        "description": case.description,
        "feature_count": len(numeric_features) + len(categorical_features),
        "threshold": threshold,
        "valid_roc_auc": valid_score.roc_auc,
        "test_roc_auc": test_score.roc_auc,
        "test_f1": test_score.f1,
        "test_precision": test_score.precision,
        "test_recall": test_score.recall,
    }


def write_report(results: list[dict[str, float | str]]) -> None:
    baseline = next(result for result in results if result["name"] == "baseline")
    lines = [
        "# Diabetic Track Ablation Report",
        "",
        "This report checks whether Model B performance is dominated by direct target-adjacent signals.",
        "",
        "## Results",
        "",
        "| Case | Feature Count | Test ROC-AUC | Delta ROC-AUC | Test F1 | Delta F1 | Precision | Recall |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]

    for result in results:
        delta_auc = float(result["test_roc_auc"]) - float(baseline["test_roc_auc"])
        delta_f1 = float(result["test_f1"]) - float(baseline["test_f1"])
        lines.append(
            f"| {result['name']} | {result['feature_count']} | {float(result['test_roc_auc']):.4f} | "
            f"{delta_auc:+.4f} | {float(result['test_f1']):.4f} | {delta_f1:+.4f} | "
            f"{float(result['test_precision']):.4f} | {float(result['test_recall']):.4f} |"
        )

    lines.extend(["", "## Case Notes", ""])
    for result in results:
        lines.append(
            f"- `{result['name']}`: {result['description']} "
            f"(threshold={float(result['threshold']):.2f}, valid ROC-AUC={float(result['valid_roc_auc']):.4f})"
        )

    lines.extend(
        [
            "",
            "## Interpretation Guide",
            "",
            "- Small drops mean the model still works without that feature group.",
            "- Large drops mean that feature group is carrying a large share of separability.",
            "- If direct glucose/BP removals cause major collapse, Model B should be framed as a management prioritization model, not a pure progression predictor.",
        ]
    )

    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    diabetic_dataset, _ = load_diabetic_dataset()
    cases = [
        AblationCase(
            name="baseline",
            description="Current champion feature set.",
            drop_columns=[],
        ),
        AblationCase(
            name="no_track_relation",
            description="Remove diagnosed/prediabetes track label from inputs.",
            drop_columns=["track_relation"],
        ),
        AblationCase(
            name="no_glucose_features",
            description="Remove direct glucose range and derived glucose flag.",
            drop_columns=["fasting_glucose_range", "glucose_risk_flag"],
        ),
        AblationCase(
            name="no_bp_features",
            description="Remove blood-pressure stage and derived BP flag.",
            drop_columns=["bp_stage", "bp_stage_flag"],
        ),
        AblationCase(
            name="no_direct_severity_bundle",
            description="Remove track_relation, glucose, and BP direct severity inputs together.",
            drop_columns=[
                "track_relation",
                "fasting_glucose_range",
                "glucose_risk_flag",
                "bp_stage",
                "bp_stage_flag",
            ],
        ),
        AblationCase(
            name="service_lifestyle_core",
            description="Keep only service-friendly demographic/lifestyle/metabolic burden features.",
            drop_columns=[
                "track_relation",
                "fasting_glucose_range",
                "glucose_risk_flag",
                "bp_stage",
                "bp_stage_flag",
                "waist_risk",
                "waist_risk_flag",
            ],
        ),
    ]

    results = [evaluate_case(diabetic_dataset, case) for case in cases]
    write_report(results)

    print(f"report_path={OUTPUT_PATH}")
    for result in results:
        print(
            f"{result['name']}: "
            f"test_roc_auc={float(result['test_roc_auc']):.6f}, "
            f"test_f1={float(result['test_f1']):.6f}, "
            f"precision={float(result['test_precision']):.6f}, "
            f"recall={float(result['test_recall']):.6f}"
        )


if __name__ == "__main__":
    main()
