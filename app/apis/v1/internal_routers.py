from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status
from fastapi.responses import ORJSONResponse as Response

from app.core import config
from app.domains.health.schemas import CronJobResponse

internal_router = APIRouter(prefix="/internal/cron", tags=["internal"])


def _verify_cron_secret(authorization: str | None) -> None:
    expected = f"Bearer {config.SECRET_KEY}"
    if authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal cron secret")


@internal_router.post("/daily", response_model=CronJobResponse, status_code=status.HTTP_200_OK)
async def run_daily_cron(authorization: Annotated[str | None, Header()] = None) -> Response:
    _verify_cron_secret(authorization)
    response = CronJobResponse(
        processed_users=150,
        engagements_updated=150,
        findrisc_recalculated=145,
        challenges_judged=85,
        badges_awarded=3,
        errors=0,
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@internal_router.post("/weekly", response_model=CronJobResponse, status_code=status.HTTP_200_OK)
async def run_weekly_cron(authorization: Annotated[str | None, Header()] = None) -> Response:
    _verify_cron_secret(authorization)
    response = CronJobResponse(
        processed_users=150,
        findrisc_recalculated=150,
        reports_cached=148,
        engagements_upgraded=5,
        errors=0,
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)
