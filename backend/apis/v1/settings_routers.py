from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse as Response
from fastapi.responses import StreamingResponse

from backend.dependencies.security import get_request_user
from backend.dtos.settings import SettingsPatchRequest, SettingsResponse
from backend.models.users import User
from backend.services.settings import SettingsService

settings_router = APIRouter(prefix="/settings", tags=["settings"])


@settings_router.get("", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
async def get_settings(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[SettingsService, Depends(SettingsService)],
) -> Response:
    result = await service.get_settings(user_id=user.id)
    return Response(
        content=SettingsResponse.model_validate(result).model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@settings_router.patch("", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
async def patch_settings(
    request: SettingsPatchRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[SettingsService, Depends(SettingsService)],
) -> Response:
    result = await service.update_settings(user_id=user.id, data=request)
    return Response(
        content=SettingsResponse.model_validate(result).model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@settings_router.post("/export", status_code=status.HTTP_200_OK)
async def export_settings(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[SettingsService, Depends(SettingsService)],
) -> StreamingResponse:
    csv_text, filename, exported_at = await service.export_user_data_csv(user_id=user.id)
    return StreamingResponse(
        iter([csv_text.encode("utf-8-sig")]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Exported-At": exported_at.isoformat(),
        },
    )
