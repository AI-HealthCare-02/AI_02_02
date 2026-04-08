from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field


class RiskHistoryPoint(BaseModel):
    period_start: date
    period_end: date
    findrisc_score: int
    risk_level: str
    assessed_at: datetime


class RiskHistoryResponse(BaseModel):
    history: list[RiskHistoryPoint] = Field(default_factory=list)
