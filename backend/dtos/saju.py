"""사주 사이드 게임 DTO (v2.7 P1 스캐폴딩).

Request/Response 모델. 금지어 자동 검증은 P4에서 추가.
"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field

from backend.dtos.base import BaseSerializerModel


# ─────────────────────────────────────────────
# Consent
# ─────────────────────────────────────────────
class SajuConsentRequest(BaseModel):
    """사주 전용 동의 기록 요청."""

    consent_version: str = Field(..., min_length=1, max_length=16)
    granted: bool


class SajuConsentResponse(BaseSerializerModel):
    granted: bool
    consent_version: str | None = None
    granted_at: datetime | None = None


# ─────────────────────────────────────────────
# Profile
# ─────────────────────────────────────────────
BirthTimeAccuracyLiteral = Literal["exact", "approx", "unknown"]
GenderLiteral = Literal["MALE", "FEMALE", "UNKNOWN"]


class SajuProfileRequest(BaseModel):
    """프로필 저장/수정 (consent 선행 필수, 서비스 레이어에서 검증)."""

    birth_date: date
    is_lunar: bool = False
    is_leap_month: bool = False
    birth_time: time | None = None
    birth_time_accuracy: BirthTimeAccuracyLiteral = "unknown"
    gender: GenderLiteral = "UNKNOWN"


class SajuProfileResponse(BaseSerializerModel):
    birth_date: date
    is_lunar: bool
    is_leap_month: bool
    birth_time: time | None = None
    birth_time_accuracy: BirthTimeAccuracyLiteral
    gender: GenderLiteral


# ─────────────────────────────────────────────
# Today (오늘의 운세)
# ─────────────────────────────────────────────
SectionKey = Literal["total", "money", "relation", "health", "work", "caution", "one_thing"]


class SajuSectionResponse(BaseSerializerModel):
    """7 섹션 각 1개 — body(결과) + reason(왜 이렇게 봤나요?)."""

    key: SectionKey
    title: str
    body: str
    reason: str | None = None  # one_thing 섹션은 reason null 허용


class SajuTodayResponse(BaseSerializerModel):
    summary: str
    keywords: list[str] = Field(default_factory=list, max_length=5)
    sections: list[SajuSectionResponse]
    safety_notice: str


# ─────────────────────────────────────────────
# Feedback
# ─────────────────────────────────────────────
VerdictLiteral = Literal["wow", "match", "mild", "mismatch"]


class SajuFeedbackRequest(BaseModel):
    """피드백 4축. section_key 생략 시 카드 전체 대상."""

    card_date: date
    verdict: VerdictLiteral
    section_key: SectionKey | None = None


class SajuFeedbackResponse(BaseSerializerModel):
    received: bool = True
