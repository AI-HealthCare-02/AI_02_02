"""사주 사이드 게임 오케스트레이션 서비스 (v2.7 P1 스캐폴딩 / P1.5 확장).

역할:
- 프로필 조회/저장 (consent 선행 필수)
- 오늘의 운세 조회 (P1: stub, P4에서 실제 생성)
- 데이터 export / hard delete (P1.5 실구현)

P2~P6 확장 지점:
- P2: SajuChart 계산 (sajupy 어댑터)
- P3: 4학파·템플릿·Specificity Filter
- P4: 7 섹션 body/reason 생성

P1.5 삭제 정책 (확정):
- profile: hard delete (soft delete 필드는 "기능 비활성화" 용도로 유지)
- chart / daily_cards / feedback_events: hard delete (FK CASCADE 로 충분하나 명시적 삭제)
- consent_events: hard delete 후 `revoked-by-user` 이벤트 1건 append (감사 흔적)
- 전체 삭제는 DB 트랜잭션 한 번에 수행 (원자성 보장)
"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Any

from tortoise.transactions import in_transaction

from backend.models.saju import (
    SajuChart,
    SajuConsentEvent,
    SajuDailyCard,
    SajuFeedbackEvent,
    SajuProfile,
)
from backend.services.saju.consent import SajuConsentService
from backend.services.saju.engine.chart import (
    ENGINE_VERSION,
    compute_natal_chart,
)
from backend.services.saju.feedback import SajuFeedbackService
from backend.services.saju.interpret import build_today_card
from backend.services.saju.templates import build_reading


def _normalize_birth_time(birth_time: time | None) -> time | None:
    """birth_time 을 timezone-naive `datetime.time` 으로 정규화.

    배경:
    - `SajuProfile.birth_time` 컬럼은 `TIME WITHOUT TIME ZONE` (P1 스키마).
    - Tortoise 전역 `timezone="Asia/Seoul"` 설정이 있어 `time` 값도 pytz
      `DstTzInfo` 로 자동 감싸면 asyncpg 가 `TIME WITHOUT TZ` 컬럼에
      `tzinfo` 를 인코딩하다 실패 (`NoneType' object has no attribute 'days'`).
    - Pydantic 이 DTO 파싱 시 `"12:00+09:00"` 같은 문자열도 tz-aware `time`
      으로 만들 수 있음.

    정책: SajuProfile 로 저장되기 직전 단일 경로에서 tzinfo 를 강제 제거.
    DB 스키마·마이그레이션은 건드리지 않는다.
    """
    if birth_time is None:
        return None
    if birth_time.tzinfo is not None:
        return birth_time.replace(tzinfo=None)
    return birth_time


def _profile_to_dict(profile: SajuProfile) -> dict[str, Any]:
    """SajuProfile → export dict. 민감 필드는 그대로 포함 (사용자 본인 소유 데이터)."""
    return {
        "birth_date": profile.birth_date,
        "is_lunar": profile.is_lunar,
        "is_leap_month": profile.is_leap_month,
        "birth_time": profile.birth_time,
        "birth_time_accuracy": profile.birth_time_accuracy,
        "gender": profile.gender,
    }


def _chart_to_dict(chart: SajuChart) -> dict[str, Any]:
    return {
        "engine_version": chart.engine_version,
        "natal": chart.natal or {},
        "strength": chart.strength or {},
        "yongshin": chart.yongshin or {},
        "daewoon": chart.daewoon or [],
        "computed_at": chart.computed_at,
    }


def _card_to_dict(card: SajuDailyCard) -> dict[str, Any]:
    return {
        "card_date": card.card_date,
        "summary": card.summary,
        "keywords": card.keywords or [],
        "sections": card.sections or [],
        "safety_notice": card.safety_notice,
        "engine_version": card.engine_version,
        "template_version": card.template_version,
        "created_at": card.created_at,
    }


def _consent_to_dict(event: SajuConsentEvent) -> dict[str, Any]:
    return {
        "consent_version": event.consent_version,
        "granted": event.granted,
        "ip_hash": event.ip_hash,
        "ua_hash": event.ua_hash,
        "created_at": event.created_at,
    }


def _feedback_to_dict(event: SajuFeedbackEvent) -> dict[str, Any]:
    # card 는 prefetch_related 로 받아온 상태. 삭제된 카드면 card_id=None.
    card_date: date | None = None
    if event.card_id is not None:
        # prefetch 후 event.card 는 SajuDailyCard (또는 삭제된 경우 None)
        card_obj = getattr(event, "card", None)
        if card_obj is not None:
            card_date = card_obj.card_date
    return {
        "card_date": card_date,
        "section_key": event.section_key,
        "verdict": event.verdict,
        "created_at": event.created_at,
    }


class SajuService:
    """사주 프로필·오늘 카드 오케스트레이션 + 개인정보 권리(export/delete)."""

    def __init__(self) -> None:
        self._consent_service = SajuConsentService()
        self._feedback_service = SajuFeedbackService()

    # ──────────────────────── Profile ────────────────────────
    async def get_profile(self, user_id: int) -> SajuProfile | None:
        """활성(soft delete 제외) 프로필 조회."""
        return await SajuProfile.filter(user_id=user_id, is_deleted=False).first()

    async def upsert_profile(
        self,
        *,
        user_id: int,
        birth_date: date,
        is_lunar: bool,
        is_leap_month: bool,
        birth_time: time | None,
        birth_time_accuracy: str,
        gender: str,
    ) -> SajuProfile:
        """프로필 생성/수정 (soft delete된 기존 프로필은 되살리지 않고 신규 생성).

        birth_time 은 `_normalize_birth_time` 을 통해 timezone-naive 로 강제된다.
        tz-aware time 이 들어오면 tzinfo 를 벗겨 저장 — DB 컬럼이 TIME WITHOUT TZ 인
        덕에 aware 를 그대로 넘기면 asyncpg encode 단계에서 실패하기 때문.
        """
        normalized_birth_time = _normalize_birth_time(birth_time)

        existing = await self.get_profile(user_id=user_id)
        if existing is not None:
            existing.birth_date = birth_date
            existing.is_lunar = is_lunar
            existing.is_leap_month = is_leap_month
            existing.birth_time = normalized_birth_time
            existing.birth_time_accuracy = birth_time_accuracy
            existing.gender = gender
            await existing.save()
            return existing

        return await SajuProfile.create(
            user_id=user_id,
            birth_date=birth_date,
            is_lunar=is_lunar,
            is_leap_month=is_leap_month,
            birth_time=normalized_birth_time,
            birth_time_accuracy=birth_time_accuracy,
            gender=gender,
        )

    # ──────────────────────── Chart (P2) ────────────────────────
    async def ensure_chart(self, *, profile: SajuProfile) -> SajuChart:
        """프로필 → 사주 원국 계산 + 캐시 (engine_version 기반 invalidation).

        - 같은 profile + 같은 engine_version 이면 기존 chart 재사용
        - engine_version 다르면 재계산 + 갱신
        - profile 없으면 호출하지 않음 (라우터 레이어에서 404 처리)
        """
        existing = await SajuChart.filter(profile_id=profile.id).first()
        if existing is not None and existing.engine_version == ENGINE_VERSION:
            return existing

        natal_dict = compute_natal_chart(
            birth_date=profile.birth_date,
            birth_time=profile.birth_time,
            is_lunar=profile.is_lunar,
            gender=profile.gender,  # type: ignore[arg-type]
        )

        if existing is not None:
            # engine_version bump → 재계산 후 갱신
            existing.engine_version = natal_dict["engine_version"]
            existing.natal = natal_dict["natal"]
            existing.strength = natal_dict["strength"]
            existing.yongshin = natal_dict["yongshin"]
            existing.daewoon = natal_dict["daewoon"]
            await existing.save()
            return existing

        return await SajuChart.create(
            profile_id=profile.id,
            engine_version=natal_dict["engine_version"],
            natal=natal_dict["natal"],
            strength=natal_dict["strength"],
            yongshin=natal_dict["yongshin"],
            daewoon=natal_dict["daewoon"],
        )

    # ──────────────────────── Today (P3+P4) ────────────────────────
    async def get_or_create_today_card(
        self,
        *,
        user_id: int,
        focus: str = "total",
        tone: str = "soft",
    ) -> dict | None:
        """오늘의 운세 카드 payload 1건 반환 (없으면 생성, 버전 다르면 재생성).

        반환: build_today_card 확장 payload (DB 저장 필드 + UI 노출 신규 필드).
        None: 프로필 없음 (라우터 404).

        절차:
        1. 활성 profile 확인
        2. ensure_chart 로 natal 보장
        3. 오늘 카드 DB 조회
           - 있고 + engine/template 버전 일치 → DB 값 사용 + natal/today 확장은 재계산
           - 버전 불일치 → 갱신 후 payload 반환
           - 없음 → 신규 생성 + payload 반환

        하루 1장 정책 (UNIQUE(user, card_date)) 유지.
        """
        profile = await self.get_profile(user_id=user_id)
        if profile is None:
            return None

        chart = await self.ensure_chart(profile=profile)
        natal = chart.natal or {}

        from datetime import date as _date  # 지역 import — 모듈 상단 충돌 회피
        today = _date.today()

        payload = build_today_card(
            natal=natal,
            engine_version=chart.engine_version,
            today=today,
            focus=focus,  # type: ignore[arg-type]
            tone=tone,  # type: ignore[arg-type]
        )

        existing = await SajuDailyCard.filter(user_id=user_id, card_date=today).first()
        if existing is not None:
            same_version = (
                existing.engine_version == payload["engine_version"]
                and existing.template_version == payload["template_version"]
            )
            if same_version:
                # DB 저장된 sections/summary/keywords 사용 + 확장 필드는 payload 값 사용
                payload["summary"] = existing.summary
                payload["keywords"] = existing.keywords or []
                payload["sections"] = existing.sections or []
                payload["safety_notice"] = existing.safety_notice
                payload["card_date"] = existing.card_date
                return payload
            # 버전 차이 → 갱신
            existing.summary = payload["summary"]
            existing.keywords = payload["keywords"]
            existing.sections = payload["sections"]
            existing.safety_notice = payload["safety_notice"]
            existing.engine_version = payload["engine_version"]
            existing.template_version = payload["template_version"]
            await existing.save()
            return payload

        await SajuDailyCard.create(
            user_id=user_id,
            card_date=today,
            summary=payload["summary"],
            keywords=payload["keywords"],
            sections=payload["sections"],
            safety_notice=payload["safety_notice"],
            engine_version=payload["engine_version"],
            template_version=payload["template_version"],
        )
        return payload

    async def get_reading(
        self,
        *,
        user_id: int,
        period: str,
        year: int = 2026,
    ) -> dict | None:
        """기질/연운/月운 리딩 즉시 생성 (P4.2).

        `/today` 와 달리 DB 에 저장하지 않는다. 첫 경험에서 넓은 맥락을 보여주는
        보조 API 이므로, 원국 chart 만 보장한 뒤 템플릿 결과를 바로 반환한다.
        """
        profile = await self.get_profile(user_id=user_id)
        if profile is None:
            return None

        chart = await self.ensure_chart(profile=profile)
        return build_reading(
            period=period,  # type: ignore[arg-type]
            natal=chart.natal or {},
            engine_version=chart.engine_version,
            year=year,
        )

    async def soft_delete_profile(self, user_id: int) -> bool:
        """프로필 소프트 삭제 — "사주 기능 끄기" 용도. 데이터는 유지.

        완전 삭제는 hard_delete_user_data 를 사용.
        """
        profile = await self.get_profile(user_id=user_id)
        if profile is None:
            return False
        profile.is_deleted = True
        profile.deleted_at = datetime.now()
        await profile.save()
        return True

    # ────────────────── Export (GET /saju/data/export) ──────────────────
    async def export_user_data(self, user_id: int) -> dict[str, Any]:
        """사용자 소유 사주 데이터 전체를 dict 로 반환.

        포함 범위:
        - consent_events: append-only 이력 전부 (soft 삭제된 이벤트는 없음)
        - profile: soft delete 여부 무관하게 첫 프로필 1건
          (완전 삭제되지 않은 한 반환 — 사용자 본인 자료)
        - chart: profile 에 연결된 가장 최근 계산 1건
        - daily_cards: 전체 이력 시간 역순
        - feedback_events: 전체 이력 시간 오름차순 (card prefetch)
        """
        consent_events = await self._consent_service.list_all(user_id=user_id)
        # profile: is_deleted 필터 없이 한 사용자당 유일 (OneToOneField)
        profile = await SajuProfile.filter(user_id=user_id).first()
        chart = None
        if profile is not None:
            chart = await SajuChart.filter(profile_id=profile.id).first()
        daily_cards = (
            await SajuDailyCard.filter(user_id=user_id)
            .order_by("-card_date", "-created_at")
            .all()
        )
        feedback_events = await self._feedback_service.list_all(user_id=user_id)

        return {
            "exported_at": datetime.now(),
            "user_id": user_id,
            "consent_events": [_consent_to_dict(e) for e in consent_events],
            "profile": _profile_to_dict(profile) if profile is not None else None,
            "chart": _chart_to_dict(chart) if chart is not None else None,
            "daily_cards": [_card_to_dict(c) for c in daily_cards],
            "feedback_events": [_feedback_to_dict(f) for f in feedback_events],
        }

    # ────────────────── Hard Delete (DELETE /saju/data) ──────────────────
    async def hard_delete_user_data(self, user_id: int) -> dict[str, int]:
        """사주 전 데이터 hard delete 파이프라인.

        순서 (FK 의존 역순):
        1. feedback_events 삭제 (card FK → null=True, 독립 삭제 가능)
        2. daily_cards 삭제 (user FK CASCADE)
        3. chart 삭제 (profile FK OneToOne CASCADE — profile 삭제 시 자동이나 명시)
        4. profile 삭제
        5. consent_events 삭제
        6. `revoked-by-user` 이벤트 1건 기록 (감사 흔적)

        트랜잭션으로 묶어 원자성 보장. 예외 시 전체 롤백.
        반환: 삭제된 카운트 dict.
        """
        counts: dict[str, int] = {
            "feedback_events": 0,
            "daily_cards": 0,
            "chart": 0,
            "profile": 0,
            "consent_events": 0,
        }

        async with in_transaction():
            counts["feedback_events"] = await self._feedback_service.delete_all(
                user_id=user_id
            )
            counts["daily_cards"] = await SajuDailyCard.filter(user_id=user_id).delete()
            # chart 는 profile 과 1:1, profile 삭제 시 CASCADE. 카운트 위해 선조회.
            profile = await SajuProfile.filter(user_id=user_id).first()
            if profile is not None:
                chart_deleted = await SajuChart.filter(profile_id=profile.id).delete()
                counts["chart"] = chart_deleted
                counts["profile"] = await SajuProfile.filter(id=profile.id).delete()
            counts["consent_events"] = await self._consent_service.delete_all(
                user_id=user_id
            )
            # 삭제 감사 흔적 (revoke 이벤트 1건)
            await self._consent_service.record_revocation(user_id=user_id)

        return counts
