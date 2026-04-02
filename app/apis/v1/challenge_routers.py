from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_token_payload
from app.domains.challenges.enums import (
    ChallengeCategory,
    ChallengeSelectionSource,
    ChallengeStatus,
    CheckinJudgeType,
)
from app.domains.challenges.schemas import (
    ActiveChallengeItem,
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
                target_days=14,
                days_completed=8,
                today_checked=False,
                selection_source=ChallengeSelectionSource.SYSTEM_RECOMMENDED,
            )
        ],
        completed=[],
        recommended=[
            RecommendedChallengeItem(
                template_id=5,
                code="sleep_after_11",
                name="11시 이후 야식 금지",
                emoji="🌙",
                category=ChallengeCategory.SLEEP,
                default_duration_days=14,
                description="늦은 야식 습관을 줄이기 위한 기본 챌린지입니다.",
                evidence_summary="sleep hygiene guideline",
                for_groups=[UserGroup.A, UserGroup.B, UserGroup.C],
            )
        ],
        stats=ChallengeStats(active_count=1, completed_count=0),
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
        status=ChallengeStatus.ACTIVE,
        selection_source=ChallengeSelectionSource.USER_SELECTED,
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
