"""AI 채팅 API 요청/응답 DTO."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

from backend.dtos.health import (
    CardAvailabilityResponse,
    DailyLogResponse,
    PendingQuestionsResponse,
)


class SendMessageRequest(BaseModel):
    """채팅 메시지 전송 요청."""

    message: Annotated[str, Field(min_length=1, max_length=2000)]
    session_id: int | None = None
    doit_context: dict | None = None


class HealthAnswerRequest(BaseModel):
    """건강질문 답변 제출."""

    bundle_key: Annotated[str, Field(min_length=1, max_length=30)]
    answers: dict[str, str | int | bool]


class ChatMessageDTO(BaseModel):
    """개별 채팅 메시지."""

    id: int
    role: str
    content: str
    has_health_questions: bool = False
    bundle_keys: list[str] | None = None
    created_at: datetime


class ChatHistoryResponse(BaseModel):
    """대화 기록 응답."""

    session_id: int
    messages: list[ChatMessageDTO]
    has_more: bool


class ChatSessionSummaryDTO(BaseModel):
    """왼쪽 사이드바에 표시할 채팅 세션 요약."""

    id: int
    title: str
    updated_at: datetime
    message_count: int


class ChatSessionListResponse(BaseModel):
    """현재 사용자의 최근 채팅 세션 목록."""

    sessions: list[ChatSessionSummaryDTO]


class HealthAnswerResponse(BaseModel):
    """건강질문 답변 결과."""

    saved_fields: list[str]
    skipped_fields: list[str]
    cooldown_until: datetime | None = None
    daily_log: DailyLogResponse | None = None
    pending_questions: PendingQuestionsResponse | None = None
    card_availability: CardAvailabilityResponse | None = None
