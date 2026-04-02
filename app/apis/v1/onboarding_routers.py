from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_token_payload, get_request_user
from app.domains.health.schemas import (
    OnboardingStatusResponse,
    OnboardingSurveyRequest,
    OnboardingSurveyResponse,
)
from app.domains.onboarding.service import OnboardingService
from app.models.users import User
from app.services.jwt import JwtService

onboarding_router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@onboarding_router.post("/survey", response_model=OnboardingSurveyResponse, status_code=status.HTTP_201_CREATED)
async def complete_onboarding_survey(
    request: OnboardingSurveyRequest,
    user: Annotated[User, Depends(get_request_user)],
    jwt_service: Annotated[JwtService, Depends(JwtService)],
) -> Response:
    service = OnboardingService()
    response = await service.complete_survey(user=user, request=request, jwt_service=jwt_service)
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_201_CREATED)


@onboarding_router.get("/status", response_model=OnboardingStatusResponse, status_code=status.HTTP_200_OK)
async def get_onboarding_status(payload: Annotated[dict, Depends(get_request_token_payload)]) -> Response:
    service = OnboardingService()
    response = await service.get_status(
        user_id=int(payload.get("id", 0) or 0),
        user_group=payload.get("user_group"),
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)
