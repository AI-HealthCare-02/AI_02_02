from datetime import date, datetime, time
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_token_payload
from app.domains.health.enums import UserGroup
from app.domains.health.schemas import (
    DataExportRequest,
    SettingsAiFrequency,
    SettingsAiFrequencyPatch,
    SettingsDataSummary,
    SettingsNotifications,
    SettingsNotificationsPatch,
    SettingsProfile,
    SettingsResponse,
)

settings_router = APIRouter(prefix="/settings", tags=["settings"])


def _settings_response() -> SettingsResponse:
    return SettingsResponse(
        profile=SettingsProfile(
            email="user@example.com",
            nickname="건강이",
            user_group=UserGroup.B,
            created_at=date.fromisoformat("2026-03-15"),
        ),
        notifications=SettingsNotifications(
            morning_reminder=True,
            evening_reminder=True,
            challenge_reminder=True,
            weekly_report=True,
            reminder_time_morning=time.fromisoformat("08:00:00"),
            reminder_time_evening=time.fromisoformat("19:00:00"),
        ),
        ai_frequency=SettingsAiFrequency(max_bundles_per_day=5, preferred_times=["morning", "lunch", "evening"]),
        data=SettingsDataSummary(
            total_logs=17,
            first_log_date=date.fromisoformat("2026-03-15"),
            last_export_at=None,
        ),
    )


@settings_router.get("", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
async def get_settings(_: Annotated[dict, Depends(get_request_token_payload)]) -> Response:
    response = _settings_response()
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@settings_router.patch("/notifications", response_model=SettingsNotifications, status_code=status.HTTP_200_OK)
async def patch_notifications(
    request: SettingsNotificationsPatch,
    _: Annotated[dict, Depends(get_request_token_payload)],
) -> Response:
    base = _settings_response().notifications.model_dump(mode="python")
    base.update({key: value for key, value in request.model_dump(mode="python").items() if value is not None})
    response = SettingsNotifications(**base)
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@settings_router.patch("/ai-frequency", response_model=SettingsAiFrequency, status_code=status.HTTP_200_OK)
async def patch_ai_frequency(
    request: SettingsAiFrequencyPatch,
    _: Annotated[dict, Depends(get_request_token_payload)],
) -> Response:
    base = _settings_response().ai_frequency.model_dump(mode="python")
    base.update({key: value for key, value in request.model_dump(mode="python").items() if value is not None})
    response = SettingsAiFrequency(**base)
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
