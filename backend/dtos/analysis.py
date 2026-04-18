"""Analysis API response DTOs."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ScorecardResponse(BaseModel):
    """Top-level lifestyle score snapshot."""

    sleep_score: int
    diet_score: int
    exercise_score: int
    lifestyle_score: int


class RiskBrief(BaseModel):
    """Compact risk summary."""

    findrisc_score: int
    risk_level: str
    predicted_score_pct: int | None = None
    predicted_risk_level: str | None = None
    predicted_stage_label: str | None = None
    model_enabled: bool = False


class ImpactAnalysisItem(BaseModel):
    """Relative contribution for report detail influence analysis."""

    key: str
    label: str
    contribution_pct: int
    current_score: int
    target_score: int


class CategoryComparisonItem(BaseModel):
    """Current-period vs previous-period comparison by health category."""

    key: str
    label: str
    current_value: float | None = None
    previous_value: float | None = None
    current_display: str
    previous_display: str
    delta_pct: int | None = None
    score: int


class AnalysisSummaryResponse(BaseModel):
    """GET /analysis/summary response."""

    period: int
    scorecard: ScorecardResponse
    risk: RiskBrief
    summary_message: str
    impact_analysis: list[ImpactAnalysisItem] = Field(default_factory=list)
    comparisons: list[CategoryComparisonItem] = Field(default_factory=list)
    top_positive_factors: list[str] = Field(default_factory=list)
    top_risk_factors: list[str] = Field(default_factory=list)
    cached_at: datetime
