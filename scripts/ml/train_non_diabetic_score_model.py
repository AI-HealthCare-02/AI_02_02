from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from catboost import CatBoostRegressor
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

ARTIFACT_DIR = PROJECT_ROOT / "tools" / "ml_artifacts" / "non_diabetic_track"
REPORT_PATH = ARTIFACT_DIR / "score_regression_report.md"
DATASET_PATH = ARTIFACT_DIR / "score_regression_dataset.csv"

EXPERIMENT_SAMPLE_CAP = 120_000


@dataclass
class RegressionScore:
    mae: float
    rmse: float
    r2: float


@dataclass
class RegressionCandidate:
    model_name: str
    validation: RegressionScore
    test: RegressionScore


@dataclass
class RegressionArtifact:
    key: str
    title: str
    target_description: str
    dataset_description: str
    rows_used_for_training: int
    feature_columns: list[str]
    score_formula: dict[str, object]
    candidates: list[RegressionCandidate]
    selected_model: str
    baseline_model: str
    best_validation_model: str
    notes: list[str]


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def age_risk(age_bucket: str) -> float:
    mapping = {
        "under_45": 0.00,
        "45_54": 0.33,
        "55_64": 0.67,
        "65_plus": 1.00,
    }
    return mapping.get(str(age_bucket), 0.33)


def bmi_risk(bmi: float) -> float:
    if bmi < 23:
        return 0.00
    if bmi < 25:
        return 0.33
    if bmi < 30:
        return 0.67
    return 1.00


def family_risk(value: str) -> float:
    return 1.00 if value in {"parents", "siblings", "both"} else 0.00


def hypertension_risk(value: int | bool) -> float:
    return 1.00 if bool(value) else 0.00


def inactivity_risk(value: str) -> float:
    mapping = {
        "5_plus_per_week": 0.00,
        "3_4_per_week": 0.25,
        "1_2_per_week": 0.60,
        "none": 1.00,
        "unknown": 0.50,
    }
    return mapping.get(str(value), 0.50)


def diet_risk(value: str) -> float:
    mapping = {
        "supportive": 0.00,
        "moderate_risk": 0.50,
        "high_risk": 1.00,
        "unknown": 0.40,
    }
    return mapping.get(str(value), 0.40)


def sleep_risk(value: str) -> float:
    mapping = {
        "between_7_8": 0.00,
        "between_6_7": 0.25,
        "over_8": 0.30,
        "between_5_6": 0.70,
        "under_5": 1.00,
        "unknown": 0.40,
    }
    return mapping.get(str(value), 0.40)


def smoking_risk(value: str) -> float:
    mapping = {
        "non_smoker": 0.00,
        "former": 0.40,
        "current": 1.00,
        "unknown": 0.30,
    }
    return mapping.get(str(value), 0.30)


def alcohol_risk(value: str) -> float:
    mapping = {
        "none": 0.00,
        "sometimes": 0.25,
        "often": 0.60,
        "daily": 1.00,
        "unknown": 0.20,
    }
    return mapping.get(str(value), 0.20)


def calculate_non_diabetic_risk_score(row: pd.Series) -> float:
    core_score = 100 * (
        0.30 * age_risk(row["age_bucket"])
        + 0.30 * bmi_risk(float(row["bmi"]))
        + 0.15 * family_risk(row["family_history"])
        + 0.15 * hypertension_risk(row["has_hypertension"])
        + 0.10 * inactivity_risk(row["exercise_frequency"])
    )
    lifestyle_score = 100 * (
        0.40 * diet_risk(row["diet_risk"])
        + 0.30 * sleep_risk(row["sleep_duration_bucket"])
        + 0.20 * smoking_risk(row["smoking_status"])
        + 0.10 * alcohol_risk(row["alcohol_frequency"])
    )
    final_score = round((0.75 * core_score) + (0.25 * lifestyle_score), 1)
    return clamp01(final_score / 100.0) * 100.0


def build_dataset() -> pd.DataFrame:
    from scripts.ml.train_diabetic_track_model import load_non_diabetic_dataset

    dataset, _raw_rows = load_non_diabetic_dataset()
    dataset = dataset.copy()
    dataset["non_diabetic_risk_score"] = dataset.apply(calculate_non_diabetic_risk_score, axis=1)

    if len(dataset) > EXPERIMENT_SAMPLE_CAP:
        dataset = dataset.sample(n=EXPERIMENT_SAMPLE_CAP, random_state=42).reset_index(drop=True)

    return dataset


def score_regression(y_true: pd.Series, predictions: np.ndarray) -> RegressionScore:
    return RegressionScore(
        mae=float(mean_absolute_error(y_true, predictions)),
        rmse=float(np.sqrt(mean_squared_error(y_true, predictions))),
        r2=float(r2_score(y_true, predictions)),
    )


def build_mlp_pipeline(numeric_features: list[str], categorical_features: list[str]) -> Pipeline:
    preprocessor = ColumnTransformer(
        [
            (
                "num",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                numeric_features,
            ),
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_features,
            ),
        ]
    )
    return Pipeline(
        [
            ("preprocessor", preprocessor),
            (
                "mlp",
                MLPRegressor(
                    hidden_layer_sizes=(64, 32, 16),
                    activation="relu",
                    solver="adam",
                    learning_rate_init=1e-3,
                    batch_size=256,
                    max_iter=160,
                    alpha=1e-4,
                    early_stopping=True,
                    validation_fraction=0.15,
                    random_state=42,
                ),
            ),
        ]
    )


def train_catboost(
    x_train: pd.DataFrame,
    y_train: pd.Series,
    x_valid: pd.DataFrame,
    y_valid: pd.Series,
    categorical_features: list[str],
) -> CatBoostRegressor:
    cat_indices = [x_train.columns.get_loc(col) for col in categorical_features]
    model = CatBoostRegressor(
        loss_function="RMSE",
        eval_metric="RMSE",
        depth=6,
        learning_rate=0.05,
        iterations=500,
        random_seed=42,
        verbose=False,
    )
    model.fit(
        x_train,
        y_train,
        eval_set=(x_valid, y_valid),
        cat_features=cat_indices,
        use_best_model=True,
        verbose=False,
    )
    return model


def run_experiment(
    dataset: pd.DataFrame,
) -> tuple[dict[str, object], list[RegressionCandidate], str, str, str, list[str]]:
    numeric_features = [
        "age_midpoint",
        "bmi",
        "has_hypertension",
        "obesity_flag",
        "severe_obesity_flag",
        "family_history_flag",
        "inactivity_flag",
        "smoking_flag",
        "alcohol_risk_flag",
        "poor_sleep_flag",
        "diet_risk_flag",
        "lifestyle_burden_score",
        "bmi_age_interaction",
    ]
    categorical_features = [
        "dataset_source",
        "gender",
        "age_bucket",
        "family_history",
        "exercise_frequency",
        "sleep_duration_bucket",
        "diet_risk",
        "smoking_status",
        "alcohol_frequency",
        "bmi_class",
    ]
    feature_columns = numeric_features + categorical_features
    x = dataset[feature_columns].copy()
    y = dataset["non_diabetic_risk_score"].astype(float)
    for column in categorical_features:
        x[column] = x[column].astype(str)

    x_train, x_temp, y_train, y_temp = train_test_split(x, y, test_size=0.30, random_state=42)
    x_valid, x_test, y_valid, y_test = train_test_split(x_temp, y_temp, test_size=0.50, random_state=42)

    trained_models: dict[str, object] = {}
    candidates: list[RegressionCandidate] = []

    mlp = build_mlp_pipeline(numeric_features, categorical_features)
    mlp.fit(x_train, y_train)
    mlp_valid_pred = mlp.predict(x_valid)
    mlp_test_pred = mlp.predict(x_test)
    candidates.append(
        RegressionCandidate(
            model_name="mlp_regressor",
            validation=score_regression(y_valid, mlp_valid_pred),
            test=score_regression(y_test, mlp_test_pred),
        )
    )
    trained_models["mlp_regressor"] = mlp

    catboost = train_catboost(x_train, y_train, x_valid, y_valid, categorical_features)
    cat_valid_pred = catboost.predict(x_valid)
    cat_test_pred = catboost.predict(x_test)
    candidates.append(
        RegressionCandidate(
            model_name="catboost_regressor",
            validation=score_regression(y_valid, cat_valid_pred),
            test=score_regression(y_test, cat_test_pred),
        )
    )
    trained_models["catboost_regressor"] = catboost

    best_validation_model = min(candidates, key=lambda item: item.validation.rmse).model_name
    selected_model = "mlp_regressor"
    baseline_model = "catboost_regressor"
    return trained_models, candidates, selected_model, baseline_model, best_validation_model, feature_columns


def write_report(artifact: RegressionArtifact) -> None:
    lines = [
        "# Non-Diabetic Track Score Regression",
        "",
        f"- Target: `{artifact.target_description}`",
        f"- Dataset: `{artifact.dataset_description}`",
        f"- Rows used for training: `{artifact.rows_used_for_training:,}`",
        f"- Selected Model: `{artifact.selected_model}`",
        f"- Baseline Model: `{artifact.baseline_model}`",
        f"- Best Validation Model: `{artifact.best_validation_model}`",
        "",
        "## Features",
        ", ".join(f"`{item}`" for item in artifact.feature_columns),
        "",
        "## Score Formula",
        "```json",
        json.dumps(artifact.score_formula, ensure_ascii=False, indent=2),
        "```",
        "",
        "## Candidate Results",
    ]
    for candidate in artifact.candidates:
        lines.extend(
            [
                f"### {candidate.model_name}",
                f"- Validation MAE: `{candidate.validation.mae:.4f}`",
                f"- Validation RMSE: `{candidate.validation.rmse:.4f}`",
                f"- Validation R2: `{candidate.validation.r2:.4f}`",
                f"- Test MAE: `{candidate.test.mae:.4f}`",
                f"- Test RMSE: `{candidate.test.rmse:.4f}`",
                f"- Test R2: `{candidate.test.r2:.4f}`",
                "",
            ]
        )
    lines.extend(
        [
            "## Notes",
            *[f"- {note}" for note in artifact.notes],
            "",
        ]
    )
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    dataset = build_dataset()
    dataset.to_csv(DATASET_PATH, index=False, encoding="utf-8-sig")

    trained_models, candidates, selected_model, baseline_model, best_validation_model, feature_columns = run_experiment(dataset)
    artifact = RegressionArtifact(
        key="non_diabetic_score_regression",
        title="Non-Diabetic Track Score Regression",
        target_description="0-100 service-side risk score generated from non-invasive non-diabetic track features.",
        dataset_description="NHIS 2024 + BRFSS 2015 + Mesra 2019 aligned into the service feature space, then rescored with the non-diabetic formula.",
        rows_used_for_training=len(dataset),
        feature_columns=feature_columns,
        score_formula={
            "final": "0.75 * core_score + 0.25 * lifestyle_score",
            "core_weights": {
                "age_risk": 0.30,
                "bmi_risk": 0.30,
                "family_risk": 0.15,
                "hypertension_risk": 0.15,
                "inactivity_risk": 0.10,
            },
            "lifestyle_weights": {
                "diet_risk": 0.40,
                "sleep_risk": 0.30,
                "smoking_risk": 0.20,
                "alcohol_risk": 0.10,
            },
        },
        candidates=candidates,
        selected_model=selected_model,
        baseline_model=baseline_model,
        best_validation_model=best_validation_model,
        notes=[
            "This experiment converts the non-diabetic track from binary classification to score regression.",
            "The target score is formula-derived and should be interpreted as service-side risk prioritization, not diagnosis.",
            "MLPRegressor is the current project selection, and CatBoostRegressor is retained as the baseline comparator.",
            "The best validation metric should be interpreted separately from the final project-side model selection.",
        ],
    )

    joblib.dump(trained_models[selected_model], ARTIFACT_DIR / "model.joblib")
    (ARTIFACT_DIR / "metadata.json").write_text(
        json.dumps(asdict(artifact), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    write_report(artifact)

    print(f"rows_used={len(dataset)}")
    print(f"selected_model={selected_model}")
    print(f"best_validation_model={best_validation_model}")
    for candidate in candidates:
        print(
            f"{candidate.model_name}.test_mae={candidate.test.mae:.6f} "
            f"test_rmse={candidate.test.rmse:.6f} "
            f"test_r2={candidate.test.r2:.6f}"
        )


if __name__ == "__main__":
    main()
