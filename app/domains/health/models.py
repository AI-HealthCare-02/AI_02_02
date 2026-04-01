from tortoise import fields, models

from app.domains.health.enums import (
    DataSource,
    EngagementState,
    ExerciseType,
    FamilyHistoryLevel,
    FoodComposition,
    MealStatus,
    MeasurementType,
    MoodLevel,
    RiskLevel,
    RiskPeriodType,
    SleepQuality,
    UserGroup,
    YesNoUnknown,
)


class TimestampedModel(models.Model):
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        abstract = True


class HealthProfile(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    user = fields.OneToOneField("models.User", related_name="health_profile", on_delete=fields.CASCADE)
    user_group = fields.CharEnumField(UserGroup)
    relation = fields.CharField(max_length=20)
    age_range = fields.CharField(max_length=20)
    height_cm = fields.IntField()
    weight_kg = fields.DecimalField(max_digits=5, decimal_places=2)
    bmi = fields.DecimalField(max_digits=5, decimal_places=2)
    family_history = fields.CharEnumField(FamilyHistoryLevel)
    conditions = fields.JSONField(default=list)
    has_hypertension = fields.BooleanField(default=False)
    has_high_glucose_history = fields.BooleanField(default=False)
    exercise_frequency = fields.CharField(max_length=20, null=True)
    has_daily_vegetables = fields.BooleanField(default=False)
    diet_habits = fields.JSONField(default=list)
    sleep_habit = fields.CharField(max_length=20, null=True)
    smoking_status = fields.CharField(max_length=20, null=True)
    alcohol_frequency = fields.CharField(max_length=20, null=True)
    goals = fields.JSONField(default=list)
    initial_findrisc_score = fields.IntField()
    onboarding_completed_at = fields.DatetimeField(null=True)

    class Meta:
        table = "health_profiles"


class DailyHealthLog(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField("models.User", related_name="daily_health_logs", on_delete=fields.CASCADE)
    log_date = fields.DateField()

    sleep = fields.CharEnumField(SleepQuality, null=True)
    sleep_hours = fields.DecimalField(max_digits=4, decimal_places=1, null=True)
    breakfast = fields.CharEnumField(MealStatus, null=True)
    took_medication = fields.CharEnumField(YesNoUnknown, null=True)
    foodcomp = fields.CharEnumField(FoodComposition, null=True)
    sweetdrink = fields.CharEnumField(YesNoUnknown, null=True)
    exercise = fields.CharEnumField(YesNoUnknown, null=True)
    exercise_type = fields.CharEnumField(ExerciseType, null=True)
    exercise_minutes = fields.IntField(null=True)
    veggie = fields.CharEnumField(YesNoUnknown, null=True)
    walk = fields.CharEnumField(YesNoUnknown, null=True)
    nightsnack = fields.CharEnumField(YesNoUnknown, null=True)
    mood = fields.CharEnumField(MoodLevel, null=True)
    alcohol_today = fields.CharEnumField(YesNoUnknown, null=True)
    alcohol_amount = fields.CharField(max_length=30, null=True)
    lunch = fields.CharEnumField(MealStatus, null=True)
    dinner = fields.CharEnumField(MealStatus, null=True)
    water_cups = fields.IntField(null=True)

    sleep_source = fields.CharEnumField(DataSource, null=True)
    breakfast_source = fields.CharEnumField(DataSource, null=True)
    took_medication_source = fields.CharEnumField(DataSource, null=True)
    foodcomp_source = fields.CharEnumField(DataSource, null=True)
    sweetdrink_source = fields.CharEnumField(DataSource, null=True)
    exercise_source = fields.CharEnumField(DataSource, null=True)
    exercise_minutes_source = fields.CharEnumField(DataSource, null=True)
    veggie_source = fields.CharEnumField(DataSource, null=True)
    walk_source = fields.CharEnumField(DataSource, null=True)
    nightsnack_source = fields.CharEnumField(DataSource, null=True)
    mood_source = fields.CharEnumField(DataSource, null=True)
    alcohol_today_source = fields.CharEnumField(DataSource, null=True)
    alcohol_amount_source = fields.CharEnumField(DataSource, null=True)

    is_backfill = fields.BooleanField(default=False)
    backfilled_at = fields.DatetimeField(null=True)

    class Meta:
        table = "daily_health_logs"
        unique_together = (("user_id", "log_date"),)


class PeriodicMeasurement(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField("models.User", related_name="periodic_measurements", on_delete=fields.CASCADE)
    measurement_type = fields.CharEnumField(MeasurementType)
    measured_date = fields.DateField()
    numeric_value = fields.DecimalField(max_digits=8, decimal_places=2, null=True)
    secondary_value = fields.DecimalField(max_digits=8, decimal_places=2, null=True)
    unit = fields.CharField(max_length=20, null=True)
    source = fields.CharField(max_length=20, default="manual")
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
    score_age = fields.IntField(default=0)
    score_bmi = fields.IntField(default=0)
    score_waist = fields.IntField(default=0)
    score_exercise = fields.IntField(default=0)
    score_vegetable = fields.IntField(default=0)
    score_hypertension = fields.IntField(default=0)
    score_glucose_history = fields.IntField(default=0)
    score_family = fields.IntField(default=0)
    calculated_at = fields.DatetimeField()

    class Meta:
        table = "risk_assessments"
        unique_together = (("user_id", "period_type", "period_start", "period_end"),)


class UserEngagement(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    user = fields.OneToOneField("models.User", related_name="engagement", on_delete=fields.CASCADE)
    state = fields.CharEnumField(EngagementState, default=EngagementState.ACTIVE)
    seven_day_response_rate = fields.DecimalField(max_digits=5, decimal_places=2, default=100)
    last_question_bundle_at = fields.DatetimeField(null=True)
    bundles_today = fields.IntField(default=0)
    cooldown_until = fields.DatetimeField(null=True)
    last_bundle_key = fields.CharField(max_length=50, null=True)
    last_answered_at = fields.DatetimeField(null=True)
    is_on_vacation = fields.BooleanField(default=False)

    class Meta:
        table = "user_engagements"
