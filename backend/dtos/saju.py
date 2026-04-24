"""사주 사이드 게임 DTO (v2.7 P1 / P1.5).

Request/Response 모델. 금지어 자동 검증은 P4에서 추가.

P1.5 확장: export (GET /saju/data/export) 전용 응답 스키마.
"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

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


class SajuNatalPillar(BaseSerializerModel):
    """원국 4주 중 한 기둥. 천간·지지·십성 + 일주 플래그."""

    model_config = ConfigDict(extra="ignore")

    gan: str = ""
    ji: str = ""
    pillar: str = ""
    sisung_gan: str | None = None
    sisung_ji: str | None = None
    is_day_master: bool = False


class SajuNatalChart(BaseSerializerModel):
    """사주 원국 4주 + 일간·성별."""

    model_config = ConfigDict(extra="ignore")

    year: SajuNatalPillar | None = None
    month: SajuNatalPillar | None = None
    day: SajuNatalPillar | None = None
    hour: SajuNatalPillar | None = None
    day_master: str = ""
    gender: GenderLiteral = "UNKNOWN"


class SajuDayRelation(BaseSerializerModel):
    """오늘 일간과 본인 일간의 관계 (합/충/생/극/비화)."""

    model_config = ConfigDict(extra="ignore")

    kind: Literal["harmony", "clash", "support", "pressure", "same"]
    kind_kr: str


class SajuYongshin(BaseSerializerModel):
    """억부용신 판정 결과 (한국 현대 자평 기준, P3)."""

    model_config = ConfigDict(extra="ignore")

    school: str = "eokbu-korean-modern"
    sin_gang: Literal["strong", "weak", "balanced"] = "balanced"
    strength_score: int = 0
    strength_components: dict[str, int] = Field(default_factory=dict)
    yongshin_element: str = ""
    yongshin_role: str = ""
    hee_shin_element: str = ""
    ki_shin_element: str = ""
    reasoning: str = ""


class SajuTodayResponse(BaseSerializerModel):
    # 기존 7 필드 유지
    summary: str
    keywords: list[str] = Field(default_factory=list, max_length=5)
    sections: list[SajuSectionResponse]
    safety_notice: str
    # P4 추가 — 클라이언트가 cache 무효화 판정 + 디버깅용
    engine_version: str = ""
    template_version: str = ""
    card_date: date | None = None
    # P2.2 (UI 원국·일진 노출) — 모두 optional, backward compat
    natal_chart: SajuNatalChart | None = None
    today_pillar: str = ""
    today_gan: str = ""
    today_ji: str = ""
    today_element: str = ""
    day_master: str = ""
    day_master_element: str = ""
    day_relation: SajuDayRelation | None = None
    element_distribution: dict[str, int] = Field(default_factory=dict)
    limitations: list[str] = Field(default_factory=list)
    yongshin: SajuYongshin | None = None


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


# ─────────────────────────────────────────────
# Export / Delete (P1.5, 개인정보 권리)
# ─────────────────────────────────────────────
class SajuConsentEventExport(BaseSerializerModel):
    """동의 이력 단일 이벤트 (append-only 감사 추적용)."""

    consent_version: str
    granted: bool
    ip_hash: str | None = None
    ua_hash: str | None = None
    created_at: datetime


class SajuChartExport(BaseSerializerModel):
    """계산된 사주 구조 (P2 이후 실제 값이 채워짐)."""

    engine_version: str
    natal: dict[str, Any] = Field(default_factory=dict)
    strength: dict[str, Any] = Field(default_factory=dict)
    yongshin: dict[str, Any] = Field(default_factory=dict)
    daewoon: list[Any] = Field(default_factory=list)
    computed_at: datetime


class SajuDailyCardExport(BaseSerializerModel):
    """오늘의 운세 카드 1건."""

    card_date: date
    summary: str
    keywords: list[str] = Field(default_factory=list)
    sections: list[dict[str, Any]] = Field(default_factory=list)
    safety_notice: str
    engine_version: str
    template_version: str
    created_at: datetime


class SajuFeedbackEventExport(BaseSerializerModel):
    """피드백 1건 (card_date 는 삭제된 카드의 원일자·없으면 null)."""

    card_date: date | None = None
    section_key: str | None = None
    verdict: VerdictLiteral
    created_at: datetime


class SajuExportResponse(BaseSerializerModel):
    """GET /saju/data/export 응답.

    feature flag 무관하게 반환. soft delete 된 프로필도 포함 (감사 추적).
    """

    exported_at: datetime
    user_id: int
    consent_events: list[SajuConsentEventExport] = Field(default_factory=list)
    profile: SajuProfileResponse | None = None
    chart: SajuChartExport | None = None
    daily_cards: list[SajuDailyCardExport] = Field(default_factory=list)
    feedback_events: list[SajuFeedbackEventExport] = Field(default_factory=list)


class SajuDataDeletionCounts(BaseSerializerModel):
    """DELETE /saju/data 삭제 통계."""

    consent_events: int = 0
    profile: int = 0  # 0 or 1
    chart: int = 0  # 0 or 1
    daily_cards: int = 0
    feedback_events: int = 0


class SajuDataDeletionResponse(BaseSerializerModel):
    deleted: bool = True
    counts: SajuDataDeletionCounts
    revoke_event_recorded: bool = True
