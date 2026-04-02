"""건강 데이터 API 라우터."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse as Response

from app.dependencies.security import get_request_user
from app.dtos.health import (
    BatchRequest,
    DailyLogPatchRequest,
    MeasurementCreateRequest,
)
from app.models.users import User
from app.services.health_daily import HealthDailyService
from app.services.measurement import MeasurementService

health_router = APIRouter(prefix="/health", tags=["health"])


# ── 일일 건강 기록 ──
# NOTE: /daily/missing은 /daily/{log_date}보다 먼저 등록해야 함
#       (FastAPI는 라우트를 순서대로 매칭하므로 "missing"이 date로 파싱 시도됨)


@health_router.get("/daily/missing", status_code=status.HTTP_200_OK)
async def get_missing_dates(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[HealthDailyService, Depends(HealthDailyService)],
    lookback_days: Annotated[int, Query(ge=1, le=30)] = 7,
) -> Response:
    """미입력 날짜 목록 조회."""
    result = await service.get_missing_dates(
        user_id=user.id, lookback_days=lookback_days,
    )
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@health_router.get("/daily/{log_date}", status_code=status.HTTP_200_OK)
async def get_daily_log(
    log_date: date,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[HealthDailyService, Depends(HealthDailyService)],
) -> Response:
    """특정 날짜 건강 기록 조회."""
    result = await service.get_daily_log(user_id=user.id, log_date=log_date)
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@health_router.patch("/daily/{log_date}", status_code=status.HTTP_200_OK)
async def patch_daily_log(
    log_date: date,
    request: DailyLogPatchRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[HealthDailyService, Depends(HealthDailyService)],
) -> Response:
    """특정 날짜 건강 기록 저장/수정 (직접입력)."""
    result = await service.patch_daily_log(
        user_id=user.id, log_date=log_date, data=request,
    )
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@health_router.post("/daily/batch", status_code=status.HTTP_200_OK)
async def batch_save(
    request: BatchRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[HealthDailyService, Depends(HealthDailyService)],
) -> Response:
    """소급입력 (여러 날짜 한번에)."""
    result = await service.batch_save(user_id=user.id, data=request)
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


# ── 주기적 측정값 ──


@health_router.post("/measurements", status_code=status.HTTP_201_CREATED)
async def create_measurement(
    request: MeasurementCreateRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[MeasurementService, Depends(MeasurementService)],
) -> Response:
    """주기적 측정값 저장."""
    result = await service.create(user_id=user.id, data=request)
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_201_CREATED,
    )


@health_router.get("/measurements", status_code=status.HTTP_200_OK)
async def list_measurements(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[MeasurementService, Depends(MeasurementService)],
    measurement_type: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Response:
    """주기적 측정값 목록 조회."""
    result = await service.list_measurements(
        user_id=user.id, measurement_type=measurement_type, limit=limit,
    )
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )
