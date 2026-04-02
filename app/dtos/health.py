"""건강 데이터 API 요청/응답 DTO."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import DataSource, MeasurementSource, MeasurementType

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


class DailyLogPatchRequest(BaseModel):
    """일일 건강 기록 직접입력 요청."""

    model_config = {"json_schema_extra": {"example": {
        "source": "direct",
        "sleep_quality": "good",
        "breakfast_status": "hearty",
        "exercise_done": True,
        "exercise_type": "walking",
        "exercise_minutes": 30,
        "water_cups": 5,
    }}}

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
    """소급입력 단일 항목."""

    log_date: date
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
    """주기적 측정값 생성 요청."""

    model_config = {"json_schema_extra": {"example": {
        "measurement_type": "weight",
        "numeric_value": 78.5,
        "source": "manual",
        "measured_at": "2026-04-02T09:00:00+09:00",
    }}}

    measurement_type: MeasurementType
    numeric_value: float
    numeric_value_2: float | None = None  # 혈압 이완기용
    source: MeasurementSource = MeasurementSource.MANUAL
    measured_at: datetime


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
