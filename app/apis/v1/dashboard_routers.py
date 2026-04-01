from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_token_payload
from app.domains.health.enums import EngagementState, RiskLevel, UserGroup
from app.domains.health.schemas import (
    ChallengeSummaryItem,
    DailyLogItem,
    DashboardInitResponse,
    EngagementSummary,
    RiskLatestResponse,
)

dashboard_router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@dashboard_router.get("/init", response_model=DashboardInitResponse, status_code=status.HTTP_200_OK)
async def get_dashboard_init(payload: Annotated[dict, Depends(get_request_token_payload)]) -> Response:
    user_group = UserGroup(payload.get("user_group", UserGroup.B))
    response = DashboardInitResponse(
        daily_log=DailyLogItem(
            log_date=date.fromisoformat("2026-04-01"),
            sleep="good",
            sleep_hours=7.5,
            breakfast="hearty",
            lunch=None,
            dinner=None,
            veggie=True,
            foodcomp="balanced",
            sweetdrink="none",
            exercise="yes",
            exercise_type="walking",
            exercise_minutes=30,
            walk=True,
            water_cups=5,
            nightsnack=None,
            took_medication=True if user_group == UserGroup.A else None,
            mood=None,
            alcohol_today=None,
            alcohol_amount=None,
            sleep_source="chat",
            breakfast_source="chat",
            lunch_source=None,
            dinner_source=None,
            veggie_source="direct",
            foodcomp_source=None,
            sweetdrink_source=None,
            exercise_source="chat",
            walk_source="direct",
            water_cups_source="direct",
            nightsnack_source=None,
            mood_source=None,
            alcohol_source=None,
            took_medication_source="chat" if user_group == UserGroup.A else None,
            completion_rate=0.55,
        ),
        risk=RiskLatestResponse(
            findrisc_score=12,
            risk_level=RiskLevel.MODERATE,
            sleep_score=78,
            diet_score=65,
            exercise_score=82,
            lifestyle_score=70,
            assessed_at=datetime.fromisoformat("2026-03-31T00:00:00+09:00"),
        ),
        challenge_summary=[
            ChallengeSummaryItem(
                challenge_id=1,
                name="주 150분 운동",
                emoji="🏃",
                current_streak=5,
                progress_pct=0.67,
                status="active",
            )
        ],
        engagement=EngagementSummary(
            state=EngagementState.ACTIVE,
            seven_day_response_rate=0.85,
            cooldown_until=datetime.fromisoformat("2026-04-01T10:30:00+09:00"),
        ),
        user_group=user_group,
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)
