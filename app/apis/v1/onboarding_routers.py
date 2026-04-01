from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_token_payload, get_request_user
from app.domains.health.enums import EngagementState, RiskLevel
from app.domains.health.schemas import (
    OnboardingStatusResponse,
    OnboardingSurveyRequest,
    OnboardingSurveyResponse,
)
from app.models.users import User
from app.services.jwt import JwtService

onboarding_router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@onboarding_router.post("/survey", response_model=OnboardingSurveyResponse, status_code=status.HTTP_201_CREATED)
async def complete_onboarding_survey(
    request: OnboardingSurveyRequest,
    user: Annotated[User, Depends(get_request_user)],
    jwt_service: Annotated[JwtService, Depends(JwtService)],
) -> Response:
    access_token = jwt_service.create_access_token(user)
    access_token.payload["user_group"] = request.user_group

    bmi = round(request.weight_kg / ((request.height_cm / 100) ** 2), 1)
    response = OnboardingSurveyResponse(
        health_profile_id=1,
        user_group=request.user_group,
        bmi=bmi,
        initial_findrisc_score=12,
        risk_level=RiskLevel.MODERATE,
        engagement_state=EngagementState.ACTIVE,
        access_token=str(access_token),
        message="온보딩이 완료되었습니다. 당뇨 위험도 점수는 12점(중간 위험)입니다.",
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_201_CREATED)


@onboarding_router.get("/status", response_model=OnboardingStatusResponse, status_code=status.HTTP_200_OK)
async def get_onboarding_status(payload: Annotated[dict, Depends(get_request_token_payload)]) -> Response:
    response = OnboardingStatusResponse(
        is_completed=True,
        completed_at=datetime.fromisoformat("2026-04-01T10:05:00+09:00"),
        user_group=payload.get("user_group"),
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)
