from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_token_payload
from app.domains.health.enums import (
    DataSource,
    ExerciseType,
    MealBalanceLevel,
    MealStatus,
    MeasurementType,
    MoodLevel,
    NightsnackLevel,
    SleepDurationBucket,
    SleepQuality,
    SweetdrinkLevel,
    UserGroup,
    VegetableIntakeLevel,
)
from app.domains.health.schemas import (
    DailyBatchRequest,
    DailyBatchResponse,
    DailyBatchResult,
    DailyHealthLogPatchRequest,
    DailyLogItem,
    DailyLogPatchResponse,
    MeasurementCreateRequest,
    MeasurementItem,
    MeasurementListResponse,
    MissingDailyLogItem,
    MissingDailyLogResponse,
)

health_router = APIRouter(prefix="/health", tags=["health"])


def _sample_daily_log(log_date: date, user_group: UserGroup) -> DailyLogItem:
    return DailyLogItem(
        log_date=log_date,
        sleep_quality=SleepQuality.GOOD,
        sleep_duration_bucket=SleepDurationBucket.BETWEEN_7_8,
        breakfast_status=MealStatus.HEARTY,
        lunch_status=None,
        dinner_status=None,
        vegetable_intake_level=VegetableIntakeLevel.ENOUGH,
        meal_balance_level=MealBalanceLevel.BALANCED,
        sweetdrink_level=SweetdrinkLevel.NONE,
        exercise_done=True,
        exercise_type=ExerciseType.WALKING,
        exercise_minutes=30,
        walk_done=True,
        water_cups=5,
        nightsnack_level=NightsnackLevel.NONE,
        took_medication=True if user_group == UserGroup.A else None,
        mood_level=MoodLevel.NORMAL,
        alcohol_today=False,
        alcohol_amount_level=None,
        completion_rate=0.55,
    )


@health_router.get("/daily/{log_date}", response_model=DailyLogItem, status_code=status.HTTP_200_OK)
async def get_daily_log(
    log_date: date,
    payload: Annotated[dict, Depends(get_request_token_payload)],
) -> Response:
    user_group = UserGroup(payload.get("user_group", UserGroup.B))
    response = _sample_daily_log(log_date=log_date, user_group=user_group)
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@health_router.patch("/daily/{log_date}", response_model=DailyLogPatchResponse, status_code=status.HTTP_200_OK)
async def patch_daily_log(
    log_date: date,
    request: DailyHealthLogPatchRequest,
    payload: Annotated[dict, Depends(get_request_token_payload)],
) -> Response:
    user_group = UserGroup(payload.get("user_group", UserGroup.B))
    changed_fields = {
        key: "accepted"
        for key, value in request.model_dump(mode="python").items()
        if key != "source" and value is not None
    }
    response = DailyLogPatchResponse(
        daily_log=_sample_daily_log(log_date=log_date, user_group=user_group),
        field_results=changed_fields,
        challenge_update=None,
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@health_router.get("/daily/missing", response_model=MissingDailyLogResponse, status_code=status.HTTP_200_OK)
async def get_missing_daily_logs(
    days: int = Query(default=3, ge=1, le=3),
    _: Annotated[dict, Depends(get_request_token_payload)] = None,
) -> Response:
    today = date.fromisoformat("2026-04-01")
    response = MissingDailyLogResponse(
        missing_dates=[
            MissingDailyLogItem(
                date=date.fromordinal(today.toordinal() - offset),
                missing_fields=[
                    "lunch_status",
                    "dinner_status",
                    "exercise_done",
                    "vegetable_intake_level",
                ],
                answered_fields=["sleep_quality", "breakfast_status"],
                completion_rate=0.29,
            )
            for offset in range(1, min(days, 2) + 1)
        ],
        max_display=4,
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@health_router.post("/daily/batch", response_model=DailyBatchResponse, status_code=status.HTTP_200_OK)
async def batch_patch_daily_logs(
    request: DailyBatchRequest,
    _: Annotated[dict, Depends(get_request_token_payload)],
) -> Response:
    response = DailyBatchResponse(
        results=[
            DailyBatchResult(
                date=entry.date,
                field_results={
                    key: "accepted"
                    for key, value in entry.model_dump(mode="python").items()
                    if key not in {"date", "source"} and value is not None
                },
            )
            for entry in request.entries
        ]
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@health_router.post("/measurements", response_model=MeasurementItem, status_code=status.HTTP_201_CREATED)
async def create_measurement(
    request: MeasurementCreateRequest,
    _: Annotated[dict, Depends(get_request_token_payload)],
) -> Response:
    response = MeasurementItem(
        measurement_id=42,
        measurement_type=request.measurement_type,
        value=request.value,
        systolic=request.systolic,
        diastolic=request.diastolic,
        unit=request.unit,
        measured_at=request.measured_at,
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_201_CREATED)


@health_router.get("/measurements", response_model=MeasurementListResponse, status_code=status.HTTP_200_OK)
async def get_measurements(
    type: MeasurementType | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    _: Annotated[dict, Depends(get_request_token_payload)] = None,
) -> Response:
    _ = (from_date, to_date)
    measurement_type = type or MeasurementType.WEIGHT
    measured_at = datetime.fromisoformat("2026-04-01T08:00:00+09:00")
    if measurement_type == MeasurementType.BLOOD_PRESSURE:
        items = [
            MeasurementItem(
                measurement_id=43,
                measurement_type=measurement_type,
                systolic=128,
                diastolic=82,
                unit="mmHg",
                measured_at=measured_at,
            )
        ]
    else:
        items = [
            MeasurementItem(
                measurement_id=42,
                measurement_type=measurement_type,
                value=79.5,
                unit="kg" if measurement_type == MeasurementType.WEIGHT else "cm",
                measured_at=measured_at,
            )
        ]

    response = MeasurementListResponse(measurements=items[:limit], total_count=len(items))
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)
