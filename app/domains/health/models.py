from tortoise import fields

from app.domains.common.models import TimestampedModel
from app.domains.health.enums import (
    AiConsentStatus,
    AlcoholAmountLevel,
    DataSource,
    EngagementState,
    ExerciseType,
    MealBalanceLevel,
    MealStatus,
    MeasurementSource,
    MeasurementType,
    MoodLevel,
    NightsnackLevel,
    RiskLevel,
    RiskPeriodType,
    SleepDurationBucket,
    SleepQuality,
    SweetdrinkLevel,
    UserGroup,
    VegetableIntakeLevel,
)


class HealthProfile(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    user = fields.OneToOneField("models.User", related_name="health_profile", on_delete=fields.CASCADE)
    user_group = fields.CharEnumField(UserGroup)
    relation = fields.CharField(max_length=30)
    gender = fields.CharField(max_length=20)
    age_range = fields.CharField(max_length=20)
    height_cm = fields.DecimalField(max_digits=5, decimal_places=1)
    weight_kg = fields.DecimalField(max_digits=5, decimal_places=2)
    bmi = fields.DecimalField(max_digits=5, decimal_places=2)
    family_history = fields.CharField(max_length=30)
    conditions = fields.JSONField(default=list)
    treatments = fields.JSONField(default=list)
    hba1c_range = fields.CharField(max_length=30, null=True)
    fasting_glucose_range = fields.CharField(max_length=30, null=True)
    exercise_frequency = fields.CharField(max_length=30, null=True)
    diet_habits = fields.JSONField(default=list)
    sleep_duration_bucket = fields.CharEnumField(SleepDurationBucket, null=True)
    alcohol_frequency = fields.CharField(max_length=30, null=True)
    smoking_status = fields.CharField(max_length=30, null=True)
    goals = fields.JSONField(default=list)
    ai_consent = fields.CharEnumField(AiConsentStatus)
    initial_findrisc_score = fields.IntField()
    initial_risk_level = fields.CharEnumField(RiskLevel)
    onboarding_completed_at = fields.DatetimeField(null=True)

    class Meta:
        table = "health_profiles"


class DailyHealthLog(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField("models.User", related_name="daily_health_logs", on_delete=fields.CASCADE)
    log_date = fields.DateField()
    sleep_quality = fields.CharEnumField(SleepQuality, null=True)
    sleep_duration_bucket = fields.CharEnumField(SleepDurationBucket, null=True)
    breakfast_status = fields.CharEnumField(MealStatus, null=True)
    lunch_status = fields.CharEnumField(MealStatus, null=True)
    dinner_status = fields.CharEnumField(MealStatus, null=True)
    vegetable_intake_level = fields.CharEnumField(VegetableIntakeLevel, null=True)
    meal_balance_level = fields.CharEnumField(MealBalanceLevel, null=True)
    sweetdrink_level = fields.CharEnumField(SweetdrinkLevel, null=True)
    exercise_done = fields.BooleanField(null=True)
    exercise_type = fields.CharEnumField(ExerciseType, null=True)
    exercise_minutes = fields.IntField(null=True)
    walk_done = fields.BooleanField(null=True)
    water_cups = fields.IntField(null=True)
    nightsnack_level = fields.CharEnumField(NightsnackLevel, null=True)
    took_medication = fields.BooleanField(null=True)
    mood_level = fields.CharEnumField(MoodLevel, null=True)
    alcohol_today = fields.BooleanField(null=True)
    alcohol_amount_level = fields.CharEnumField(AlcoholAmountLevel, null=True)

    sleep_quality_source = fields.CharEnumField(DataSource, null=True)
    sleep_duration_bucket_source = fields.CharEnumField(DataSource, null=True)
    breakfast_status_source = fields.CharEnumField(DataSource, null=True)
    lunch_status_source = fields.CharEnumField(DataSource, null=True)
    dinner_status_source = fields.CharEnumField(DataSource, null=True)
    vegetable_intake_level_source = fields.CharEnumField(DataSource, null=True)
    meal_balance_level_source = fields.CharEnumField(DataSource, null=True)
    sweetdrink_level_source = fields.CharEnumField(DataSource, null=True)
    exercise_done_source = fields.CharEnumField(DataSource, null=True)
    walk_done_source = fields.CharEnumField(DataSource, null=True)
    water_cups_source = fields.CharEnumField(DataSource, null=True)
    nightsnack_level_source = fields.CharEnumField(DataSource, null=True)
    took_medication_source = fields.CharEnumField(DataSource, null=True)
    mood_level_source = fields.CharEnumField(DataSource, null=True)
    alcohol_today_source = fields.CharEnumField(DataSource, null=True)
    alcohol_amount_level_source = fields.CharEnumField(DataSource, null=True)

    is_backfill = fields.BooleanField(default=False)
    backfilled_at = fields.DatetimeField(null=True)

    class Meta:
        table = "daily_health_logs"
        unique_together = (("user_id", "log_date"),)


class PeriodicMeasurement(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField("models.User", related_name="periodic_measurements", on_delete=fields.CASCADE)
    measurement_type = fields.CharEnumField(MeasurementType)
    measured_at = fields.DatetimeField()
    numeric_value = fields.DecimalField(max_digits=8, decimal_places=2, null=True)
    numeric_value_2 = fields.DecimalField(max_digits=8, decimal_places=2, null=True)
    unit = fields.CharField(max_length=20, null=True)
    source = fields.CharEnumField(MeasurementSource, default=MeasurementSource.MANUAL)
    note = fields.CharField(max_length=255, null=True)

    class Meta:
        table = "periodic_measurements"


class RiskAssessment(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField("models.User", related_name="risk_assessments", on_delete=fields.CASCADE)
    period_type = fields.CharEnumField(RiskPeriodType)
    period_start = fields.DateField()
    period_end = fields.DateField()
    findrisc_score = fields.IntField()
    risk_level = fields.CharEnumField(RiskLevel)
    sleep_score = fields.IntField(default=0)
    diet_score = fields.IntField(default=0)
    exercise_score = fields.IntField(default=0)
    lifestyle_score = fields.IntField(default=0)
    data_days = fields.IntField(default=0)
    total_days = fields.IntField(default=0)
    confidence_note = fields.CharField(max_length=255, null=True)
    top_positive_factors = fields.JSONField(default=list)
    top_risk_factors = fields.JSONField(default=list)
    assessed_at = fields.DatetimeField()

    class Meta:
        table = "risk_assessments"
        unique_together = (("user_id", "period_type", "period_start", "period_end"),)


class UserEngagement(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    user = fields.OneToOneField("models.User", related_name="engagement", on_delete=fields.CASCADE)
    state = fields.CharEnumField(EngagementState, default=EngagementState.ACTIVE)
    seven_day_response_rate = fields.DecimalField(max_digits=5, decimal_places=2, default=0)
    state_changed_at = fields.DatetimeField(null=True)
    consecutive_no_response_days = fields.IntField(default=0)
    days_at_current_state = fields.IntField(default=0)
    upgrade_streak_days = fields.IntField(default=0)
    last_response_at = fields.DatetimeField(null=True)
    last_session_at = fields.DatetimeField(null=True)
    last_question_bundle_at = fields.DatetimeField(null=True)
    bundles_today = fields.IntField(default=0)
    cooldown_until = fields.DatetimeField(null=True)
    last_bundle_key = fields.CharField(max_length=50, null=True)

    class Meta:
        table = "user_engagements"
