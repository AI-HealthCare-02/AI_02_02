"""대시보드 API 라우터."""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse as Response

from app.dependencies.security import get_request_user
from app.models.users import User
from app.services.dashboard import DashboardService

dashboard_router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@dashboard_router.get("/init", status_code=status.HTTP_200_OK)
async def dashboard_init(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[DashboardService, Depends(DashboardService)],
) -> Response:
    """앱 첫 화면에 필요한 정보를 한 번에 내려줍니다."""
    result = await service.get_init(user_id=user.id)
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )
