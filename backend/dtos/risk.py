from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class RiskHistoryPoint(BaseModel):
    period_start: date
    period_end: date
    findrisc_score: int
    risk_level: str
    predicted_score_pct: int | None = None
    predicted_risk_level: str | None = None
    predicted_risk_label: str | None = None
    predicted_stage_label: str | None = None
    model_enabled: bool = False
    model_status: str | None = None
    model_track: str | None = None
    assessed_at: datetime


class RiskHistoryResponse(BaseModel):
    history: list[RiskHistoryPoint] = Field(default_factory=list)
