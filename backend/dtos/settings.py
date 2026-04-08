from __future__ import annotations

from datetime import datetime, time

from pydantic import BaseModel, Field, field_validator

from backend.dtos.base import BaseSerializerModel

ALLOWED_PREFERRED_TIMES = {"morning", "lunch", "evening"}


class SettingsResponse(BaseSerializerModel):
    nickname: str | None = None
    chat_notification: bool = True
    morning_reminder: bool = True
    evening_reminder: bool = True
    challenge_reminder: bool = True
    weekly_report: bool = True
    reminder_time_morning: time | None = None
    reminder_time_evening: time | None = None
    max_bundles_per_day: int = 5
    preferred_times: list[str] = Field(default_factory=list)
    last_exported_at: datetime | None = None


class SettingsPatchRequest(BaseModel):
    nickname: str | None = Field(None, min_length=1, max_length=30)
    chat_notification: bool | None = None
    morning_reminder: bool | None = None
    evening_reminder: bool | None = None
    challenge_reminder: bool | None = None
    weekly_report: bool | None = None
    reminder_time_morning: time | None = None
    reminder_time_evening: time | None = None
    max_bundles_per_day: int | None = Field(None, ge=1, le=10)
    preferred_times: list[str] | None = Field(None, max_length=3)

    @field_validator("preferred_times")
    @classmethod
    def validate_preferred_times(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return value
        normalized = list(dict.fromkeys(item.strip().lower() for item in value))
        invalid = [item for item in normalized if item not in ALLOWED_PREFERRED_TIMES]
        if invalid:
            raise ValueError(
                f"preferred_times must be subset of {sorted(ALLOWED_PREFERRED_TIMES)}"
            )
        return normalized
