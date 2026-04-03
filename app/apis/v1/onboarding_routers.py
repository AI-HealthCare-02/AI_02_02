"""온보딩 API 엔드포인트.

1. POST /api/v1/onboarding/survey — 건강 설문 제출 + 새 JWT 발급
2. GET /api/v1/onboarding/status — 온보딩 완료 여부 확인
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse as Response

from app.core import config
from app.core.config import Env
from app.dependencies.security import get_request_user
from app.dtos.onboarding import SurveyRequest
from app.models.users import User
from app.services.jwt import JwtService
from app.services.onboarding import OnboardingService

onboarding_router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@onboarding_router.post("/survey", status_code=status.HTTP_201_CREATED)
async def submit_survey(
    request: SurveyRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[OnboardingService, Depends(OnboardingService)],
) -> Response:
    """건강 설문 제출 + BMI·FINDRISC 자동 계산 + 새 JWT 발급."""
    result = await service.submit_survey(user_id=user.id, data=request)

    # user_group 포함 새 JWT 발급
    jwt_service = JwtService()
    tokens = jwt_service.issue_jwt_pair(user, user_group=result.user_group)

    content = result.model_dump(mode="json")
    content["access_token"] = str(tokens["access_token"])

    resp = Response(content=content, status_code=status.HTTP_201_CREATED)
    resp.set_cookie(
        key="refresh_token",
        value=str(tokens["refresh_token"]),
        httponly=True,
        secure=config.ENV == Env.PROD,
        samesite="Lax",
        domain=config.COOKIE_DOMAIN or None,
        expires=tokens["refresh_token"].payload["exp"],
    )
    return resp


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
