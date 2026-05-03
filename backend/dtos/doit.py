"""Do it OS API 요청/응답 DTO."""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Any

from pydantic import BaseModel, Field


class ClarificationDTO(BaseModel):
    actionable: bool | None = None
    decision: str | None = None
    source: str | None = None


class EndOfDayDTO(BaseModel):
    ritualDate: str | None = None  # noqa: N815 — 프론트 JSON 키와 일치
    action: str | None = None


class ThoughtDTO(BaseModel):
    """단일 Thought 응답."""

    id: str
    text: str
    category: str | None
    created_at: datetime
    classified_at: datetime | None
    discarded_at: datetime | None
    completed_at: datetime | None

    canvas_x: float | None
    canvas_y: float | None
    rotation: int
    color: str | None
    card_width: int | None
    card_height: int | None

    scheduled_date: date | None
    scheduled_time: time | None
    schedule_note: str | None
    planned_date: date | None

    description: str | None
    next_action: str | None
    project_status: str | None
    project_link_id: str | None

    note_body: str | None

    clarification: ClarificationDTO
    end_of_day: EndOfDayDTO

    waiting_for: str | None
    someday_reason: str | None
    urgency: Any | None

    updated_at: datetime

    model_config = {"from_attributes": True}


class ThoughtCreateDTO(BaseModel):
    """새 Thought 생성 요청."""

    id: str = Field(min_length=1, max_length=40)
    text: str = Field(default="", max_length=10000)
    category: str | None = None
    created_at: datetime
    classified_at: datetime | None = None
    discarded_at: datetime | None = None
    completed_at: datetime | None = None

    canvas_x: float | None = None
    canvas_y: float | None = None
    rotation: int = 0
    color: str | None = None
    card_width: int | None = None
    card_height: int | None = None

    scheduled_date: date | None = None
    scheduled_time: time | None = None
    schedule_note: str | None = None
    planned_date: date | None = None

    description: str | None = None
    next_action: str | None = None
    project_status: str | None = None
    project_link_id: str | None = None

    note_body: str | None = None

    clarification: ClarificationDTO = Field(default_factory=ClarificationDTO)
    end_of_day: EndOfDayDTO = Field(default_factory=EndOfDayDTO)

    waiting_for: str | None = None
    someday_reason: str | None = None
    urgency: Any | None = None


class ThoughtUpdateDTO(BaseModel):
    """Thought 부분 수정 요청 — 포함된 필드만 반영."""

    text: str | None = None
    category: str | None = None
    classified_at: datetime | None = None
    discarded_at: datetime | None = None
    completed_at: datetime | None = None

    canvas_x: float | None = None
    canvas_y: float | None = None
    rotation: int | None = None
    color: str | None = None
    card_width: int | None = None
    card_height: int | None = None

    scheduled_date: date | None = None
    scheduled_time: time | None = None
    schedule_note: str | None = None
    planned_date: date | None = None

    description: str | None = None
    next_action: str | None = None
    project_status: str | None = None
    project_link_id: str | None = None

    note_body: str | None = None

    clarification: ClarificationDTO | None = None
    end_of_day: EndOfDayDTO | None = None

    waiting_for: str | None = None
    someday_reason: str | None = None
    urgency: Any | None = None


class BulkSyncDTO(BaseModel):
    """localStorage → DB 초기 이전용 bulk upsert 요청."""

    thoughts: list[ThoughtCreateDTO] = Field(max_length=5000)


class BulkSyncResultDTO(BaseModel):
    synced: int
    skipped: int
    errors: list[str] = []


class AiSummaryDTO(BaseModel):
    """AI 도움 모드에 전달할 요약본 — 원본 text 전체 미포함."""

    unclassified_count: int
    today_todos: list[str]
    overdue_schedules: int
    active_projects: list[str]
    recent_notes_count: int
