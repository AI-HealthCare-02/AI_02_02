"""위험도 API 라우터."""

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse as Response

from backend.dependencies.security import get_request_user
from backend.models.health import DailyHealthLog, HealthProfile
from backend.models.users import User
from backend.services.report_coaching import ReportCoachingService
from backend.services.risk_analysis import RiskAnalysisService

risk_router = APIRouter(prefix="/risk", tags=["risk"])


@risk_router.get("/current", status_code=status.HTTP_200_OK)
async def get_current_risk(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[RiskAnalysisService, Depends(RiskAnalysisService)],
) -> Response:
    """리포트 페이지용 "빠른" 위험도 조회 (캐시 우선).

    - 캐시 HIT → 수십 ms 내 응답
    - MISS → 최신 RiskAssessment 조회 + 모델 예측 덧붙임 (코칭 제외)
    - stale(24h+) → 백그라운드 재계산 fire-and-forget
    - AI 코칭은 별도 엔드포인트 `/risk/coaching`에서 지연 로드
    """
    result = await service.get_current_risk(user_id=user.id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="건강 프로필이 없습니다. 먼저 온보딩을 완료해주세요.",
        )
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@risk_router.get("/coaching", status_code=status.HTTP_200_OK)
async def get_risk_coaching(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[RiskAnalysisService, Depends(RiskAnalysisService)],
) -> Response:
    """AI 생활 코칭 지연 로드 엔드포인트. Redis 6시간 캐시.

    OpenAI API 동기 호출(~2~5s)이 리포트 초기 로딩 경로에서 분리된다.
    프론트는 리포트 본문을 먼저 렌더 후 이 엔드포인트를 별도 호출해 코칭 박스에 채운다.
    """
    profile = await HealthProfile.get_or_none(user_id=user.id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="건강 프로필이 없습니다.",
        )

    detail = await service.get_current_risk(user_id=user.id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="위험도 평가가 아직 준비되지 않았습니다.",
        )

    today = date.today()
    period_start = today - timedelta(days=7)
    logs = list(
        await DailyHealthLog.filter(
            user_id=user.id,
            log_date__gte=period_start,
            log_date__lte=today,
        ).order_by("log_date")
    )

    coaching = ReportCoachingService()
    result = await coaching.get_or_generate(
        user_id=user.id, profile=profile, logs=logs, detail=detail,
    )
    return Response(
        content=result,
        status_code=status.HTTP_200_OK,
    )


@risk_router.get("/latest", status_code=status.HTTP_200_OK)
async def get_latest_risk(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[RiskAnalysisService, Depends(RiskAnalysisService)],
) -> Response:
    """최신 위험도 조회."""
    result = await service.get_latest_risk(user_id=user.id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="위험도 평가 기록이 없습니다.",
        )
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@risk_router.get("/history", status_code=status.HTTP_200_OK)
async def get_risk_history(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[RiskAnalysisService, Depends(RiskAnalysisService)],
    weeks: int = 12,
) -> Response:
    """최근 주간 위험도 이력 조회."""
    result = await service.get_risk_history(user_id=user.id, weeks=weeks)
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@risk_router.post("/recalculate", status_code=status.HTTP_200_OK)
async def recalculate_risk(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[RiskAnalysisService, Depends(RiskAnalysisService)],
) -> Response:
    """위험도 수동 재계산 (관리자/디버그 용도).

    일반 리포트 페이지는 ``GET /risk/current``(캐시 우선)를 사용해야 한다.
    이 엔드포인트는 OpenAI 동기 호출을 포함해 2~5초 소요될 수 있다.
    """
    result = await service.recalculate_risk(user_id=user.id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="건강 프로필이 없습니다. 먼저 온보딩을 완료해주세요.",
        )
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )
