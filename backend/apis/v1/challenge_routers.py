"""챌린지 API 라우터."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse as Response

from backend.dependencies.security import get_request_user
from backend.dtos.challenges import ChallengeCheckinRequest
from backend.models.users import User
from backend.services.challenge import ChallengeService

challenge_router = APIRouter(prefix="/challenges", tags=["challenges"])


@challenge_router.get("/overview", status_code=status.HTTP_200_OK)
async def get_overview(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ChallengeService, Depends(ChallengeService)],
) -> Response:
    """챌린지 전체 조회 (활성 + 완료 + 추천)."""
    result = await service.get_overview(user_id=user.id)
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@challenge_router.post("/{template_id}/join", status_code=status.HTTP_201_CREATED)
async def join_challenge(
    template_id: int,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ChallengeService, Depends(ChallengeService)],
) -> Response:
    """챌린지 참여."""
    result = await service.join_challenge(user_id=user.id, template_id=template_id)
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_201_CREATED,
    )


@challenge_router.post("/{user_challenge_id}/checkin", status_code=status.HTTP_200_OK)
async def checkin(
    user_challenge_id: int,
    request: ChallengeCheckinRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ChallengeService, Depends(ChallengeService)],
) -> Response:
    """일일 체크인."""
    result = await service.checkin(
        user_id=user.id,
        user_challenge_id=user_challenge_id,
        data=request,
    )
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@challenge_router.post("/{user_challenge_id}/cancel", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_challenge(
    user_challenge_id: int,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ChallengeService, Depends(ChallengeService)],
) -> Response:
    """Cancel an active challenge and allow the user to start over later."""
    await service.cancel_challenge(user_id=user.id, user_challenge_id=user_challenge_id)
    return Response(content=None, status_code=status.HTTP_204_NO_CONTENT)


@challenge_router.get("/{user_challenge_id}/calendar", status_code=status.HTTP_200_OK)
async def get_calendar(
    user_challenge_id: int,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ChallengeService, Depends(ChallengeService)],
) -> Response:
    """챌린지 달력 조회."""
    result = await service.get_calendar(
        user_id=user.id, user_challenge_id=user_challenge_id,
    )
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )
