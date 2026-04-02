from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field

from app.domains.health.enums import (
    AiConsentStatus,
    AlcoholAmountLevel,
    DataSource,
    EngagementState,
    ExerciseType,
    MealBalanceLevel,
    MealStatus,
    MeasurementType,
    MoodLevel,
    NightsnackLevel,
    RiskLevel,
    SleepDurationBucket,
    SleepQuality,
    SweetdrinkLevel,
    UserGroup,
    VegetableIntakeLevel,
)


class ConsentRequest(BaseModel):
    terms_of_service: bool
    privacy_policy: bool
    health_data_consent: bool
    disclaimer_consent: bool
    marketing_consent: bool = False


class ConsentResponse(BaseModel):
    detail: str
    consented_at: datetime


class OnboardingSurveyRequest(BaseModel):
    relation: str
    gender: str
    age_range: str
    height_cm: float
    weight_kg: float
    family_history: str
    conditions: list[str] = Field(default_factory=list)
    treatments: list[str] | None = None
    hba1c_range: str | None = None
    fasting_glucose_range: str | None = None
    exercise_frequency: str | None = None
    diet_habits: list[str] = Field(default_factory=list)
    sleep_duration_bucket: SleepDurationBucket | None = None
    alcohol_frequency: str | None = None
    smoking_status: str | None = None
    goals: list[str] = Field(default_factory=list)
    ai_consent: AiConsentStatus


class OnboardingSurveyResponse(BaseModel):
    health_profile_id: int
    user_group: UserGroup
    bmi: float
    initial_findrisc_score: int
    initial_risk_level: RiskLevel
    access_token: str
    message: str


class OnboardingStatusResponse(BaseModel):
    is_completed: bool
    completed_at: datetime | None
    user_group: UserGroup | None


class DailyLogItem(BaseModel):
    log_date: date
    sleep_quality: SleepQuality | None = None
    sleep_duration_bucket: SleepDurationBucket | None = None
    breakfast_status: MealStatus | None = None
    lunch_status: MealStatus | None = None
    dinner_status: MealStatus | None = None
    vegetable_intake_level: VegetableIntakeLevel | None = None
    meal_balance_level: MealBalanceLevel | None = None
    sweetdrink_level: SweetdrinkLevel | None = None
    exercise_done: bool | None = None
    exercise_type: ExerciseType | None = None
    exercise_minutes: int | None = None
    walk_done: bool | None = None
    water_cups: int | None = None
    nightsnack_level: NightsnackLevel | None = None
    took_medication: bool | None = None
    mood_level: MoodLevel | None = None
    alcohol_today: bool | None = None
    alcohol_amount_level: AlcoholAmountLevel | None = None
    completion_rate: float | None = None


class ChallengeSummaryItem(BaseModel):
    user_challenge_id: int
    name: str
    emoji: str
    current_streak: int
    progress_pct: float
    status: str


class EngagementSummary(BaseModel):
    state: EngagementState
    seven_day_response_rate: float
    cooldown_until: datetime | None


class RiskLatestResponse(BaseModel):
    findrisc_score: int
    risk_level: RiskLevel
    sleep_score: int
    diet_score: int
    exercise_score: int
    lifestyle_score: int
    score_breakdown: dict[str, int] | None = None
    top_positive_factors: list[str] = Field(default_factory=list)
    top_risk_factors: list[str] = Field(default_factory=list)
    assessed_at: datetime
    assessment_period: str | None = None


class DashboardInitResponse(BaseModel):
    daily_log: DailyLogItem | None
    risk: RiskLatestResponse
    challenge_summary: list[ChallengeSummaryItem]
    engagement: EngagementSummary
    user_group: UserGroup


class DailyHealthLogPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: DataSource
    sleep_quality: SleepQuality | None = None
    sleep_duration_bucket: SleepDurationBucket | None = None
    breakfast_status: MealStatus | None = None
    lunch_status: MealStatus | None = None
    dinner_status: MealStatus | None = None
    vegetable_intake_level: VegetableIntakeLevel | None = None
    meal_balance_level: MealBalanceLevel | None = None
    sweetdrink_level: SweetdrinkLevel | None = None
    exercise_done: bool | None = None
    exercise_type: ExerciseType | None = None
    exercise_minutes: int | None = Field(default=None, ge=0, le=480)
    walk_done: bool | None = None
    water_cups: int | None = Field(default=None, ge=0, le=20)
    nightsnack_level: NightsnackLevel | None = None
    took_medication: bool | None = None
    mood_level: MoodLevel | None = None
    alcohol_today: bool | None = None
    alcohol_amount_level: AlcoholAmountLevel | None = None


class DailyLogPatchResponse(BaseModel):
    daily_log: DailyLogItem
    field_results: dict[str, str]
    challenge_update: dict[str, str] | None


class MissingDailyLogItem(BaseModel):
    date: date
    missing_fields: list[str]
    answered_fields: list[str]
    completion_rate: float


class MissingDailyLogResponse(BaseModel):
    missing_dates: list[MissingDailyLogItem]
    max_display: int


class DailyBatchEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: date
    source: DataSource
    sleep_quality: SleepQuality | None = None
    sleep_duration_bucket: SleepDurationBucket | None = None
    breakfast_status: MealStatus | None = None
    lunch_status: MealStatus | None = None
    dinner_status: MealStatus | None = None
    vegetable_intake_level: VegetableIntakeLevel | None = None
    meal_balance_level: MealBalanceLevel | None = None
    sweetdrink_level: SweetdrinkLevel | None = None
    exercise_done: bool | None = None
    exercise_type: ExerciseType | None = None
    exercise_minutes: int | None = None
    walk_done: bool | None = None
    water_cups: int | None = None
    nightsnack_level: NightsnackLevel | None = None
    took_medication: bool | None = None
    mood_level: MoodLevel | None = None
    alcohol_today: bool | None = None
    alcohol_amount_level: AlcoholAmountLevel | None = None


class DailyBatchRequest(BaseModel):
    entries: list[DailyBatchEntry]


class DailyBatchResult(BaseModel):
    date: date
    field_results: dict[str, str]


class DailyBatchResponse(BaseModel):
    results: list[DailyBatchResult]


class MeasurementCreateRequest(BaseModel):
    measurement_type: MeasurementType
    value: float | None = None
    systolic: int | None = None
    diastolic: int | None = None
    unit: str
    measured_at: datetime


class MeasurementItem(BaseModel):
    measurement_id: int
    measurement_type: MeasurementType
    value: float | None = None
    systolic: int | None = None
    diastolic: int | None = None
    unit: str
    measured_at: datetime


class MeasurementListResponse(BaseModel):
    measurements: list[MeasurementItem]
    total_count: int


class AnalysisScorecard(BaseModel):
    sleep_score: int
    diet_score: int
    exercise_score: int
    lifestyle_score: int


class AnalysisActivityRing(BaseModel):
    exercise_minutes_total: int
    exercise_target: int
    exercise_pct: float
    veggie_days: int
    veggie_target: int
    veggie_pct: float
    sleep_avg_hours: float
    water_avg_cups: float


class AnalysisHeatmap(BaseModel):
    dates: list[date]
    completion_rates: list[float]


class RiskTrendItem(BaseModel):
    date: date
    findrisc_score: int


class NutritionRadar(BaseModel):
    veggie: float
    breakfast_regularity: float
    sugar_control: float
    meal_balance: float
    water: float


class AnalysisSummaryResponse(BaseModel):
    period: int
    scorecard: AnalysisScorecard
    risk: dict[str, int | str]
    top_positive_factors: list[str]
    top_risk_factors: list[str]
    activity_ring: AnalysisActivityRing | None = None
    heatmap: AnalysisHeatmap | None = None
    risk_trend: list[RiskTrendItem] | None = None
    nutrition_radar: NutritionRadar | None = None
    glucose_summary: dict[str, str | int] | None = None
    cached_at: datetime


class DietTimelineItem(BaseModel):
    date: date
    breakfast_status: MealStatus | None
    lunch_status: MealStatus | None
    dinner_status: MealStatus | None
    vegetable_intake_level: VegetableIntakeLevel | None
    sweetdrink_level: SweetdrinkLevel | None
    meal_balance_level: MealBalanceLevel | None


class AnalysisDietResponse(BaseModel):
    period: int
    timeline: list[DietTimelineItem]
    weekly_pattern: dict[str, float]
    scores: dict[str, int]
    cached_at: datetime


class AnalysisHabitsResponse(BaseModel):
    period: int
    cards: dict[str, dict[str, int | float]]
    weekly_calendar: list[dict[str, date | bool | int | str | None]]
    exercise_chart: list[dict[str, date | int | str | None]]
    cached_at: datetime


class AnalysisCoachResponse(BaseModel):
    coach_card: dict[str, str]
    weekly_report: dict[str, list[str] | int | str]


class SettingsResponse(BaseModel):
    nickname: str
    morning_reminder: bool
    evening_reminder: bool
    challenge_reminder: bool
    weekly_report: bool
    reminder_time_morning: time
    reminder_time_evening: time
    max_bundles_per_day: int
    preferred_times: list[str]
    last_export_at: datetime | None


class SettingsPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nickname: str | None = None
    morning_reminder: bool | None = None
    evening_reminder: bool | None = None
    challenge_reminder: bool | None = None
    weekly_report: bool | None = None
    reminder_time_morning: time | None = None
    reminder_time_evening: time | None = None
    max_bundles_per_day: int | None = None
    preferred_times: list[str] | None = None


class DataExportRequest(BaseModel):
    format: str
    from_date: date
    to_date: date


class CronJobResponse(BaseModel):
    detail: str
    processed_users: int | None = None
    generated_risk_rows: int | None = None
    updated_engagement_rows: int | None = None
    generated_weekly_reports: int | None = None
    recalculated_risks: int | None = None
    updated_challenges: int | None = None
