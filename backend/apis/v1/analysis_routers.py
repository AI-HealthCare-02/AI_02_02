"""분석 API 라우터."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse as Response

from backend.dependencies.security import get_request_user
from backend.models.users import User
from backend.services.risk_analysis import RiskAnalysisService

analysis_router = APIRouter(prefix="/analysis", tags=["analysis"])


@analysis_router.get("/summary", status_code=status.HTTP_200_OK)
async def get_analysis_summary(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[RiskAnalysisService, Depends(RiskAnalysisService)],
    period: Annotated[int, Query(description="분석 기간(일)", ge=7, le=90)] = 7,
) -> Response:
    """기간별 분석 요약."""
    result = await service.get_analysis_summary(
        user_id=user.id, period=period,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="분석할 데이터가 없습니다.",
        )
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )
