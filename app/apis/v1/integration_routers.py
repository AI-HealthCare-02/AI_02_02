from datetime import datetime

from fastapi import APIRouter, Path, status
from fastapi.responses import ORJSONResponse as Response
from pydantic import BaseModel


class IntegrationStatusResponse(BaseModel):
    provider: str
    transport: str
    status: str
    generated_at: datetime


integration_router = APIRouter(prefix="/integrations", tags=["integrations"])


@integration_router.get("/mcp/status", response_model=IntegrationStatusResponse, status_code=status.HTTP_200_OK)
async def get_mcp_status() -> Response:
    response = IntegrationStatusResponse(
        provider="mcp",
        transport="http",
        status="ready_for_adapter",
        generated_at=datetime.fromisoformat("2026-04-01T12:00:00+09:00"),
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@integration_router.post(
    "/webhooks/{provider}",
    response_model=IntegrationStatusResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def receive_provider_webhook(
    provider: str = Path(description="External chatbot or automation provider name"),
) -> Response:
    response = IntegrationStatusResponse(
        provider=provider,
        transport="webhook",
        status="accepted",
        generated_at=datetime.fromisoformat("2026-04-01T12:00:00+09:00"),
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_202_ACCEPTED)
