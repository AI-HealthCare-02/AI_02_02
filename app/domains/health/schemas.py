from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field

from app.domains.health.enums import DataSource, EngagementState, MeasurementType, RiskLevel, UserGroup


class ConsentRequest(BaseModel):
    terms_of_service: bool
    privacy_policy: bool
    health_data_consent: bool
    disclaimer_consent: bool


class ConsentResponse(BaseModel):
    detail: str
    consented_at: datetime


class OnboardingSurveyRequest(BaseModel):
    user_group: UserGroup
    gender: str
    age_range: str
    height_cm: float
    weight_kg: float
    conditions: list[str] = Field(default_factory=list)
    family_history: str
    exercise_frequency: str
    has_daily_vegetables: bool
    smoking_status: str
    diet_habits: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    notification_preference: str


class OnboardingSurveyResponse(BaseModel):
    health_profile_id: int
    user_group: UserGroup
    bmi: float
    initial_findrisc_score: int
    risk_level: RiskLevel
    engagement_state: EngagementState
    access_token: str
    message: str


class OnboardingStatusResponse(BaseModel):
    is_completed: bool
    completed_at: datetime | None
    user_group: UserGroup | None


class DailyLogItem(BaseModel):
    log_date: date
    sleep: str | None = None
    sleep_hours: float | None = None
    breakfast: str | None = None
    lunch: str | None = None
    dinner: str | None = None
    veggie: bool | None = None
    foodcomp: str | None = None
    sweetdrink: str | None = None
    exercise: str | None = None
    exercise_type: str | None = None
    exercise_minutes: int | None = None
    walk: bool | None = None
    water_cups: int | None = None
    nightsnack: str | None = None
    took_medication: bool | None = None
    mood: str | None = None
    alcohol_today: bool | None = None
    alcohol_amount: str | None = None
    sleep_source: str | None = None
    breakfast_source: str | None = None
    lunch_source: str | None = None
    dinner_source: str | None = None
    veggie_source: str | None = None
    foodcomp_source: str | None = None
    sweetdrink_source: str | None = None
    exercise_source: str | None = None
    walk_source: str | None = None
    water_cups_source: str | None = None
    nightsnack_source: str | None = None
    mood_source: str | None = None
    alcohol_source: str | None = None
    took_medication_source: str | None = None
    completion_rate: float


class ChallengeSummaryItem(BaseModel):
    challenge_id: int
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
    sleep: str | None = None
    sleep_hours: float | None = Field(default=None, ge=0, le=24)
    breakfast: str | None = None
    lunch: str | None = None
    dinner: str | None = None
    veggie: bool | None = None
    foodcomp: str | None = None
    sweetdrink: str | None = None
    exercise: str | None = None
    exercise_type: str | None = None
    exercise_minutes: int | None = Field(default=None, ge=0, le=480)
    walk: bool | None = None
    water_cups: int | None = Field(default=None, ge=0, le=20)
    nightsnack: str | None = None
    took_medication: bool | None = None
    mood: str | None = None
    alcohol_today: bool | None = None
    alcohol_amount: str | None = None


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
    sleep: str | None = None
    sleep_hours: float | None = None
    breakfast: str | None = None
    lunch: str | None = None
    dinner: str | None = None
    veggie: bool | None = None
    foodcomp: str | None = None
    sweetdrink: str | None = None
    exercise: str | None = None
    exercise_type: str | None = None
    exercise_minutes: int | None = None
    walk: bool | None = None
    water_cups: int | None = None
    nightsnack: str | None = None
    took_medication: bool | None = None
    mood: str | None = None
    alcohol_today: bool | None = None
    alcohol_amount: str | None = None


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
    overall_score: int
    sleep_score: int
    diet_score: int
    exercise_score: int
    lifestyle_score: int
    change_from_previous: int


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
    activity_ring: AnalysisActivityRing
    heatmap: AnalysisHeatmap
    risk_trend: list[RiskTrendItem]
    nutrition_radar: NutritionRadar
    glucose_summary: dict[str, str | int] | None
    cached_at: datetime


class DietTimelineItem(BaseModel):
    date: date
    breakfast: str | None
    lunch: str | None
    dinner: str | None
    veggie: bool | None
    sweetdrink: str | None
    foodcomp: str | None


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


class SettingsProfile(BaseModel):
    email: str
    nickname: str
    user_group: UserGroup
    created_at: date


class SettingsNotifications(BaseModel):
    morning_reminder: bool
    evening_reminder: bool
    challenge_reminder: bool
    weekly_report: bool
    reminder_time_morning: time
    reminder_time_evening: time


class SettingsAiFrequency(BaseModel):
    max_bundles_per_day: int
    preferred_times: list[str]


class SettingsDataSummary(BaseModel):
    total_logs: int
    first_log_date: date | None
    last_export_at: datetime | None


class SettingsResponse(BaseModel):
    profile: SettingsProfile
    notifications: SettingsNotifications
    ai_frequency: SettingsAiFrequency
    data: SettingsDataSummary


class SettingsNotificationsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    morning_reminder: bool | None = None
    evening_reminder: bool | None = None
    challenge_reminder: bool | None = None
    weekly_report: bool | None = None
    reminder_time_morning: time | None = None
    reminder_time_evening: time | None = None


class SettingsAiFrequencyPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max_bundles_per_day: int | None = None
    preferred_times: list[str] | None = None


class DataExportRequest(BaseModel):
    format: str
    from_date: date
    to_date: date


class CronJobResponse(BaseModel):
    processed_users: int
    engagements_updated: int | None = None
    findrisc_recalculated: int
    challenges_judged: int | None = None
    badges_awarded: int | None = None
    reports_cached: int | None = None
    engagements_upgraded: int | None = None
    errors: int
