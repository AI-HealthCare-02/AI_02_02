"""일일 건강 데이터 서비스 — 직접입력, 미입력 조회, 소급입력.

Dual Channel의 "Direct" 채널 구현.
First Answer Wins: 이미 값이 있는 필드는 건드리지 않는다.
"""

from __future__ import annotations

from datetime import date, timedelta

from fastapi import HTTPException, status

from backend.dtos.health import (
    BatchRequest,
    BatchResponse,
    DailyLogPatchRequest,
    DailyLogPatchResponse,
    DailyLogResponse,
    MissingDateEntry,
    MissingDatesResponse,
)
from backend.models.enums import FIELD_TO_SOURCE, DataSource
from backend.models.health import DailyHealthLog

# 데이터 필드 목록 (18개)
DATA_FIELDS: list[str] = [
    "sleep_quality",
    "sleep_duration_bucket",
    "breakfast_status",
    "lunch_status",
    "dinner_status",
    "vegetable_intake_level",
    "meal_balance_level",
    "sweetdrink_level",
    "exercise_done",
    "exercise_type",
    "exercise_minutes",
    "walk_done",
    "water_cups",
    "nightsnack_level",
    "took_medication",
    "mood_level",
    "alcohol_today",
    "alcohol_amount_level",
]


def _log_to_response(log: DailyHealthLog) -> DailyLogResponse:
    """DailyHealthLog → DailyLogResponse 변환."""
    return DailyLogResponse(
        log_date=log.log_date,
        sleep_quality=log.sleep_quality,
        sleep_duration_bucket=log.sleep_duration_bucket,
        breakfast_status=log.breakfast_status,
        lunch_status=log.lunch_status,
        dinner_status=log.dinner_status,
        vegetable_intake_level=log.vegetable_intake_level,
        meal_balance_level=log.meal_balance_level,
        sweetdrink_level=log.sweetdrink_level,
        exercise_done=log.exercise_done,
        exercise_type=log.exercise_type,
        exercise_minutes=log.exercise_minutes,
        walk_done=log.walk_done,
        water_cups=log.water_cups,
        nightsnack_level=log.nightsnack_level,
        took_medication=log.took_medication,
        mood_level=log.mood_level,
        alcohol_today=log.alcohol_today,
        alcohol_amount_level=log.alcohol_amount_level,
    )


def _empty_log_response(log_date: date) -> DailyLogResponse:
    """빈 일일 기록 응답 생성."""
    return DailyLogResponse(log_date=log_date)


class HealthDailyService:
    """일일 건강 데이터 CRUD."""

    async def get_daily_log(self, user_id: int, log_date: date) -> DailyLogResponse:
        """특정 날짜 건강 기록 조회."""
        log = await DailyHealthLog.get_or_none(user_id=user_id, log_date=log_date)
        if not log:
            return _empty_log_response(log_date)
        return _log_to_response(log)

    MAX_BACKFILL_DAYS = 3

    async def patch_daily_log(self, user_id: int, log_date: date, data: DailyLogPatchRequest) -> DailyLogPatchResponse:
        """직접입력으로 건강 기록 저장 (First Answer Wins)."""
        today = date.today()
        if log_date > today:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="미래 날짜에는 기록할 수 없습니다.",
            )
        if (today - log_date).days > self.MAX_BACKFILL_DAYS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{self.MAX_BACKFILL_DAYS}일 이전의 기록은 수정할 수 없습니다.",
            )

        log, _created = await DailyHealthLog.get_or_create(
            user_id=user_id,
            log_date=log_date,
        )

        # 입력 데이터에서 보내지 않은 필드 제외
        input_data = data.model_dump(exclude_none=True, exclude={"source"})

        # 제약 조건 적용
        if input_data.get("exercise_done") is False:
            input_data.pop("exercise_type", None)
            input_data.pop("exercise_minutes", None)
        if input_data.get("alcohol_today") is False:
            input_data.pop("alcohol_amount_level", None)

        field_results: dict[str, str] = {}
        update_fields: list[str] = []

        for field_name, value in input_data.items():
            if field_name not in DATA_FIELDS:
                continue
            existing = getattr(log, field_name, None)
            if existing is not None:
                # First Answer Wins — 이미 값이 있으면 스킵
                field_results[field_name] = "skipped(already_answered)"
                continue

            setattr(log, field_name, value)
            update_fields.append(field_name)
            field_results[field_name] = "accepted"

            # _source 필드 설정
            source_field = FIELD_TO_SOURCE.get(field_name)
            if source_field:
                setattr(log, source_field, data.source)
                update_fields.append(source_field)

        if update_fields:
            await log.save(update_fields=list(dict.fromkeys(update_fields + ["updated_at"])))

        return DailyLogPatchResponse(
            daily_log=_log_to_response(log),
            field_results=field_results,
            challenge_update=None,  # TODO: 챌린지 자동 체크인 연동
        )

    async def get_missing_dates(self, user_id: int, lookback_days: int = 7) -> MissingDatesResponse:
        """미입력 날짜 목록 조회."""
        today = date.today()
        entries: list[MissingDateEntry] = []

        for i in range(1, lookback_days + 1):
            target_date = today - timedelta(days=i)
            log = await DailyHealthLog.get_or_none(
                user_id=user_id,
                log_date=target_date,
            )

            if not log:
                entries.append(
                    MissingDateEntry(
                        date=target_date,
                        missing_fields=list(DATA_FIELDS),
                        answered_fields=[],
                        completion_rate=0.0,
                    )
                )
                continue

            answered = [f for f in DATA_FIELDS if getattr(log, f, None) is not None]
            missing = [f for f in DATA_FIELDS if getattr(log, f, None) is None]
            rate = round(len(answered) / len(DATA_FIELDS), 2)
            if rate < 1.0:
                entries.append(
                    MissingDateEntry(
                        date=target_date,
                        missing_fields=missing,
                        answered_fields=answered,
                        completion_rate=rate,
                    )
                )

        return MissingDatesResponse(missing_dates=entries)

    async def batch_save(self, user_id: int, data: BatchRequest) -> BatchResponse:
        """소급입력 (여러 날짜 한번에)."""
        results: list[dict] = []

        for entry in data.entries:
            patch_data = DailyLogPatchRequest(
                source=DataSource.BACKFILL,
                **entry.model_dump(exclude={"log_date", "source"}, exclude_none=True),
            )
            result = await self.patch_daily_log(
                user_id=user_id,
                log_date=entry.log_date,
                data=patch_data,
            )
            results.append(
                {
                    "log_date": str(entry.log_date),
                    "field_results": result.field_results,
                }
            )

        saved_count = sum(1 for r in results if any(v == "accepted" for v in r["field_results"].values()))
        return BatchResponse(saved_count=saved_count, results=results)
