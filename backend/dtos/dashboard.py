"""대시보드 API 응답 DTO."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from backend.dtos.health import DailyLogResponse


class RiskSummaryResponse(BaseModel):
    """위험도 요약 (대시보드 sub-object + GET /risk/latest 공용)."""

    findrisc_score: int
    risk_level: str
    sleep_score: int | None = None
    diet_score: int | None = None
    exercise_score: int | None = None
    lifestyle_score: int | None = None
    assessed_at: datetime | None = None


class RiskDetailResponse(RiskSummaryResponse):
    """위험도 상세 (GET /risk/latest 전용)."""

    score_breakdown: dict[str, int] = {}
    top_positive_factors: list[str] = []
    top_risk_factors: list[str] = []


class EngagementResponse(BaseModel):
    """참여 상태 응답."""

    state: str
    seven_day_response_rate: float
    cooldown_until: datetime | None = None


class ChallengeSummaryItem(BaseModel):
    """대시보드용 챌린지 요약 항목."""

    user_challenge_id: int
    name: str
    emoji: str
    category: str
    progress_pct: float
    today_checked: bool


class DashboardInitResponse(BaseModel):
    """GET /dashboard/init 응답."""

    daily_log: DailyLogResponse | None = None
    risk: RiskSummaryResponse | None = None
    challenge_summary: list[ChallengeSummaryItem] = []
    engagement: EngagementResponse | None = None
    user_group: str | None = None
