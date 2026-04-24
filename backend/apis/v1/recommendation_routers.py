from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import ORJSONResponse as Response

from backend.dependencies.security import get_request_user
from backend.dtos.video_recommendations import VideoRecommendationsResponse
from backend.models.users import User
from backend.services.video_recommendations import VideoRecommendationService

recommendation_router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@recommendation_router.get(
    "/videos",
    response_model=VideoRecommendationsResponse,
    status_code=status.HTTP_200_OK,
)
async def get_video_recommendations(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[VideoRecommendationService, Depends(VideoRecommendationService)],
    refresh: bool = Query(False),
) -> Response:
    result = await service.get_recommendations(
        user_id=user.id,
        user_name=user.name,
        refresh=refresh,
    )
    return Response(result.model_dump(mode="json"), status_code=status.HTTP_200_OK)
