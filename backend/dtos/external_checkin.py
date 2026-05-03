"""DTOs for external AI tool health check-ins."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class DeviceStartRequest(BaseModel):
    client_name: str = Field(default="DANAA CLI", min_length=1, max_length=80)
    client_type: str = Field(default="unknown", max_length=20)


class DeviceStartResponse(BaseModel):
    device_code: str
    user_code: str
    verification_uri: str
    expires_in: int
    interval: int = 5


class DeviceApproveRequest(BaseModel):
    user_code: str = Field(min_length=6, max_length=16)


class DeviceApproveResponse(BaseModel):
    approved: bool
    message: str


class DeviceTokenRequest(BaseModel):
    device_code: str = Field(min_length=24)


class DeviceTokenResponse(BaseModel):
    token_type: Literal["bearer"] = "bearer"
    access_token: str
    expires_in: int
    scopes: list[str]


class ExternalQuestionItem(BaseModel):
    field: str
    summary_label: str
    text: str
    input_type: str = "select"
    options: list[str | int | bool] = Field(default_factory=list)
    condition: str | None = None


class CheckinNextResponse(BaseModel):
    has_question: bool
    lease_id: str | None = None
    bundle_key: str | None = None
    bundle_name: str | None = None
    log_date: date | None = None
    expires_at: datetime | None = None
    questions: list[ExternalQuestionItem] = Field(default_factory=list)
    notice: str = "의료 자문이 아니라 생활습관 기록용 질문입니다."


class CheckinAnswerRequest(BaseModel):
    lease_id: str
    answers: dict[str, str | int | bool] = Field(default_factory=dict)
    skip: bool = False

    @model_validator(mode="after")
    def reject_empty_answer_without_skip(self) -> CheckinAnswerRequest:
        if not self.skip and not self.answers:
            raise ValueError("answers must contain at least one field")
        return self


class CheckinAnswerResponse(BaseModel):
    status: Literal["saved", "skipped"]
    saved_fields: list[str] = Field(default_factory=list)
    skipped_fields: list[str] = Field(default_factory=list)
    daily_log_date: date | None = None
    message: str


class ExternalSettingsResponse(BaseModel):
    health_question_interval_minutes: Literal[0, 60, 90, 120]
    max_bundles_per_day: int
    auto_question_enabled: bool


class ExternalSettingsPatchRequest(BaseModel):
    health_question_interval_minutes: Literal[0, 60, 90, 120] | None = None
