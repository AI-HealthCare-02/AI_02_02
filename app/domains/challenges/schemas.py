from datetime import date

from pydantic import BaseModel

from app.domains.challenges.enums import (
    ChallengeCategory,
    ChallengeSelectionSource,
    ChallengeStatus,
    CheckinJudgeType,
    CheckinStatus,
)
from app.domains.health.enums import UserGroup


class ActiveChallengeItem(BaseModel):
    user_challenge_id: int
    template_id: int
    name: str
    emoji: str
    category: ChallengeCategory
    status: ChallengeStatus
    current_streak: int
    best_streak: int
    progress_pct: float
    started_at: date
    target_days: int
    days_completed: int
    today_checked: bool
    selection_source: ChallengeSelectionSource


class CompletedChallengeItem(BaseModel):
    user_challenge_id: int
    template_id: int
    name: str
    emoji: str
    completed_at: date
    final_streak: int
    target_days: int


class RecommendedChallengeItem(BaseModel):
    template_id: int
    code: str
    name: str
    emoji: str
    category: ChallengeCategory
    default_duration_days: int
    description: str
    evidence_summary: str | None = None
    for_groups: list[UserGroup]


class ChallengeStats(BaseModel):
    active_count: int
    completed_count: int


class ChallengeOverviewResponse(BaseModel):
    active: list[ActiveChallengeItem]
    completed: list[CompletedChallengeItem]
    recommended: list[RecommendedChallengeItem]
    stats: ChallengeStats


class JoinChallengeResponse(BaseModel):
    user_challenge_id: int
    template_id: int
    status: ChallengeStatus
    selection_source: ChallengeSelectionSource
    started_at: date
    target_days: int


class ChallengeCheckinRequest(BaseModel):
    status: CheckinStatus


class ChallengeCheckinResponse(BaseModel):
    checkin_id: int
    checkin_date: date
    status: CheckinStatus
    judged_by: CheckinJudgeType
    current_streak: int
    progress_pct: float


class ChallengeCalendarItem(BaseModel):
    date: date
    status: CheckinStatus | None
    judged_by: CheckinJudgeType | None


class ChallengeCalendarResponse(BaseModel):
    user_challenge_id: int
    name: str
    calendar: list[ChallengeCalendarItem]
    current_streak: int
    best_streak: int
    progress_pct: float
