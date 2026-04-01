from datetime import date, datetime

from pydantic import BaseModel

from app.domains.challenges.enums import ChallengeCategory, ChallengeStatus, CheckinJudgeType, CheckinStatus
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


class CompletedChallengeItem(BaseModel):
    user_challenge_id: int
    name: str
    emoji: str
    completed_at: date
    final_streak: int
    target_days: int


class RecommendedChallengeItem(BaseModel):
    template_id: int
    name: str
    emoji: str
    category: ChallengeCategory
    duration_days: int
    description: str
    evidence: str
    for_groups: list[UserGroup]


class ChallengeStats(BaseModel):
    total_streak: int
    total_points: int
    completed_count: int
    level: int


class BadgeItem(BaseModel):
    id: str
    label: str
    emoji: str
    earned: bool
    earned_at: datetime | None


class ChallengeOverviewResponse(BaseModel):
    active: list[ActiveChallengeItem]
    completed: list[CompletedChallengeItem]
    recommended: list[RecommendedChallengeItem]
    stats: ChallengeStats
    badges: list[BadgeItem]


class JoinChallengeResponse(BaseModel):
    user_challenge_id: int
    template_id: int
    name: str
    status: ChallengeStatus
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
