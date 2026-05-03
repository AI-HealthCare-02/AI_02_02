"""External CLI check-in API for Claude Code and Codex CLI."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, status
from fastapi.responses import JSONResponse as Response

from backend.dependencies.external_checkin import require_external_scope
from backend.dependencies.security import get_request_user
from backend.dtos.external_checkin import (
    CheckinAnswerRequest,
    DeviceApproveRequest,
    DeviceStartRequest,
    DeviceTokenRequest,
    ExternalSettingsPatchRequest,
)
from backend.models.external_checkin import ExternalClientToken
from backend.models.users import User
from backend.services.external_checkin import ExternalCheckinService

external_auth_router = APIRouter(prefix="/external-auth", tags=["external-checkin"])
external_router = APIRouter(prefix="/external", tags=["external-checkin"])


@external_auth_router.post("/device/start", status_code=status.HTTP_200_OK)
async def start_device_flow(
    body: DeviceStartRequest,
    service: Annotated[ExternalCheckinService, Depends(ExternalCheckinService)],
) -> Response:
    result = await service.start_device_flow(body)
    return Response(content=result.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@external_auth_router.post("/device/approve", status_code=status.HTTP_200_OK)
async def approve_device_flow(
    body: DeviceApproveRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[ExternalCheckinService, Depends(ExternalCheckinService)],
) -> Response:
    result = await service.approve_device_flow(user_id=user.id, user_code=body.user_code)
    return Response(content=result.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@external_auth_router.post("/device/token", status_code=status.HTTP_200_OK)
async def exchange_device_token(
    body: DeviceTokenRequest,
    service: Annotated[ExternalCheckinService, Depends(ExternalCheckinService)],
) -> Response:
    result = await service.exchange_device_token(device_code=body.device_code)
    return Response(content=result.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@external_router.get("/checkins/next", status_code=status.HTTP_200_OK)
async def get_next_checkin(
    token: Annotated[ExternalClientToken, Depends(require_external_scope("checkin:read"))],
    service: Annotated[ExternalCheckinService, Depends(ExternalCheckinService)],
) -> Response:
    result = await service.get_next_checkin(token=token)
    return Response(content=result.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@external_router.post("/checkins/answer", status_code=status.HTTP_200_OK)
async def answer_checkin(
    body: CheckinAnswerRequest,
    token: Annotated[ExternalClientToken, Depends(require_external_scope("checkin:write"))],
    service: Annotated[ExternalCheckinService, Depends(ExternalCheckinService)],
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key")] = "",
) -> Response:
    result = await service.answer_checkin(
        token=token,
        data=body,
        idempotency_key=idempotency_key,
    )
    return Response(content=result.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@external_router.get("/settings", status_code=status.HTTP_200_OK)
async def get_external_settings(
    token: Annotated[ExternalClientToken, Depends(require_external_scope("settings:read"))],
    service: Annotated[ExternalCheckinService, Depends(ExternalCheckinService)],
) -> Response:
    result = await service.get_settings(token=token)
    return Response(content=result.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@external_router.patch("/settings", status_code=status.HTTP_200_OK)
async def patch_external_settings(
    body: ExternalSettingsPatchRequest,
    token: Annotated[ExternalClientToken, Depends(require_external_scope("settings:write"))],
    service: Annotated[ExternalCheckinService, Depends(ExternalCheckinService)],
) -> Response:
    result = await service.patch_settings(token=token, data=body)
    return Response(content=result.model_dump(mode="json"), status_code=status.HTTP_200_OK)
