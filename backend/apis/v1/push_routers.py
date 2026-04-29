from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from backend.dependencies.security import get_request_user
from backend.dtos.push import (
    PushActionRequest,
    PushPreferenceRequest,
    PushSubscriptionRequest,
    PushSubscriptionResponse,
    PushSubscriptionStatusResponse,
)
from backend.models.users import User
from backend.services.push import PushService, web_push_ready

push_router = APIRouter(prefix="/push", tags=["push"])


@push_router.get("/public-key")
async def get_public_key() -> dict[str, str | bool]:
    from backend.core import config

    return {
        "enabled": web_push_ready(),
        "public_key": config.WEB_PUSH_VAPID_PUBLIC_KEY,
    }


@push_router.get("/subscriptions/status", response_model=PushSubscriptionStatusResponse)
async def get_subscription_status(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[PushService, Depends(PushService)],
) -> PushSubscriptionStatusResponse:
    return PushSubscriptionStatusResponse.model_validate(
        await service.get_subscription_status(user.id),
    )


@push_router.post("/subscriptions", status_code=status.HTTP_201_CREATED)
async def subscribe_push(
    user: Annotated[User, Depends(get_request_user)],
    data: PushSubscriptionRequest,
    service: Annotated[PushService, Depends(PushService)],
) -> PushSubscriptionResponse:
    if not web_push_ready():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Web Push is not configured.")
    await service.upsert_subscription(user.id, data)
    return PushSubscriptionResponse(enabled=True)


@push_router.delete("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe_push(
    user: Annotated[User, Depends(get_request_user)],
    data: PushSubscriptionRequest,
    service: Annotated[PushService, Depends(PushService)],
) -> None:
    await service.deactivate_subscription(user.id, data)


@push_router.post("/preferences", status_code=status.HTTP_204_NO_CONTENT)
async def update_push_preferences(
    user: Annotated[User, Depends(get_request_user)],
    data: PushPreferenceRequest,
    service: Annotated[PushService, Depends(PushService)],
) -> None:
    await service.update_preferences(user.id, data)


@push_router.post("/action", status_code=status.HTTP_204_NO_CONTENT)
async def handle_notification_action(
    data: PushActionRequest,
    service: Annotated[PushService, Depends(PushService)],
) -> None:
    handled = await service.handle_action_token(data)
    if not handled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Push action token not found.")
