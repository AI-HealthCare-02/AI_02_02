"""분석 API 응답 DTO."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ScorecardResponse(BaseModel):
    """4개 생활습관 점수."""

    sleep_score: int
    diet_score: int
    exercise_score: int
    lifestyle_score: int


class RiskBrief(BaseModel):
    """분석 요약용 위험도 간략 정보."""

    findrisc_score: int
    risk_level: str


class AnalysisSummaryResponse(BaseModel):
    """GET /analysis/summary 응답."""

    period: int
    scorecard: ScorecardResponse
    risk: RiskBrief
    top_positive_factors: list[str] = []
    top_risk_factors: list[str] = []
    cached_at: datetime
