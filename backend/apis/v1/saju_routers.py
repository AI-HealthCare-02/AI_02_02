"""사주 사이드 게임 라우터 (v2.7 P1 / P1.5).

8 엔드포인트:
- GET/POST  /saju/consent
- GET/PUT   /saju/profile
- GET       /saju/today
- POST      /saju/feedback
- GET       /saju/data/export  (P1.5 실구현)
- DELETE    /saju/data         (P1.5 실구현 — hard delete)

정책:
- SAJU_ENABLED=false → 상품 엔드포인트(consent/profile/today/feedback) 503 반환
- export/delete는 플래그 무관하게 허용 (개인정보보호법 상 정보 주체의 권리)
- profile 저장 전 consent 선행 필수
- today 는 P4 (7 섹션 생성) 까지 501 Not Implemented
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import ORJSONResponse as Response

from backend.core import config
from backend.dependencies.security import get_request_user
from backend.dtos.saju import (
    SajuConsentRequest,
    SajuConsentResponse,
    SajuDataDeletionCounts,
    SajuDataDeletionResponse,
    SajuExportResponse,
    SajuFeedbackRequest,
    SajuFeedbackResponse,
    SajuProfileRequest,
    SajuProfileResponse,
    SajuTodayResponse,
)
from backend.models.users import User
from backend.services.saju import (
    SajuConsentService,
    SajuFeedbackService,
    SajuService,
)

saju_router = APIRouter(prefix="/saju", tags=["saju"])


def _require_enabled() -> None:
    """SAJU_ENABLED=false일 때 상품 API 차단 (export/delete 제외)."""
    if not config.SAJU_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="saju_disabled",
        )


# ─────────────────────────────────────────────
# Consent
# ─────────────────────────────────────────────
@saju_router.get("/consent", response_model=SajuConsentResponse)
async def get_consent(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[SajuConsentService, Depends(SajuConsentService)],
) -> Response:
    _require_enabled()
    latest = await service.get_latest(user_id=user.id)
    if latest is None:
        return Response(
            content=SajuConsentResponse(granted=False).model_dump(mode="json"),
            status_code=status.HTTP_200_OK,
        )
    return Response(
        content=SajuConsentResponse(
            granted=latest.granted,
            consent_version=latest.consent_version,
            granted_at=latest.created_at,
        ).model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@saju_router.post("/consent", response_model=SajuConsentResponse, status_code=status.HTTP_201_CREATED)
async def post_consent(
    payload: SajuConsentRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[SajuConsentService, Depends(SajuConsentService)],
) -> Response:
    _require_enabled()
    event = await service.record(
        user_id=user.id,
        consent_version=payload.consent_version,
        granted=payload.granted,
    )
    return Response(
        content=SajuConsentResponse(
            granted=event.granted,
            consent_version=event.consent_version,
            granted_at=event.created_at,
        ).model_dump(mode="json"),
        status_code=status.HTTP_201_CREATED,
    )


# ─────────────────────────────────────────────
# Profile
# ─────────────────────────────────────────────
@saju_router.get("/profile", response_model=SajuProfileResponse | None)
async def get_profile(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[SajuService, Depends(SajuService)],
) -> Response:
    _require_enabled()
    profile = await service.get_profile(user_id=user.id)
    if profile is None:
        return Response(content=None, status_code=status.HTTP_200_OK)
    return Response(
        content=SajuProfileResponse.model_validate(profile).model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@saju_router.put("/profile", response_model=SajuProfileResponse)
async def put_profile(
    payload: SajuProfileRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[SajuService, Depends(SajuService)],
    consent_service: Annotated[SajuConsentService, Depends(SajuConsentService)],
) -> Response:
    _require_enabled()
    # 동의 선행 필수 — 동의 없이 생년월일 저장 금지.
    if not await consent_service.is_granted(user_id=user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="consent_required",
        )
    profile = await service.upsert_profile(
        user_id=user.id,
        birth_date=payload.birth_date,
        is_lunar=payload.is_lunar,
        is_leap_month=payload.is_leap_month,
        birth_time=payload.birth_time,
        birth_time_accuracy=payload.birth_time_accuracy,
        gender=payload.gender,
    )
    return Response(
        content=SajuProfileResponse.model_validate(profile).model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


# ─────────────────────────────────────────────
# Today (오늘의 운세)
# ─────────────────────────────────────────────
@saju_router.get("/today", response_model=SajuTodayResponse)
async def get_today(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[SajuService, Depends(SajuService)],
) -> Response:
    """P1 단계 stub — P4에서 결정론 엔진 + 템플릿으로 7 섹션 생성 예정."""
    _require_enabled()
    profile = await service.get_profile(user_id=user.id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="no_profile",
        )
    # P1: 엔진 미구현 상태 표기. 501 Not Implemented로 프론트 guard 유도.
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="saju_engine_not_ready",
    )


# ─────────────────────────────────────────────
# Feedback
# ─────────────────────────────────────────────
@saju_router.post("/feedback", response_model=SajuFeedbackResponse, status_code=status.HTTP_201_CREATED)
async def post_feedback(
    payload: SajuFeedbackRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[SajuFeedbackService, Depends(SajuFeedbackService)],
) -> Response:
    _require_enabled()
    await service.record(
        user_id=user.id,
        card_date=payload.card_date,
        verdict=payload.verdict,
        section_key=payload.section_key,
    )
    return Response(
        content=SajuFeedbackResponse(received=True).model_dump(mode="json"),
        status_code=status.HTTP_201_CREATED,
    )


# ─────────────────────────────────────────────
# Data export / delete (feature flag와 무관하게 허용, P1.5 실구현)
# ─────────────────────────────────────────────
@saju_router.get("/data/export", response_model=SajuExportResponse)
async def export_data(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[SajuService, Depends(SajuService)],
) -> Response:
    """GET /saju/data/export — 사용자 본인 사주 데이터 전체를 JSON 반환.

    포함:
    - consent_events (append-only 전체 이력, 시간 오름차순)
    - profile (is_deleted 무관 — 감사 투명성)
    - chart (있으면 1건)
    - daily_cards (시간 역순)
    - feedback_events (시간 오름차순, 카드 card_date 참조 포함)

    feature flag 무관. 인증만 필요.
    """
    data = await service.export_user_data(user_id=user.id)
    payload = SajuExportResponse.model_validate(data)
    return Response(
        content=payload.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@saju_router.delete("/data", response_model=SajuDataDeletionResponse)
async def delete_data(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[SajuService, Depends(SajuService)],
) -> Response:
    """DELETE /saju/data — 사주 전 데이터 hard delete 파이프라인.

    순서: feedback_events → daily_cards → chart → profile → consent_events
          → revoked-by-user 이벤트 1건 기록 (감사 흔적)
    트랜잭션으로 원자성 보장. feature flag 무관.
    """
    counts_dict = await service.hard_delete_user_data(user_id=user.id)
    payload = SajuDataDeletionResponse(
        deleted=True,
        counts=SajuDataDeletionCounts(**counts_dict),
        revoke_event_recorded=True,
    )
    return Response(
        content=payload.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )
