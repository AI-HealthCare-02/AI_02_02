"""Do it OS API 라우터."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status

from backend.dependencies.security import get_request_user
from backend.dtos.doit import (
    AiSummaryDTO,
    BulkSyncDTO,
    BulkSyncResultDTO,
    ThoughtCreateDTO,
    ThoughtDTO,
    ThoughtUpdateDTO,
)
from backend.models.users import User
from backend.services.doit import DoitService

doit_router = APIRouter(prefix="/doit", tags=["doit"])
_doit_service = DoitService()


def get_doit_service() -> DoitService:
    return _doit_service


@doit_router.get("/thoughts", response_model=list[ThoughtDTO])
async def list_thoughts(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[DoitService, Depends(get_doit_service)],
    category: str | None = None,
    since: datetime | None = None,
) -> list[ThoughtDTO]:
    """사용자의 Thought 목록 조회. category/since 필터 선택."""
    return await service.list_thoughts(user.id, category=category, since=since)


@doit_router.post("/thoughts", response_model=ThoughtDTO, status_code=status.HTTP_201_CREATED)
async def create_thought(
    body: ThoughtCreateDTO,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[DoitService, Depends(get_doit_service)],
) -> ThoughtDTO:
    """새 Thought 생성."""
    return await service.create_thought(user.id, body)


@doit_router.put("/thoughts/{thought_id}", response_model=ThoughtDTO)
async def update_thought(
    thought_id: str,
    body: ThoughtUpdateDTO,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[DoitService, Depends(get_doit_service)],
) -> ThoughtDTO:
    """Thought 부분 수정 — 포함된 필드만 반영."""
    return await service.update_thought(user.id, thought_id, body)


@doit_router.delete("/thoughts/{thought_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thought(
    thought_id: str,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[DoitService, Depends(get_doit_service)],
) -> None:
    """Thought 삭제."""
    await service.delete_thought(user.id, thought_id)


@doit_router.post("/thoughts/bulk-sync", response_model=BulkSyncResultDTO)
async def bulk_sync(
    body: BulkSyncDTO,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[DoitService, Depends(get_doit_service)],
) -> BulkSyncResultDTO:
    """localStorage → DB 초기 이전용 bulk upsert. 동일 ID는 최신 우선 병합."""
    return await service.bulk_sync(user.id, body.thoughts)


@doit_router.get("/thoughts/ai-summary", response_model=AiSummaryDTO)
async def get_ai_summary(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[DoitService, Depends(get_doit_service)],
) -> AiSummaryDTO:
    """AI 도움 모드용 요약본. 원본 text 전체 미포함, health 카테고리 기본 제외."""
    return await service.get_ai_summary(user.id)
