"""챌린지 API 요청/응답 DTO."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel

from backend.models.enums import CheckinStatus


class ChallengeOverviewItem(BaseModel):
    """챌린지 전체 조회 항목."""

    user_challenge_id: int
    template_id: int
    name: str
    emoji: str
    category: str
    status: str
    is_fixed: bool
    current_streak: int
    best_streak: int
    progress_pct: float
    started_at: datetime
    target_days: int
    days_completed: int
    today_checked: bool
    selection_source: str


class ChallengeRecommendedItem(BaseModel):
    """추천 챌린지 항목."""

    template_id: int
    name: str
    emoji: str
    category: str
    description: str
    default_duration_days: int


class ChallengeCatalogItem(BaseModel):
    """선택 UI용 챌린지 템플릿 항목."""

    template_id: int
    code: str
    name: str
    emoji: str
    category: str
    description: str
    default_duration_days: int
    is_recommended: bool = False


class ChallengeOverviewResponse(BaseModel):
    """GET /challenges/overview 응답."""

    active: list[ChallengeOverviewItem] = []
    completed: list[ChallengeOverviewItem] = []
    recommended: list[ChallengeRecommendedItem] = []
    catalog: list[ChallengeCatalogItem] = []
    stats: dict[str, int] = {}


class ChallengeJoinResponse(BaseModel):
    """POST /challenges/{template_id}/join 응답."""

    user_challenge_id: int
    template_id: int
    status: str
    selection_source: str
    started_at: datetime
    target_days: int


class ChallengeCheckinRequest(BaseModel):
    """POST /challenges/{id}/checkin 요청."""

    model_config = {"json_schema_extra": {"example": {
        "status": "achieved",
    }}}

    status: CheckinStatus


class ChallengeCheckinResponse(BaseModel):
    """체크인 응답."""

    checkin_id: int
    checkin_date: date
    status: str
    current_streak: int
    best_streak: int
    progress_pct: float
    days_completed: int


class CalendarDayEntry(BaseModel):
    """달력 하루 항목."""

    date: date
    status: str


class ChallengeCalendarResponse(BaseModel):
    """GET /challenges/{id}/calendar 응답."""

    user_challenge_id: int
    template_name: str
    entries: list[CalendarDayEntry] = []
    total_days: int
    achieved_days: int
    missed_days: int
