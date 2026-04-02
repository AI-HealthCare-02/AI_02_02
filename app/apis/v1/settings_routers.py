from datetime import datetime, time
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_token_payload
from app.domains.health.schemas import DataExportRequest, SettingsPatchRequest, SettingsResponse

settings_router = APIRouter(prefix="/settings", tags=["settings"])


def _settings_response() -> SettingsResponse:
    return SettingsResponse(
        nickname="건강한 하루",
        morning_reminder=True,
        evening_reminder=True,
        challenge_reminder=True,
        weekly_report=True,
        reminder_time_morning=time.fromisoformat("08:00:00"),
        reminder_time_evening=time.fromisoformat("19:00:00"),
        max_bundles_per_day=5,
        preferred_times=["morning", "evening"],
        last_export_at=None,
    )


@settings_router.get("", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
async def get_settings(_: Annotated[dict, Depends(get_request_token_payload)]) -> Response:
    response = _settings_response()
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@settings_router.patch("", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
async def patch_settings(
    request: SettingsPatchRequest,
    _: Annotated[dict, Depends(get_request_token_payload)],
) -> Response:
    base = _settings_response().model_dump(mode="python")
    base.update({key: value for key, value in request.model_dump(mode="python").items() if value is not None})
    response = SettingsResponse(**base)
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@settings_router.post("/export", status_code=status.HTTP_200_OK)
async def export_data(
    request: DataExportRequest,
    _: Annotated[dict, Depends(get_request_token_payload)],
) -> Response:
    return Response(
        {
            "format": request.format,
            "from_date": request.from_date.isoformat(),
            "to_date": request.to_date.isoformat(),
            "generated_at": datetime.fromisoformat("2026-04-01T12:00:00+09:00").isoformat(),
        },
        status_code=status.HTTP_200_OK,
    )
