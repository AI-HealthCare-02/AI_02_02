"""위험도 API 라우터."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse as Response

from backend.dependencies.security import get_request_user
from backend.models.users import User
from backend.services.risk_analysis import RiskAnalysisService

risk_router = APIRouter(prefix="/risk", tags=["risk"])


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
    """위험도 수동 재계산."""
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
