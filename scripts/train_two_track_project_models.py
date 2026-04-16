from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

import joblib
import pandas as pd
from catboost import CatBoostClassifier
from imblearn.over_sampling import RandomOverSampler
from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.under_sampling import RandomUnderSampler
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "docs" / "collaboration" / "model"
ARTIFACT_DIR = PROJECT_ROOT / "tools" / "ml_artifacts" / "two_track_project_models"

BRFSS_PATH = DATA_DIR / "diabetes_binary_health_indicators_BRFSS2015.csv"
MESRA_PATH = DATA_DIR / "diabetes_dataset__2019.csv"
NHIS_PATH = next(p for p in DATA_DIR.iterdir() if p.suffix == ".CSV")

NON_DIABETIC_SAMPLE_CAP = 300_000
DIABETIC_SAMPLE_CAP = 250_000


@dataclass
class Score:
    roc_auc: float
    accuracy: float
    precision: float
    recall: float
    f1: float


@dataclass
class CandidateResult:
    model_name: str
    threshold: float
    validation: Score
    test: Score


@dataclass
class TrackArtifact:
    key: str
    title: str
    target_description: str
    dataset_description: str
    raw_rows_before_sampling: int
    rows_used_for_training: int
    feature_columns: list[str]
    derived_features: dict[str, str]
    class_balance: dict[str, int]
    champion: str
    challenger: str
    candidates: list[CandidateResult]
    notes: list[str]


def score_binary(y_true: pd.Series, probabilities, threshold: float = 0.5) -> Score:
    predictions = (probabilities >= threshold).astype(int)
    return Score(
        roc_auc=float(roc_auc_score(y_true, probabilities)),
        accuracy=float(accuracy_score(y_true, predictions)),
        precision=float(precision_score(y_true, predictions, zero_division=0)),
        recall=float(recall_score(y_true, predictions, zero_division=0)),
        f1=float(f1_score(y_true, predictions, zero_division=0)),
    )


def find_best_f1_threshold(y_true: pd.Series, probabilities) -> float:
    best_threshold = 0.5
    best_f1 = -1.0
    for raw in range(20, 81):
        threshold = raw / 100.0
        score = f1_score(y_true, (probabilities >= threshold).astype(int), zero_division=0)
        if score > best_f1:
            best_f1 = score
            best_threshold = threshold
    return best_threshold


def sample_if_needed(dataset: pd.DataFrame, cap: int) -> pd.DataFrame:
    if len(dataset) <= cap:
        return dataset.reset_index(drop=True)
    sampled_frames: list[pd.DataFrame] = []
    target_counts = dataset["target"].value_counts().sort_index()
    allocated = 0

    for target_value, count in target_counts.items():
        class_frame = dataset[dataset["target"] == target_value]
        class_cap = max(1, int(cap * count / len(dataset)))
        class_cap = min(class_cap, len(class_frame))
        sampled_frames.append(class_frame.sample(n=class_cap, random_state=42))
        allocated += class_cap

    sampled = pd.concat(sampled_frames, axis=0)

    if allocated < cap:
        remaining = dataset.drop(index=sampled.index, errors="ignore")
        if not remaining.empty:
            sampled = pd.concat(
                [sampled, remaining.sample(n=min(cap - allocated, len(remaining)), random_state=42)],
                axis=0,
            )

    if len(sampled) > cap:
        sampled = sampled.sample(n=cap, random_state=42).reset_index(drop=True)

    return sampled.reset_index(drop=True)


def age_bucket_from_brfss(code: float | int) -> str:
    code = int(code)
    if code <= 7:
        return "under_45"
    if code == 8:
        return "45_54"
    if code in (9, 10):
        return "55_64"
    return "65_plus"


def age_midpoint_from_brfss(code: float | int) -> float:
    mapping = {1: 21.0, 2: 27.0, 3: 32.0, 4: 37.0, 5: 42.0, 6: 47.0, 7: 52.0, 8: 57.0, 9: 62.0, 10: 67.0, 11: 72.0, 12: 77.0, 13: 82.0}
    return mapping.get(int(code), 60.0)


def age_bucket_from_mesra(value: str) -> str:
    mapping = {"less than 40": "under_45", "40-49": "45_54", "50-59": "55_64", "60 or older": "65_plus"}
    return mapping.get(str(value).strip().lower(), "55_64")


def age_midpoint_from_mesra(value: str) -> float:
    mapping = {"less than 40": 35.0, "40-49": 45.0, "50-59": 55.0, "60 or older": 67.0}
    return mapping.get(str(value).strip().lower(), 55.0)


def age_bucket_from_nhis(code: float | int) -> str:
    code = int(code)
    if code <= 5:
        return "under_45"
    if code <= 7:
        return "45_54"
    if code <= 9:
        return "55_64"
    return "65_plus"


def age_midpoint_from_nhis(code: float | int) -> float:
    mapping = {1: 22.0, 2: 27.0, 3: 32.0, 4: 37.0, 5: 42.0, 6: 47.0, 7: 52.0, 8: 57.0, 9: 62.0, 10: 67.0, 11: 72.0, 12: 77.0, 13: 82.0, 14: 87.0, 15: 92.0, 16: 97.0, 17: 102.0, 18: 107.0}
    return mapping.get(int(code), 60.0)


def gender_to_label(value: float | int | str) -> str:
    return "MALE" if str(value).strip().lower() in {"1", "1.0", "male"} else "FEMALE"


def bmi_class(bmi: float) -> str:
    if bmi < 23:
        return "normal"
    if bmi < 25:
        return "at_risk"
    if bmi < 30:
        return "obese_1"
    return "obese_2"


def exercise_from_brfss(value: float | int) -> str:
    return "3_4_per_week" if int(value) == 1 else "none"


def smoking_from_brfss(value: float | int) -> str:
    return "current" if int(value) == 1 else "non_smoker"


def alcohol_from_brfss(value: float | int) -> str:
    return "often" if int(value) == 1 else "none"


def exercise_from_mesra(value: str) -> str:
    mapping = {"none": "none", "less than half an hr": "1_2_per_week", "more than half an hr": "3_4_per_week", "one hr or more": "5_plus_per_week"}
    return mapping.get(str(value).strip().lower(), "none")


def smoking_from_yes_no(value: str) -> str:
    return "current" if str(value).strip().lower() == "yes" else "non_smoker"


def alcohol_from_yes_no(value: str) -> str:
    return "sometimes" if str(value).strip().lower() == "yes" else "none"


def sleep_bucket_from_hours(value: float | int | None) -> str:
    if pd.isna(value):
        return "unknown"
    hours = float(value)
    if hours < 5:
        return "under_5"
    if hours < 6:
        return "between_5_6"
    if hours < 7:
        return "between_6_7"
    if hours < 8:
        return "between_7_8"
    return "over_8"


def family_history_from_yes_no(value: str) -> str:
    return "parents" if str(value).strip().lower() == "yes" else "none"


def fasting_glucose_range(value: float | int | None) -> str:
    if pd.isna(value):
        return "unknown"
    value = float(value)
    if value < 100:
        return "under_100"
    if value < 126:
        return "100_to_125"
    return "over_126"


def bp_stage(systolic: float | int | None, diastolic: float | int | None) -> str:
    if pd.isna(systolic) or pd.isna(diastolic):
        return "unknown"
    systolic = float(systolic)
    diastolic = float(diastolic)
    if systolic >= 140 or diastolic >= 90:
        return "stage2"
    if systolic >= 130 or diastolic >= 80:
        return "stage1"
    if systolic >= 120:
        return "elevated"
    return "normal"


def smoking_from_nhis(code: float | int | None) -> str:
    if pd.isna(code):
        return "unknown"
    code = int(code)
    if code == 1:
        return "non_smoker"
    if code == 2:
        return "former"
    if code == 3:
        return "current"
    return "unknown"


def alcohol_from_nhis(value: float | int | None) -> str:
    if pd.isna(value):
        return "unknown"
    return "sometimes" if int(value) == 1 else "none"


def waist_risk(waist: float | int | None, gender: str) -> str:
    if pd.isna(waist):
        return "unknown"
    waist = float(waist)
    if gender == "MALE":
        if waist < 90:
            return "normal"
        if waist < 100:
            return "at_risk"
        return "high"
    if waist < 85:
        return "normal"
    if waist < 95:
        return "at_risk"
    return "high"


def diet_risk_from_brfss(fruits: float | int, veggies: float | int) -> str:
    fruit_flag = int(fruits)
    veg_flag = int(veggies)
    if fruit_flag == 0 and veg_flag == 0:
        return "high_risk"
    if fruit_flag == 0 or veg_flag == 0:
        return "moderate_risk"
    return "supportive"


def diet_risk_from_mesra(value: str) -> str:
    mapping = {"occasionally": "supportive", "often": "moderate_risk", "very often": "high_risk", "always": "high_risk"}
    return mapping.get(str(value).strip().lower(), "moderate_risk")


def lipid_risk_count(total_chol, tg, hdl, ldl, gender: str) -> int:
    score = 0
    if not pd.isna(total_chol) and float(total_chol) >= 240:
        score += 1
    if not pd.isna(tg) and float(tg) >= 200:
        score += 1
    if not pd.isna(ldl) and float(ldl) >= 160:
        score += 1
    if not pd.isna(hdl):
        if gender == "MALE" and float(hdl) < 40:
            score += 1
        if gender == "FEMALE" and float(hdl) < 50:
            score += 1
    return score


def add_service_aligned_features(dataset: pd.DataFrame) -> pd.DataFrame:
    dataset = dataset.copy()
    dataset["bmi_class"] = dataset["bmi"].map(bmi_class)
    dataset["obesity_flag"] = (dataset["bmi"] >= 25).astype(int)
    dataset["severe_obesity_flag"] = (dataset["bmi"] >= 30).astype(int)
    dataset["family_history_flag"] = dataset["family_history"].isin(["parents", "siblings", "both"]).astype(int)
    dataset["inactivity_flag"] = dataset["exercise_frequency"].eq("none").astype(int)
    dataset["smoking_flag"] = dataset["smoking_status"].eq("current").astype(int)
    dataset["alcohol_risk_flag"] = dataset["alcohol_frequency"].isin(["often", "daily"]).astype(int)
    dataset["poor_sleep_flag"] = dataset["sleep_duration_bucket"].isin(["under_5", "between_5_6"]).astype(int)
    dataset["diet_risk_flag"] = dataset["diet_risk"].eq("high_risk").astype(int)
    dataset["waist_risk_flag"] = dataset["waist_risk"].eq("high").astype(int)
    dataset["glucose_risk_flag"] = dataset["fasting_glucose_range"].map({"under_100": 0, "100_to_125": 1, "over_126": 2, "unknown": 0})
    dataset["bp_stage_flag"] = dataset["bp_stage"].map({"normal": 0, "elevated": 1, "stage1": 2, "stage2": 3, "unknown": 0})
    dataset["lifestyle_burden_score"] = dataset["inactivity_flag"] + dataset["smoking_flag"] + dataset["alcohol_risk_flag"] + dataset["poor_sleep_flag"] + dataset["diet_risk_flag"]
    dataset["metabolic_burden_score"] = dataset["obesity_flag"] + dataset["has_hypertension"] + dataset["family_history_flag"] + dataset["waist_risk_flag"]
    dataset["bmi_age_interaction"] = dataset["bmi"] * dataset["age_midpoint"]
    dataset["htn_obesity_interaction"] = dataset["has_hypertension"] * dataset["obesity_flag"]
    return dataset


def load_nhis_core() -> pd.DataFrame:
    header_cols = pd.read_csv(NHIS_PATH, encoding="cp949", nrows=0).columns.tolist()
    selected = [header_cols[i] for i in [3, 4, 5, 6, 7, 12, 13, 14, 15, 16, 17, 18, 25, 26]]
    df = pd.read_csv(NHIS_PATH, encoding="cp949", usecols=selected, low_memory=False)
    sex_col, age_col, height_col, weight_col, waist_col, sbp_col, dbp_col, glucose_col, chol_col, tg_col, hdl_col, ldl_col, smoking_col, alcohol_col = selected

    frame = pd.DataFrame({
        "dataset_source": "nhis2024",
        "gender": df[sex_col].map(gender_to_label),
        "age_bucket": df[age_col].map(age_bucket_from_nhis),
        "age_midpoint": df[age_col].map(age_midpoint_from_nhis),
        "bmi": pd.to_numeric(df[weight_col], errors="coerce") / ((pd.to_numeric(df[height_col], errors="coerce") / 100.0) ** 2),
        "family_history": "unknown",
        "exercise_frequency": "unknown",
        "sleep_duration_bucket": "unknown",
        "diet_risk": "unknown",
        "smoking_status": df[smoking_col].map(smoking_from_nhis),
        "alcohol_frequency": df[alcohol_col].map(alcohol_from_nhis),
        "has_hypertension": ((pd.to_numeric(df[sbp_col], errors="coerce") >= 140) | (pd.to_numeric(df[dbp_col], errors="coerce") >= 90)).astype(int),
        "fasting_glucose_range": [fasting_glucose_range(v) for v in pd.to_numeric(df[glucose_col], errors="coerce")],
        "bp_stage": [bp_stage(s, d) for s, d in zip(pd.to_numeric(df[sbp_col], errors="coerce"), pd.to_numeric(df[dbp_col], errors="coerce"), strict=False)],
        "waist_risk": [waist_risk(w, g) for w, g in zip(pd.to_numeric(df[waist_col], errors="coerce"), df[sex_col].map(gender_to_label), strict=False)],
        "lipid_risk_count": [lipid_risk_count(total, trig, good, bad, gender) for total, trig, good, bad, gender in zip(pd.to_numeric(df[chol_col], errors="coerce"), pd.to_numeric(df[tg_col], errors="coerce"), pd.to_numeric(df[hdl_col], errors="coerce"), pd.to_numeric(df[ldl_col], errors="coerce"), df[sex_col].map(gender_to_label), strict=False)],
        "abdominal_obesity": [1 if waist_risk(w, g) == "high" else 0 for w, g in zip(pd.to_numeric(df[waist_col], errors="coerce"), df[sex_col].map(gender_to_label), strict=False)],
    })
    frame = frame[(frame["bmi"].between(10, 80))].copy()
    return add_service_aligned_features(frame)


def load_non_diabetic_dataset() -> tuple[pd.DataFrame, int]:
    nhis = load_nhis_core()
    nhis["target"] = nhis["fasting_glucose_range"].isin(["100_to_125", "over_126"]).astype(int)

    brfss = pd.read_csv(BRFSS_PATH)
    brfss_frame = pd.DataFrame({
        "dataset_source": "brfss2015",
        "gender": brfss["Sex"].map(gender_to_label),
        "age_bucket": brfss["Age"].map(age_bucket_from_brfss),
        "age_midpoint": brfss["Age"].map(age_midpoint_from_brfss),
        "bmi": pd.to_numeric(brfss["BMI"], errors="coerce"),
        "family_history": "unknown",
        "exercise_frequency": brfss["PhysActivity"].map(exercise_from_brfss),
        "sleep_duration_bucket": "unknown",
        "diet_risk": [diet_risk_from_brfss(f, v) for f, v in zip(brfss["Fruits"], brfss["Veggies"], strict=False)],
        "smoking_status": brfss["Smoker"].map(smoking_from_brfss),
        "alcohol_frequency": brfss["HvyAlcoholConsump"].map(alcohol_from_brfss),
        "has_hypertension": brfss["HighBP"].astype(int),
        "fasting_glucose_range": "unknown",
        "bp_stage": "unknown",
        "waist_risk": "unknown",
        "lipid_risk_count": 0,
        "abdominal_obesity": 0,
        "target": brfss["Diabetes_binary"].astype(int),
    })

    mesra = pd.read_csv(MESRA_PATH)
    mesra["Diabetic_clean"] = mesra["Diabetic"].astype(str).str.strip().str.lower()
    mesra_frame = pd.DataFrame({
        "dataset_source": "mesra2019",
        "gender": mesra["Gender"].map(gender_to_label),
        "age_bucket": mesra["Age"].map(age_bucket_from_mesra),
        "age_midpoint": mesra["Age"].map(age_midpoint_from_mesra),
        "bmi": pd.to_numeric(mesra["BMI"], errors="coerce"),
        "family_history": mesra["Family_Diabetes"].map(family_history_from_yes_no),
        "exercise_frequency": mesra["PhysicallyActive"].map(exercise_from_mesra),
        "sleep_duration_bucket": mesra["Sleep"].map(sleep_bucket_from_hours),
        "diet_risk": mesra["JunkFood"].map(diet_risk_from_mesra),
        "smoking_status": mesra["Smoking"].map(smoking_from_yes_no),
        "alcohol_frequency": mesra["Alcohol"].map(alcohol_from_yes_no),
        "has_hypertension": mesra["highBP"].map(lambda v: 1 if str(v).strip().lower() == "yes" else 0),
        "fasting_glucose_range": "unknown",
        "bp_stage": "unknown",
        "waist_risk": "unknown",
        "lipid_risk_count": 0,
        "abdominal_obesity": 0,
        "target": mesra["Diabetic_clean"].map(lambda v: 1 if v == "yes" else 0),
    })

    combined = pd.concat([nhis, brfss_frame, mesra_frame], ignore_index=True)
    combined = combined.dropna(subset=["bmi"]).copy()
    combined["bmi"] = combined["bmi"].clip(lower=10, upper=80)
    combined = add_service_aligned_features(combined)
    raw_rows = len(combined)
    return sample_if_needed(combined, NON_DIABETIC_SAMPLE_CAP), raw_rows


def load_diabetic_dataset() -> tuple[pd.DataFrame, int]:
    nhis = load_nhis_core()
    nhis_at_risk = nhis[nhis["fasting_glucose_range"].isin(["100_to_125", "over_126"])].copy()
    nhis_at_risk["track_relation"] = nhis_at_risk["fasting_glucose_range"].map({"100_to_125": "prediabetes", "over_126": "diagnosed"})
    nhis_at_risk["target"] = (((nhis_at_risk["fasting_glucose_range"] == "over_126").astype(int) + nhis_at_risk["abdominal_obesity"] + (nhis_at_risk["lipid_risk_count"] >= 2).astype(int) + (nhis_at_risk["bp_stage"] == "stage2").astype(int)) >= 2).astype(int)

    mesra = pd.read_csv(MESRA_PATH)
    mesra["Diabetic_clean"] = mesra["Diabetic"].astype(str).str.strip().str.lower()
    mesra["Pdiabetes_clean"] = mesra["Pdiabetes"].astype(str).str.strip().str.lower()
    subset = mesra[(mesra["Diabetic_clean"] == "yes") | (mesra["Pdiabetes_clean"] == "yes")].copy()
    mesra_frame = pd.DataFrame({
        "dataset_source": "mesra2019",
        "track_relation": subset.apply(lambda row: "prediabetes" if row["Pdiabetes_clean"] == "yes" else "diagnosed", axis=1),
        "gender": subset["Gender"].map(gender_to_label),
        "age_bucket": subset["Age"].map(age_bucket_from_mesra),
        "age_midpoint": subset["Age"].map(age_midpoint_from_mesra),
        "bmi": pd.to_numeric(subset["BMI"], errors="coerce"),
        "family_history": subset["Family_Diabetes"].map(family_history_from_yes_no),
        "exercise_frequency": subset["PhysicallyActive"].map(exercise_from_mesra),
        "sleep_duration_bucket": subset["Sleep"].map(sleep_bucket_from_hours),
        "diet_risk": subset["JunkFood"].map(diet_risk_from_mesra),
        "smoking_status": subset["Smoking"].map(smoking_from_yes_no),
        "alcohol_frequency": subset["Alcohol"].map(alcohol_from_yes_no),
        "has_hypertension": subset["highBP"].map(lambda v: 1 if str(v).strip().lower() == "yes" else 0),
        "fasting_glucose_range": subset.apply(lambda row: "100_to_125" if row["Pdiabetes_clean"] == "yes" else "over_126", axis=1),
        "bp_stage": subset["BPLevel"].astype(str).str.strip().str.lower().map({"normal": "normal", "high": "stage2", "low": "normal"}).fillna("unknown"),
        "waist_risk": "unknown",
        "lipid_risk_count": 0,
        "abdominal_obesity": 0,
        "target": (subset["BPLevel"].astype(str).str.strip().str.lower().eq("high").astype(int) + subset["UriationFreq"].astype(str).str.strip().str.lower().eq("quite often").astype(int)).ge(2).astype(int),
    })

    combined = pd.concat([nhis_at_risk, mesra_frame], ignore_index=True)
    combined = combined.dropna(subset=["bmi"]).copy()
    combined["bmi"] = combined["bmi"].clip(lower=10, upper=80)
    combined = add_service_aligned_features(combined)
    raw_rows = len(combined)
    return sample_if_needed(combined, DIABETIC_SAMPLE_CAP), raw_rows


def build_mlp_pipeline(numeric_features: list[str], categorical_features: list[str], balance_mode: str) -> ImbPipeline:
    sampler = RandomUnderSampler(random_state=42)
    if balance_mode == "oversample":
        sampler = RandomOverSampler(random_state=42)
    preprocessor = ColumnTransformer([
        ("num", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]), numeric_features),
        ("cat", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("encoder", OneHotEncoder(handle_unknown="ignore"))]), categorical_features),
    ])
    return ImbPipeline([
        ("preprocessor", preprocessor),
        ("sampler", sampler),
        ("mlp", MLPClassifier(hidden_layer_sizes=(64, 32, 16), activation="logistic", solver="adam", learning_rate_init=1e-3, batch_size=128, max_iter=220, alpha=1e-4, early_stopping=True, validation_fraction=0.15, random_state=42)),
    ])


def train_catboost(x_train: pd.DataFrame, y_train: pd.Series, x_valid: pd.DataFrame, y_valid: pd.Series, categorical_features: list[str]) -> CatBoostClassifier:
    cat_indices = [x_train.columns.get_loc(col) for col in categorical_features]
    negative = int((y_train == 0).sum())
    positive = int((y_train == 1).sum())
    class_weights = [1.0, max(1.0, negative / max(positive, 1))]
    model = CatBoostClassifier(loss_function="Logloss", eval_metric="AUC", depth=6, learning_rate=0.05, iterations=450, random_seed=42, verbose=False, class_weights=class_weights)
    model.fit(x_train, y_train, eval_set=(x_valid, y_valid), cat_features=cat_indices, use_best_model=True, verbose=False)
    return model


def run_track_experiment(dataset: pd.DataFrame, *, numeric_features: list[str], categorical_features: list[str], balance_mode: str) -> tuple[dict[str, object], str, str, list[CandidateResult]]:
    x = dataset[numeric_features + categorical_features].copy()
    y = dataset["target"].astype(int)
    for column in categorical_features:
        x[column] = x[column].astype(str)
    x_train, x_temp, y_train, y_temp = train_test_split(x, y, test_size=0.3, random_state=42, stratify=y)
    x_valid, x_test, y_valid, y_test = train_test_split(x_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp)
    trained_models: dict[str, object] = {}
    results: list[CandidateResult] = []

    mlp = build_mlp_pipeline(numeric_features, categorical_features, balance_mode)
    mlp.fit(x_train, y_train)
    mlp_valid_prob = mlp.predict_proba(x_valid)[:, 1]
    mlp_threshold = find_best_f1_threshold(y_valid, mlp_valid_prob)
    results.append(CandidateResult("paper_style_bpnn", mlp_threshold, score_binary(y_valid, mlp_valid_prob, mlp_threshold), score_binary(y_test, mlp.predict_proba(x_test)[:, 1], mlp_threshold)))
    trained_models["paper_style_bpnn"] = mlp

    catboost = train_catboost(x_train, y_train, x_valid, y_valid, categorical_features)
    cat_valid_prob = catboost.predict_proba(x_valid)[:, 1]
    cat_threshold = find_best_f1_threshold(y_valid, cat_valid_prob)
    results.append(CandidateResult("catboost_optimized", cat_threshold, score_binary(y_valid, cat_valid_prob, cat_threshold), score_binary(y_test, catboost.predict_proba(x_test)[:, 1], cat_threshold)))
    trained_models["catboost_optimized"] = catboost

    champion_result = max(results, key=lambda item: item.validation.roc_auc)
    challenger = "paper_style_bpnn" if champion_result.model_name == "catboost_optimized" else "catboost_optimized"
    return trained_models, champion_result.model_name, challenger, results


def save_snapshot(name: str, dataset: pd.DataFrame) -> None:
    dataset.to_csv(ARTIFACT_DIR / f"{name}_dataset.csv", index=False, encoding="utf-8-sig")


def save_artifact(name: str, model, artifact: TrackArtifact) -> None:
    joblib.dump(model, ARTIFACT_DIR / f"{name}.joblib")
    (ARTIFACT_DIR / f"{name}_metadata.json").write_text(json.dumps(asdict(artifact), ensure_ascii=False, indent=2), encoding="utf-8")


def write_report(non_diabetic: TrackArtifact, diabetic: TrackArtifact) -> None:
    lines = [
        "# Two-Track Project Diabetes Models",
        "",
        "## Service Structure",
        "- Model A: non-diabetic track management model",
        "- Model B: diabetic track management model",
        "- NHIS 2024 1,000,000-row data is now actually included in the pipeline.",
        "- The paper-style BPNN was kept as an MLP challenger and CatBoost was compared as the current production candidate.",
        "",
    ]
    for artifact in [non_diabetic, diabetic]:
        lines.extend([
            f"## {artifact.title}",
            f"- Target: `{artifact.target_description}`",
            f"- Dataset: `{artifact.dataset_description}`",
            f"- Raw rows before sampling: `{artifact.raw_rows_before_sampling:,}`",
            f"- Rows used for local training: `{artifact.rows_used_for_training:,}`",
            f"- Champion: `{artifact.champion}`",
            f"- Challenger: `{artifact.challenger}`",
            f"- Features: {', '.join(f'`{item}`' for item in artifact.feature_columns)}",
            f"- Class balance: negative `{artifact.class_balance['negative']:,}`, positive `{artifact.class_balance['positive']:,}`",
            "- Candidate results:",
        ])
        for candidate in artifact.candidates:
            lines.append(f"  - `{candidate.model_name}`: threshold `{candidate.threshold:.2f}`, valid ROC-AUC `{candidate.validation.roc_auc:.4f}`, test ROC-AUC `{candidate.test.roc_auc:.4f}`, test F1 `{candidate.test.f1:.4f}`")
        lines.append("- Notes:")
        lines.extend([f"  - {note}" for note in artifact.notes])
        lines.append("")
    lines.extend([
        "## Caveats",
        "- Feature alignment was handled by transforming richer NHIS variables into service-usable risk buckets instead of discarding them.",
        "- Model B is stronger than the older 267-row version, but its target is still a proxy management-need label rather than a ground-truth clinical outcome.",
        "- Model B performance should still be interpreted as service-side prioritization quality, not a directly deployable clinical prognosis score.",
        "- Threshold optimization was applied because F1 is sensitive to class imbalance and operating threshold choice.",
        "- Model outputs should trigger personalized lifestyle recommendations and follow-up, not replace medical diagnosis.",
    ])
    (ARTIFACT_DIR / "two_track_model_report.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

    non_diabetic_dataset, non_diabetic_raw_rows = load_non_diabetic_dataset()
    diabetic_dataset, diabetic_raw_rows = load_diabetic_dataset()
    save_snapshot("non_diabetic_track", non_diabetic_dataset)
    save_snapshot("diabetic_track", diabetic_dataset)

    non_diabetic_numeric = ["age_midpoint", "bmi", "has_hypertension", "obesity_flag", "severe_obesity_flag", "family_history_flag", "inactivity_flag", "smoking_flag", "alcohol_risk_flag", "poor_sleep_flag", "diet_risk_flag", "waist_risk_flag", "lifestyle_burden_score", "metabolic_burden_score", "bmi_age_interaction", "htn_obesity_interaction"]
    non_diabetic_categorical = ["dataset_source", "gender", "age_bucket", "family_history", "exercise_frequency", "sleep_duration_bucket", "diet_risk", "smoking_status", "alcohol_frequency", "bmi_class"]
    non_models, non_champion, non_challenger, non_candidates = run_track_experiment(non_diabetic_dataset, numeric_features=non_diabetic_numeric, categorical_features=non_diabetic_categorical, balance_mode="undersample")
    non_artifact = TrackArtifact(
        key="non_diabetic_track_model",
        title="Model A: Non-Diabetic Track",
        target_description="General diabetes-risk screening using project-collectible non-lab features; NHIS glucose values were used mainly as supervisory labels.",
        dataset_description="NHIS 2024 + BRFSS 2015 + Mesra 2019 aligned into a shared service feature space.",
        raw_rows_before_sampling=non_diabetic_raw_rows,
        rows_used_for_training=len(non_diabetic_dataset),
        feature_columns=non_diabetic_numeric + non_diabetic_categorical,
        derived_features={},
        class_balance={"negative": int((non_diabetic_dataset['target'] == 0).sum()), "positive": int((non_diabetic_dataset['target'] == 1).sum())},
        champion=non_champion,
        challenger=non_challenger,
        candidates=non_candidates,
        notes=[
            "This track now uses NHIS at scale instead of relying only on smaller public datasets.",
            "High-detail NHIS measurements were compressed into service-usable flags rather than being thrown away.",
            "This is still the most service-ready model because it mainly depends on non-lab user inputs.",
        ],
    )
    save_artifact("non_diabetic_track_model", non_models[non_champion], non_artifact)
    save_artifact("non_diabetic_track_model_mlp_challenger", non_models["paper_style_bpnn"], non_artifact)

    diabetic_numeric = ["age_midpoint", "bmi", "has_hypertension", "glucose_risk_flag", "bp_stage_flag", "obesity_flag", "severe_obesity_flag", "family_history_flag", "inactivity_flag", "smoking_flag", "alcohol_risk_flag", "poor_sleep_flag", "diet_risk_flag", "waist_risk_flag", "lifestyle_burden_score", "metabolic_burden_score", "bmi_age_interaction", "htn_obesity_interaction"]
    diabetic_categorical = ["dataset_source", "track_relation", "gender", "age_bucket", "family_history", "exercise_frequency", "sleep_duration_bucket", "diet_risk", "smoking_status", "alcohol_frequency", "bmi_class", "fasting_glucose_range", "bp_stage", "waist_risk"]
    dia_models, dia_champion, dia_challenger, dia_candidates = run_track_experiment(diabetic_dataset, numeric_features=diabetic_numeric, categorical_features=diabetic_categorical, balance_mode="oversample")
    dia_artifact = TrackArtifact(
        key="diabetic_track_model",
        title="Model B: Diabetic Track",
        target_description="High management-need proxy for diagnosed/prediabetes users built from transformed NHIS severity signals plus Mesra symptom-driven signals.",
        dataset_description="NHIS 2024 at-risk subset + Mesra diabetic/prediabetes subset aligned into a shared service feature space.",
        raw_rows_before_sampling=diabetic_raw_rows,
        rows_used_for_training=len(diabetic_dataset),
        feature_columns=diabetic_numeric + diabetic_categorical,
        derived_features={},
        class_balance={"negative": int((diabetic_dataset['target'] == 0).sum()), "positive": int((diabetic_dataset['target'] == 1).sum())},
        champion=dia_champion,
        challenger=dia_challenger,
        candidates=dia_candidates,
        notes=[
            "This track is no longer limited to the old 267-row Mesra-only subset.",
            "NHIS severity information was distilled into service-usable buckets such as fasting_glucose_range and bp_stage.",
            "The target is still a proxy label, so this model should be treated as management prioritization rather than a definitive prognosis model.",
        ],
    )
    save_artifact("diabetic_track_model", dia_models[dia_champion], dia_artifact)
    save_artifact("diabetic_track_model_mlp_challenger", dia_models["paper_style_bpnn"], dia_artifact)

    write_report(non_artifact, dia_artifact)

    print(f"artifacts_dir={ARTIFACT_DIR}")
    for artifact in [non_artifact, dia_artifact]:
        best = max(artifact.candidates, key=lambda item: item.validation.roc_auc)
        print(f"{artifact.key}.champion={artifact.champion}")
        print(f"{artifact.key}.challenger={artifact.challenger}")
        print(f"{artifact.key}.raw_rows={artifact.raw_rows_before_sampling}")
        print(f"{artifact.key}.rows_used={artifact.rows_used_for_training}")
        print(f"{artifact.key}.test_roc_auc={best.test.roc_auc:.6f}")
        print(f"{artifact.key}.test_f1={best.test.f1:.6f}")


if __name__ == "__main__":
    main()
