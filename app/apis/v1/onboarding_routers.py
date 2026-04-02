"""온보딩 API 엔드포인트.

1. POST /api/v1/onboarding/survey — 건강 설문 제출
2. GET /api/v1/onboarding/status — 온보딩 완료 여부 확인
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse as Response

from app.dependencies.security import get_request_user
from app.dtos.onboarding import SurveyRequest
from app.models.users import User
from app.services.onboarding import OnboardingService

onboarding_router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@onboarding_router.post("/survey", status_code=status.HTTP_201_CREATED)
async def submit_survey(
    request: SurveyRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[OnboardingService, Depends(OnboardingService)],
) -> Response:
    """건강 설문 제출 + BMI·FINDRISC 자동 계산."""
    result = await service.submit_survey(user_id=user.id, data=request)
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_201_CREATED,
    )


@onboarding_router.get("/status")
async def get_status(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[OnboardingService, Depends(OnboardingService)],
) -> Response:
    """온보딩 완료 여부 확인."""
    result = await service.get_status(user_id=user.id)
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )
