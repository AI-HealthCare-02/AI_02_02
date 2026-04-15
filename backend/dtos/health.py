"""건강 데이터 API 요청/응답 DTO."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, model_validator

from backend.models.enums import DataSource, MeasurementSource, MeasurementType

# ── 일일 건강 기록 ──


class DailyLogResponse(BaseModel):
    """일일 건강 기록 응답 (dashboard/init의 daily_log와 동일 구조)."""

    log_date: date
    # 수면
    sleep_quality: str | None = None
    sleep_duration_bucket: str | None = None
    # 식사
    breakfast_status: str | None = None
    lunch_status: str | None = None
    dinner_status: str | None = None
    vegetable_intake_level: str | None = None
    meal_balance_level: str | None = None
    sweetdrink_level: str | None = None
    # 운동
    exercise_done: bool | None = None
    exercise_type: str | None = None
    exercise_minutes: int | None = None
    walk_done: bool | None = None
    # 기타
    water_cups: int | None = None
    nightsnack_level: str | None = None
    took_medication: bool | None = None
    mood_level: str | None = None
    alcohol_today: bool | None = None
    alcohol_amount_level: str | None = None
    missing_summary: DailyMissingSummary = None
    pending_questions: PendingQuestionsResponse = None


class DailyMissingSummary(BaseModel):
    count: int
    labels: list[str] = Field(default_factory=list)
    truncated_count: int = 0


class PendingQuestionItem(BaseModel):
    field: str
    summary_label: str
    text: str
    input_type: str = "select"
    options: list[str | int | bool] = Field(default_factory=list)
    condition: str | None = None


class PendingQuestionBundle(BaseModel):
    bundle_key: str
    name: str
    unanswered_count: int
    questions: list[PendingQuestionItem] = Field(default_factory=list)


class PendingQuestionsResponse(BaseModel):
    count: int
    bundles: list[PendingQuestionBundle] = Field(default_factory=list)


class DailyLogPatchRequest(BaseModel):
    """일일 건강 기록 직접입력 요청."""

    model_config = {
        "json_schema_extra": {
            "example": {
                "source": "direct",
                "sleep_quality": "good",
                "breakfast_status": "hearty",
                "exercise_done": True,
                "exercise_type": "walking",
                "exercise_minutes": 30,
                "water_cups": 5,
            }
        }
    }

    source: DataSource = DataSource.DIRECT
    # 모든 필드 optional — 보낸 필드만 저장
    sleep_quality: str | None = None
    sleep_duration_bucket: str | None = None
    breakfast_status: str | None = None
    lunch_status: str | None = None
    dinner_status: str | None = None
    vegetable_intake_level: str | None = None
    meal_balance_level: str | None = None
    sweetdrink_level: str | None = None
    exercise_done: bool | None = None
    exercise_type: str | None = None
    exercise_minutes: int | None = None
    walk_done: bool | None = None
    water_cups: int | None = None
    nightsnack_level: str | None = None
    took_medication: bool | None = None
    mood_level: str | None = None
    alcohol_today: bool | None = None
    alcohol_amount_level: str | None = None


class DailyLogPatchResponse(BaseModel):
    """일일 건강 기록 저장 응답."""

    daily_log: DailyLogResponse
    field_results: dict[str, str]  # 필드별 "accepted" | "skipped"
    challenge_update: dict | None = None


class MissingDateEntry(BaseModel):
    """미입력 날짜 항목."""

    date: date
    missing_fields: list[str] = []
    answered_fields: list[str] = []
    completion_rate: float


class MissingDatesResponse(BaseModel):
    """미입력 날짜 목록 응답."""

    missing_dates: list[MissingDateEntry]
    max_display: int = 4


class BatchEntryRequest(BaseModel):
    """소급입력 단일 항목.

    원본 API명세: "date" 필드명. 내부: "log_date".
    """

    model_config = {"populate_by_name": True}

    log_date: date = Field(validation_alias="date")
    source: str | None = None  # 명세에서 전송 가능, 서버는 항상 backfill로 강제
    sleep_quality: str | None = None
    sleep_duration_bucket: str | None = None
    breakfast_status: str | None = None
    lunch_status: str | None = None
    dinner_status: str | None = None
    vegetable_intake_level: str | None = None
    meal_balance_level: str | None = None
    sweetdrink_level: str | None = None
    exercise_done: bool | None = None
    exercise_type: str | None = None
    exercise_minutes: int | None = None
    walk_done: bool | None = None
    water_cups: int | None = None
    nightsnack_level: str | None = None
    took_medication: bool | None = None
    mood_level: str | None = None
    alcohol_today: bool | None = None
    alcohol_amount_level: str | None = None


class BatchRequest(BaseModel):
    """소급입력 요청."""

    entries: list[BatchEntryRequest] = Field(max_length=7)


class BatchResponse(BaseModel):
    """소급입력 응답."""

    saved_count: int
    results: list[dict]


# ── 주기적 측정값 ──


class MeasurementCreateRequest(BaseModel):
    """주기적 측정값 생성 요청.

    원본 API명세 필드명(value/systolic/diastolic)과
    내부 필드명(numeric_value/numeric_value_2) 모두 허용.
    """

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "examples": [
                {
                    "measurement_type": "weight",
                    "value": 79.5,
                    "unit": "kg",
                    "measured_at": "2026-04-02T08:00:00+09:00",
                },
                {
                    "measurement_type": "blood_pressure",
                    "systolic": 128,
                    "diastolic": 82,
                    "unit": "mmHg",
                    "measured_at": "2026-04-02T08:00:00+09:00",
                },
            ]
        },
    }

    measurement_type: MeasurementType
    numeric_value: float = Field(validation_alias="value")
    numeric_value_2: float | None = Field(None, validation_alias="diastolic")
    unit: str | None = None
    source: MeasurementSource = MeasurementSource.MANUAL
    measured_at: datetime

    @model_validator(mode="before")
    @classmethod
    def normalize_bp(cls, data: Any) -> Any:
        """혈압의 systolic → value 변환, numeric_value 직접 전송도 허용."""
        if isinstance(data, dict):
            if "systolic" in data and "value" not in data and "numeric_value" not in data:
                data["value"] = data.pop("systolic")
            if "numeric_value" in data and "value" not in data:
                data["value"] = data.pop("numeric_value")
        return data


class MeasurementResponse(BaseModel):
    """측정값 응답."""

    id: int
    measurement_type: str
    numeric_value: float
    numeric_value_2: float | None = None
    source: str
    measured_at: datetime
    created_at: datetime


class MeasurementListResponse(BaseModel):
    """측정값 목록 응답."""

    measurements: list[MeasurementResponse]


class WeeklySeriesPoint(BaseModel):
    date: date
    value: float | None = None
    goal_value: float | None = None


class WeeklyCategoryResponse(BaseModel):
    current_value: float | None = None
    previous_value: float | None = None
    change: float | None = None
    goal_value: float
    series: list[WeeklySeriesPoint] = Field(default_factory=list)


class HealthWeeklyResponse(BaseModel):
    week_start: date
    week_end: date
    previous_week_start: date
    previous_week_end: date
    categories: dict[str, WeeklyCategoryResponse]
