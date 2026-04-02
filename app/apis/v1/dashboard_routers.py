from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_token_payload
from app.domains.health.enums import (
    EngagementState,
    ExerciseType,
    MealBalanceLevel,
    MealStatus,
    MoodLevel,
    RiskLevel,
    SleepDurationBucket,
    SleepQuality,
    SweetdrinkLevel,
    UserGroup,
    VegetableIntakeLevel,
)
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
            sleep_quality=SleepQuality.GOOD,
            sleep_duration_bucket=SleepDurationBucket.BETWEEN_7_8,
            breakfast_status=MealStatus.HEARTY,
            lunch_status=None,
            dinner_status=None,
            vegetable_intake_level=VegetableIntakeLevel.ENOUGH,
            meal_balance_level=MealBalanceLevel.BALANCED,
            sweetdrink_level=SweetdrinkLevel.NONE,
            exercise_done=True,
            exercise_type=ExerciseType.WALKING,
            exercise_minutes=30,
            walk_done=True,
            water_cups=5,
            nightsnack_level=None,
            took_medication=True if user_group == UserGroup.A else None,
            mood_level=MoodLevel.NORMAL,
            alcohol_today=False,
            alcohol_amount_level=None,
        ),
        risk=RiskLatestResponse(
            findrisc_score=12,
            risk_level=RiskLevel.MODERATE,
            sleep_score=78,
            diet_score=65,
            exercise_score=82,
            lifestyle_score=70,
            top_positive_factors=["good_sleep", "regular_walk"],
            top_risk_factors=["carb_heavy_meals"],
            assessed_at=datetime.fromisoformat("2026-03-31T00:00:00+09:00"),
        ),
        challenge_summary=[
            ChallengeSummaryItem(
                user_challenge_id=1,
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
