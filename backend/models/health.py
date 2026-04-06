"""건강 데이터 모델 — HealthProfile · DailyHealthLog · PeriodicMeasurement."""

from tortoise import fields, models

from backend.models.enums import (
    AgeRange,
    AiConsent,
    AlcoholAmountLevel,
    AlcoholFrequency,
    DataSource,
    ExerciseFrequency,
    ExerciseType,
    FamilyHistory,
    FastingGlucoseRange,
    HbA1cRange,
    MealBalanceLevel,
    MealStatus,
    MeasurementSource,
    MeasurementType,
    MoodLevel,
    NightsnackLevel,
    Relation,
    RiskLevel,
    SleepDurationBucket,
    SleepQuality,
    SmokingStatus,
    SweetdrinkLevel,
    UserGroup,
    VegetableIntakeLevel,
)
from backend.models.users import Gender


class HealthProfile(models.Model):
    """온보딩 설문 결과 (1인당 1행).

    - relation: 사용자가 직접 고른 원본 응답
    - user_group: relation을 바탕으로 서버가 판단하는 A/B/C 그룹
    - bmi, has_hypertension, has_high_glucose_history: 파생값
    """

    id = fields.BigIntField(primary_key=True)
    user = fields.OneToOneField(
        "models.User", related_name="health_profile", on_delete=fields.CASCADE
    )

    # 그룹 분류
    relation = fields.CharEnumField(enum_type=Relation)
    user_group = fields.CharEnumField(enum_type=UserGroup)

    # 기본 정보
    gender = fields.CharEnumField(enum_type=Gender)
    age_range = fields.CharEnumField(enum_type=AgeRange)
    height_cm = fields.FloatField()
    weight_kg = fields.FloatField()
    bmi = fields.FloatField()  # 파생값: weight_kg / (height_cm/100)^2

    # 가족력·동반질환
    family_history = fields.CharEnumField(enum_type=FamilyHistory)
    conditions = fields.JSONField(default=list)
    has_hypertension = fields.BooleanField(default=False)  # 파생값
    has_high_glucose_history = fields.BooleanField(default=False)  # 파생값

    # 치료·검사 (그룹별 조건부)
    treatments = fields.JSONField(null=True)  # A그룹만
    hba1c_range = fields.CharEnumField(enum_type=HbA1cRange, null=True)  # A·B만
    fasting_glucose_range = fields.CharEnumField(
        enum_type=FastingGlucoseRange, null=True
    )  # A·B만

    # 생활습관
    exercise_frequency = fields.CharEnumField(enum_type=ExerciseFrequency)
    diet_habits = fields.JSONField(default=list)
    sleep_duration_bucket = fields.CharEnumField(enum_type=SleepDurationBucket)
    alcohol_frequency = fields.CharEnumField(enum_type=AlcoholFrequency)
    smoking_status = fields.CharEnumField(enum_type=SmokingStatus)

    # 목표·동의
    goals = fields.JSONField(default=list)
    ai_consent = fields.CharEnumField(enum_type=AiConsent)

    # 초기 위험도 (온보딩 완료 시 계산)
    initial_findrisc_score = fields.SmallIntField(null=True)
    initial_risk_level = fields.CharEnumField(enum_type=RiskLevel, null=True)

    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "health_profiles"


class DailyHealthLog(models.Model):
    """매일 건강 기록 (1인당 하루 1행).

    모든 데이터 필드는 null=True (미응답 = null).
    각 데이터 필드마다 _source 필드로 입력 출처를 추적한다.

    NOTE: exercise_done=false → exercise_type/exercise_minutes must be null
          (enforced in service layer)
    NOTE: alcohol_today=false → alcohol_amount_level must be null
          (enforced in service layer)
    """

    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField(
        "models.User", related_name="daily_logs", on_delete=fields.CASCADE
    )
    log_date = fields.DateField()

    # ── 수면 ──
    sleep_quality = fields.CharEnumField(enum_type=SleepQuality, null=True)
    sleep_duration_bucket = fields.CharEnumField(
        enum_type=SleepDurationBucket, null=True
    )

    # ── 식사 ──
    breakfast_status = fields.CharEnumField(enum_type=MealStatus, null=True)
    lunch_status = fields.CharEnumField(enum_type=MealStatus, null=True)
    dinner_status = fields.CharEnumField(enum_type=MealStatus, null=True)
    vegetable_intake_level = fields.CharEnumField(
        enum_type=VegetableIntakeLevel, null=True
    )
    meal_balance_level = fields.CharEnumField(enum_type=MealBalanceLevel, null=True)
    sweetdrink_level = fields.CharEnumField(enum_type=SweetdrinkLevel, null=True)

    # ── 운동 ──
    exercise_done = fields.BooleanField(null=True)
    exercise_type = fields.CharEnumField(enum_type=ExerciseType, null=True)
    exercise_minutes = fields.SmallIntField(null=True)
    walk_done = fields.BooleanField(null=True)

    # ── 기타 ──
    water_cups = fields.SmallIntField(null=True)
    nightsnack_level = fields.CharEnumField(enum_type=NightsnackLevel, null=True)
    took_medication = fields.BooleanField(null=True)
    mood_level = fields.CharEnumField(enum_type=MoodLevel, null=True)
    alcohol_today = fields.BooleanField(null=True)
    alcohol_amount_level = fields.CharEnumField(
        enum_type=AlcoholAmountLevel, null=True
    )

    # ── 출처 추적 (14개) ──
    sleep_quality_source = fields.CharEnumField(enum_type=DataSource, null=True)
    breakfast_status_source = fields.CharEnumField(enum_type=DataSource, null=True)
    lunch_status_source = fields.CharEnumField(enum_type=DataSource, null=True)
    dinner_status_source = fields.CharEnumField(enum_type=DataSource, null=True)
    vegetable_intake_level_source = fields.CharEnumField(
        enum_type=DataSource, null=True
    )
    meal_balance_level_source = fields.CharEnumField(enum_type=DataSource, null=True)
    sweetdrink_level_source = fields.CharEnumField(enum_type=DataSource, null=True)
    exercise_done_source = fields.CharEnumField(enum_type=DataSource, null=True)
    walk_done_source = fields.CharEnumField(enum_type=DataSource, null=True)
    water_cups_source = fields.CharEnumField(enum_type=DataSource, null=True)
    nightsnack_level_source = fields.CharEnumField(enum_type=DataSource, null=True)
    took_medication_source = fields.CharEnumField(enum_type=DataSource, null=True)
    mood_level_source = fields.CharEnumField(enum_type=DataSource, null=True)
    alcohol_today_source = fields.CharEnumField(enum_type=DataSource, null=True)

    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "daily_health_logs"
        unique_together = (("user", "log_date"),)


class PeriodicMeasurement(models.Model):
    """주기적 측정값 (체중·허리둘레·혈압·HbA1c·공복혈당).

    blood_pressure는 numeric_value=수축기, numeric_value_2=이완기.
    """

    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField(
        "models.User", related_name="measurements", on_delete=fields.CASCADE
    )
    measurement_type = fields.CharEnumField(enum_type=MeasurementType)
    measured_at = fields.DatetimeField()
    numeric_value = fields.DecimalField(max_digits=7, decimal_places=2)
    numeric_value_2 = fields.DecimalField(
        max_digits=7, decimal_places=2, null=True
    )  # 혈압 이완기
    unit = fields.CharField(max_length=20, default="")
    source = fields.CharEnumField(
        enum_type=MeasurementSource, default=MeasurementSource.MANUAL
    )
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "periodic_measurements"
        indexes = (("user", "measurement_type", "measured_at"),)
