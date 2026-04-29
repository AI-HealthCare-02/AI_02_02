from __future__ import annotations

from pydantic import BaseModel, Field


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=1)
    auth: str = Field(min_length=1)


class PushSubscriptionRequest(BaseModel):
    endpoint: str = Field(min_length=1)
    keys: PushKeys


class PushSubscriptionResponse(BaseModel):
    enabled: bool = True


class PushSubscriptionStatusResponse(BaseModel):
    supported: bool = True
    configured: bool = True
    subscribed: bool = False


class PushPreferenceRequest(BaseModel):
    action: str = Field(pattern="^(mute_today|disable|enable)$")


class PushActionRequest(BaseModel):
    token: str = Field(min_length=16)
    action: str = Field(pattern="^(mute_today|disable)$")
