from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_token_payload
from app.domains.challenges.enums import ChallengeCategory, ChallengeStatus, CheckinJudgeType
from app.domains.challenges.schemas import (
    ActiveChallengeItem,
    BadgeItem,
    ChallengeCalendarItem,
    ChallengeCalendarResponse,
    ChallengeCheckinRequest,
    ChallengeCheckinResponse,
    ChallengeOverviewResponse,
    ChallengeStats,
    CompletedChallengeItem,
    JoinChallengeResponse,
    RecommendedChallengeItem,
)
from app.domains.health.enums import UserGroup

challenge_router = APIRouter(prefix="/challenges", tags=["challenges"])


@challenge_router.get("/overview", response_model=ChallengeOverviewResponse, status_code=status.HTTP_200_OK)
async def get_challenge_overview(_: Annotated[dict, Depends(get_request_token_payload)]) -> Response:
    response = ChallengeOverviewResponse(
        active=[
            ActiveChallengeItem(
                user_challenge_id=1,
                template_id=3,
                name="주 150분 운동",
                emoji="🏃",
                category=ChallengeCategory.EXERCISE,
                status=ChallengeStatus.ACTIVE,
                current_streak=5,
                best_streak=7,
                progress_pct=0.67,
                started_at=date.fromisoformat("2026-03-25"),
                target_days=30,
                days_completed=20,
                today_checked=False,
            )
        ],
        completed=[
            CompletedChallengeItem(
                user_challenge_id=2,
                name="매일 채소 먹기",
                emoji="🥬",
                completed_at=date.fromisoformat("2026-03-20"),
                final_streak=14,
                target_days=14,
            )
        ],
        recommended=[
            RecommendedChallengeItem(
                template_id=5,
                name="11시 전 취침",
                emoji="😴",
                category=ChallengeCategory.SLEEP,
                duration_days=14,
                description="수면은 혈당 관리에 중요합니다.",
                evidence="Cappuccio 2010",
                for_groups=[UserGroup.A, UserGroup.B, UserGroup.C],
            )
        ],
        stats=ChallengeStats(total_streak=5, total_points=350, completed_count=3, level=2),
        badges=[
            BadgeItem(
                id="first_log",
                label="첫 건강 기록",
                emoji="📝",
                earned=True,
                earned_at=datetime.fromisoformat("2026-03-15T00:00:00+09:00"),
            ),
            BadgeItem(id="month_streak", label="30일 연속", emoji="💎", earned=False, earned_at=None),
        ],
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@challenge_router.post("/{template_id}/join", response_model=JoinChallengeResponse, status_code=status.HTTP_201_CREATED)
async def join_challenge(
    template_id: int,
    _: Annotated[dict, Depends(get_request_token_payload)],
) -> Response:
    response = JoinChallengeResponse(
        user_challenge_id=3,
        template_id=template_id,
        name="11시 전 취침",
        status=ChallengeStatus.ACTIVE,
        started_at=date.fromisoformat("2026-04-01"),
        target_days=14,
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_201_CREATED)


@challenge_router.post(
    "/{user_challenge_id}/checkin",
    response_model=ChallengeCheckinResponse,
    status_code=status.HTTP_201_CREATED,
)
async def checkin_challenge(
    user_challenge_id: int,
    request: ChallengeCheckinRequest,
    _: Annotated[dict, Depends(get_request_token_payload)],
) -> Response:
    response = ChallengeCheckinResponse(
        checkin_id=42,
        checkin_date=date.fromisoformat("2026-04-01"),
        status=request.status,
        judged_by=CheckinJudgeType.MANUAL,
        current_streak=6,
        progress_pct=0.70,
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_201_CREATED)


@challenge_router.get(
    "/{user_challenge_id}/calendar",
    response_model=ChallengeCalendarResponse,
    status_code=status.HTTP_200_OK,
)
async def get_challenge_calendar(
    user_challenge_id: int,
    _: Annotated[dict, Depends(get_request_token_payload)],
) -> Response:
    response = ChallengeCalendarResponse(
        user_challenge_id=user_challenge_id,
        name="주 150분 운동",
        calendar=[
            ChallengeCalendarItem(
                date=date.fromisoformat("2026-03-25"),
                status="achieved",
                judged_by=CheckinJudgeType.AUTO,
            ),
            ChallengeCalendarItem(
                date=date.fromisoformat("2026-04-01"),
                status=None,
                judged_by=None,
            ),
        ],
        current_streak=1,
        best_streak=4,
        progress_pct=0.70,
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)
