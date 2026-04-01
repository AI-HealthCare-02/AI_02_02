from datetime import datetime

from fastapi import APIRouter, status
from fastapi.responses import ORJSONResponse as Response
from pydantic import BaseModel


class PlatformCapabilitiesResponse(BaseModel):
    service: str
    api_version: str
    channels: list[str]
    auth_methods: list[str]
    integrations: list[str]
    generated_at: datetime


platform_router = APIRouter(prefix="/platform", tags=["platform"])


@platform_router.get("/capabilities", response_model=PlatformCapabilitiesResponse, status_code=status.HTTP_200_OK)
async def get_platform_capabilities() -> Response:
    response = PlatformCapabilitiesResponse(
        service="danaa-backend",
        api_version="v1",
        channels=["web", "android", "ios"],
        auth_methods=["jwt", "api_key"],
        integrations=["mcp", "chatbot_webhook"],
        generated_at=datetime.fromisoformat("2026-04-01T12:00:00+09:00"),
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)
