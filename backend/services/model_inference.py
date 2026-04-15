from __future__ import annotations

import json
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from backend.models.health import DailyHealthLog, HealthProfile, PeriodicMeasurement
from backend.services.prediction import DIABETIC_TRACK, NON_DIABETIC_TRACK, resolve_model_track

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_ARTIFACT_DIR = PROJECT_ROOT / "tools" / "ml_artifacts" / "two_track_project_models"


AGE_MIDPOINT = {
    "under_45": 40.0,
    "45_54": 50.0,
    "55_64": 60.0,
    "65_plus": 70.0,
}

LEVEL_LABELS = {
    "low": "낮음",
    "moderate": "보통",
    "high": "높음",
    "very_high": "매우 높음",
}

STAGE_LABELS = {
    "low": "안정 관리 단계",
    "moderate": "당뇨 전단계 주의",
    "high": "고위험 집중 관리",
    "very_high": "전문 상담 권장",
}


def _enum_value(value: Any, default: str | None = None) -> str | None:
    if value is None:
        return default
    return value.value if hasattr(value, "value") else str(value)


def _most_common(values: list[str], default: str) -> str:
    filtered = [value for value in values if value]
    if not filtered:
        return default
    return Counter(filtered).most_common(1)[0][0]


def _fasting_glucose_range(value: float | int | None) -> str:
    if value is None:
        return "unknown"
    value = float(value)
    if value < 100:
        return "under_100"
    if value < 126:
        return "100_to_125"
    return "over_126"


def _bp_stage(systolic: float | int | None, diastolic: float | int | None) -> str:
    if systolic is None or diastolic is None:
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


def _waist_risk(waist: float | int | None, gender: str) -> str:
    if waist is None:
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


def _bmi_class(bmi: float) -> str:
    if bmi < 23:
        return "normal"
    if bmi < 25:
        return "at_risk"
    if bmi < 30:
        return "obese_1"
    return "obese_2"


def _diet_risk_from_profile(profile: HealthProfile) -> str:
    diet_habits = set(profile.diet_habits or [])
    if {"carb_heavy", "sugary_drink", "late_snack"} & diet_habits:
        if len(diet_habits & {"carb_heavy", "sugary_drink", "late_snack", "irregular_meals"}) >= 2:
            return "high_risk"
        return "moderate_risk"
    if "veggies_daily" in diet_habits:
        return "supportive"
    if "irregular_meals" in diet_habits:
        return "moderate_risk"
    return "unknown"


def _diet_risk_from_logs(logs: list[DailyHealthLog], fallback: str) -> str:
    if not logs:
        return fallback
    carb_heavy_days = sum(1 for log in logs if _enum_value(log.meal_balance_level) == "carb_heavy")
    low_veg_days = sum(1 for log in logs if _enum_value(log.vegetable_intake_level) in {"little", "none"})
    sweetdrink_days = sum(1 for log in logs if _enum_value(log.sweetdrink_level) == "two_plus")
    risky_days = carb_heavy_days + low_veg_days + sweetdrink_days
    if risky_days >= max(3, len(logs)):
        return "high_risk"
    if risky_days >= 2:
        return "moderate_risk"
    good_veg_days = sum(1 for log in logs if _enum_value(log.vegetable_intake_level) == "enough")
    if good_veg_days >= max(3, len(logs) // 2):
        return "supportive"
    return fallback


def _exercise_from_logs(logs: list[DailyHealthLog], fallback: str) -> str:
    if not logs:
        return fallback
    exercise_days = sum(1 for log in logs if log.exercise_done)
    if exercise_days == 0:
        return "none"
    if exercise_days <= 2:
        return "1_2_per_week"
    if exercise_days <= 4:
        return "3_4_per_week"
    return "5_plus_per_week"


def _alcohol_from_logs(logs: list[DailyHealthLog], fallback: str) -> str:
    if not logs:
        return fallback
    drinking_days = sum(1 for log in logs if log.alcohol_today)
    ratio = drinking_days / max(len(logs), 1)
    if ratio >= 0.8:
        return "daily"
    if ratio >= 0.4:
        return "often"
    if ratio > 0:
        return "sometimes"
    return "none"


def _sleep_from_logs(logs: list[DailyHealthLog], fallback: str) -> str:
    values = [_enum_value(log.sleep_duration_bucket) for log in logs if log.sleep_duration_bucket]
    return _most_common([value for value in values if value], fallback)


def _latest_measurement_value(measurements: list[PeriodicMeasurement], measurement_type: str) -> float | None:
    filtered = [item for item in measurements if _enum_value(item.measurement_type) == measurement_type]
    if not filtered:
        return None
    latest = max(filtered, key=lambda item: item.measured_at)
    return float(latest.numeric_value)


def _latest_bp_values(measurements: list[PeriodicMeasurement]) -> tuple[float | None, float | None]:
    filtered = [item for item in measurements if _enum_value(item.measurement_type) == "blood_pressure"]
    if not filtered:
        return None, None
    latest = max(filtered, key=lambda item: item.measured_at)
    systolic = float(latest.numeric_value)
    diastolic = float(latest.numeric_value_2) if latest.numeric_value_2 is not None else None
    return systolic, diastolic


@lru_cache(maxsize=4)
def _load_model_bundle(track: str) -> tuple[Any, dict[str, Any]]:
    model_prefix = "diabetic_track_model" if track == DIABETIC_TRACK else "non_diabetic_track_model"
    model = joblib.load(MODEL_ARTIFACT_DIR / f"{model_prefix}.joblib")
    metadata = json.loads((MODEL_ARTIFACT_DIR / f"{model_prefix}_metadata.json").read_text(encoding="utf-8"))
    return model, metadata


class ModelInferenceService:
    async def predict_for_profile(
        self,
        *,
        profile: HealthProfile,
        logs: list[DailyHealthLog],
        measurements: list[PeriodicMeasurement],
    ) -> dict[str, Any]:
        track = resolve_model_track(relation=profile.relation, user_group=profile.user_group)
        model, metadata = _load_model_bundle(track)
        row = self._build_feature_row(profile=profile, logs=logs, measurements=measurements, feature_columns=metadata["feature_columns"], track=track)
        frame = pd.DataFrame([row])
        probability = float(model.predict_proba(frame)[0][1])
        score_pct = int(round(probability * 100))
        level = self._classify_probability(probability)
        level_label = LEVEL_LABELS[level]
        stage_label = STAGE_LABELS[level]
        return {
            "model_track": track,
            "model_name": metadata.get("champion", "catboost_optimized"),
            "predicted_score_pct": score_pct,
            "predicted_risk_level": level,
            "predicted_risk_label": level_label,
            "predicted_stage_label": stage_label,
            "recommended_actions": self._build_recommendations(row=row, score_pct=score_pct, track=track),
            "supporting_signals": self._build_supporting_signals(row=row, track=track),
            "disclaimer": "이 결과는 건강 보조 지표이며 진단을 대체하지 않습니다. 정확한 의학적 판단은 의료진 상담이 필요합니다.",
        }

    def _build_feature_row(
        self,
        *,
        profile: HealthProfile,
        logs: list[DailyHealthLog],
        measurements: list[PeriodicMeasurement],
        feature_columns: list[str],
        track: str,
    ) -> dict[str, Any]:
        gender = _enum_value(profile.gender, "FEMALE") or "FEMALE"
        age_bucket = _enum_value(profile.age_range, "45_54") or "45_54"
        family_history = _enum_value(profile.family_history, "unknown") or "unknown"
        exercise_frequency = _exercise_from_logs(logs, _enum_value(profile.exercise_frequency, "unknown") or "unknown")
        sleep_duration_bucket = _sleep_from_logs(logs, _enum_value(profile.sleep_duration_bucket, "unknown") or "unknown")
        alcohol_frequency = _alcohol_from_logs(logs, _enum_value(profile.alcohol_frequency, "unknown") or "unknown")
        smoking_status = _enum_value(profile.smoking_status, "unknown") or "unknown"
        diet_risk = _diet_risk_from_logs(logs, _diet_risk_from_profile(profile))

        glucose_measurement = _latest_measurement_value(measurements, "fasting_glucose")
        fasting_glucose_range = _fasting_glucose_range(glucose_measurement) if glucose_measurement is not None else (_enum_value(profile.fasting_glucose_range, "unknown") or "unknown")
        systolic, diastolic = _latest_bp_values(measurements)
        bp_stage = _bp_stage(systolic, diastolic)
        waist_value = _latest_measurement_value(measurements, "waist")
        waist_risk = _waist_risk(waist_value, gender)

        relation = _enum_value(profile.relation, "prevention") or "prevention"
        track_relation = "diagnosed" if relation == "diagnosed" else "prediabetes"

        row: dict[str, Any] = {column: "unknown" for column in feature_columns}
        row.update(
            {
                "dataset_source": "service_app",
                "gender": gender,
                "age_bucket": age_bucket,
                "age_midpoint": AGE_MIDPOINT.get(age_bucket, 50.0),
                "bmi": float(profile.bmi),
                "family_history": family_history,
                "exercise_frequency": exercise_frequency,
                "sleep_duration_bucket": sleep_duration_bucket,
                "diet_risk": diet_risk,
                "smoking_status": smoking_status,
                "alcohol_frequency": alcohol_frequency,
                "has_hypertension": int(bool(profile.has_hypertension)),
                "fasting_glucose_range": fasting_glucose_range,
                "bp_stage": bp_stage,
                "waist_risk": waist_risk,
                "track_relation": track_relation,
            }
        )

        row["bmi_class"] = _bmi_class(float(profile.bmi))
        row["obesity_flag"] = int(float(profile.bmi) >= 25)
        row["severe_obesity_flag"] = int(float(profile.bmi) >= 30)
        row["family_history_flag"] = int(family_history in {"parents", "siblings", "both"})
        row["inactivity_flag"] = int(exercise_frequency == "none")
        row["smoking_flag"] = int(smoking_status == "current")
        row["alcohol_risk_flag"] = int(alcohol_frequency in {"often", "daily"})
        row["poor_sleep_flag"] = int(sleep_duration_bucket in {"under_5", "between_5_6"})
        row["diet_risk_flag"] = int(diet_risk == "high_risk")
        row["waist_risk_flag"] = int(waist_risk == "high")
        row["glucose_risk_flag"] = {"under_100": 0, "100_to_125": 1, "over_126": 2, "unknown": 0}.get(fasting_glucose_range, 0)
        row["bp_stage_flag"] = {"normal": 0, "elevated": 1, "stage1": 2, "stage2": 3, "unknown": 0}.get(bp_stage, 0)
        row["lifestyle_burden_score"] = row["inactivity_flag"] + row["smoking_flag"] + row["alcohol_risk_flag"] + row["poor_sleep_flag"] + row["diet_risk_flag"]
        row["metabolic_burden_score"] = row["obesity_flag"] + row["has_hypertension"] + row["family_history_flag"] + row["waist_risk_flag"]
        row["bmi_age_interaction"] = float(profile.bmi) * row["age_midpoint"]
        row["htn_obesity_interaction"] = row["has_hypertension"] * row["obesity_flag"]

        if track == NON_DIABETIC_TRACK:
            row["fasting_glucose_range"] = "unknown"
            row["bp_stage"] = "unknown"
            row["waist_risk"] = "unknown"
            row["glucose_risk_flag"] = 0
            row["bp_stage_flag"] = 0
            row["waist_risk_flag"] = 0
            row["metabolic_burden_score"] = row["obesity_flag"] + row["has_hypertension"] + row["family_history_flag"]

        for column in feature_columns:
            if column not in row:
                row[column] = 0 if column.endswith("_flag") or column in {"age_midpoint", "bmi", "has_hypertension", "lifestyle_burden_score", "metabolic_burden_score", "bmi_age_interaction", "htn_obesity_interaction"} else "unknown"

        return {column: row[column] for column in feature_columns}

    @staticmethod
    def _classify_probability(probability: float) -> str:
        if probability < 0.25:
            return "low"
        if probability < 0.5:
            return "moderate"
        if probability < 0.75:
            return "high"
        return "very_high"

    @staticmethod
    def _build_supporting_signals(*, row: dict[str, Any], track: str) -> list[str]:
        signals: list[str] = []
        if row.get("obesity_flag"):
            signals.append("BMI 기반 비만 위험")
        if row.get("poor_sleep_flag"):
            signals.append("수면 부족 경향")
        if row.get("inactivity_flag"):
            signals.append("운동 부족 경향")
        if row.get("diet_risk_flag"):
            signals.append("식습관 위험")
        if track == DIABETIC_TRACK:
            if row.get("glucose_risk_flag", 0) >= 1:
                signals.append("혈당 위험 구간 반영")
            if row.get("bp_stage_flag", 0) >= 1:
                signals.append("혈압 위험 구간 반영")
            if row.get("waist_risk_flag"):
                signals.append("복부비만 위험")
        return signals[:5]

    @staticmethod
    def _build_recommendations(*, row: dict[str, Any], score_pct: int, track: str) -> list[str]:
        actions: list[str] = []
        if row.get("inactivity_flag"):
            actions.append("주 3회 이상 걷기 또는 유산소 운동을 우선 권장합니다.")
        if row.get("poor_sleep_flag"):
            actions.append("수면 시간을 6-7시간 이상으로 맞추도록 권장합니다.")
        if row.get("diet_risk_flag"):
            actions.append("단 음료와 탄수화물 위주 식사를 줄이고 채소 섭취를 늘리세요.")
        if track == DIABETIC_TRACK and row.get("glucose_risk_flag", 0) >= 1:
            actions.append("가능하면 최근 공복혈당 또는 당화혈색소를 다시 확인해보세요.")
        if track == DIABETIC_TRACK and row.get("bp_stage_flag", 0) >= 1:
            actions.append("혈압 기록을 꾸준히 입력하고 필요시 의료진 상담을 권장합니다.")
        if score_pct >= 75:
            actions.append("관리 필요도가 높아 보여 조기 상담 및 추가 측정이 권장됩니다.")
        return actions[:5]
