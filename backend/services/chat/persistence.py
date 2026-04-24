"""채팅 persistence helpers."""

from fastapi import HTTPException, status
from tortoise.functions import Count, Max

from backend.dtos.chat import (
    ChatHistoryResponse,
    ChatMessageDTO,
    ChatSessionListResponse,
    ChatSessionSummaryDTO,
)
from backend.models.chat import ChatMessage, ChatSession, MessageRole


async def _prepare_session(user_id: int, message: str, session_id: int | None) -> ChatSession | None:
    """세션 get_or_create."""
    if session_id:
        return await ChatSession.get_or_none(id=session_id, user_id=user_id)
    return await ChatSession.create(user_id=user_id, title=message[:50])


async def _save_response(session: ChatSession, content: str, eligible_bundles: list[str]) -> None:
    """AI 응답 DB 저장."""
    has_health_questions = len(eligible_bundles) > 0
    await ChatMessage.create(
        session=session,
        role=MessageRole.ASSISTANT,
        content=content,
        has_health_questions=has_health_questions,
        bundle_keys=eligible_bundles if has_health_questions else None,
    )


async def get_history(
    user_id: int,
    session_id: int,
    limit: int = 50,
    before_id: int | None = None,
) -> ChatHistoryResponse:
    """대화 기록 조회."""
    session = await ChatSession.get_or_none(id=session_id, user_id=user_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="세션을 찾을 수 없습니다.",
        )

    query = ChatMessage.filter(session=session)
    if before_id:
        query = query.filter(id__lt=before_id)

    messages = await query.order_by("-created_at").limit(limit + 1).all()
    has_more = len(messages) > limit
    if has_more:
        messages = messages[:limit]
    messages.reverse()

    return ChatHistoryResponse(
        session_id=session_id,
        messages=[
            ChatMessageDTO(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                has_health_questions=msg.has_health_questions,
                bundle_keys=msg.bundle_keys,
                created_at=msg.created_at,
            )
            for msg in messages
        ],
        has_more=has_more,
    )


async def list_sessions(user_id: int, limit: int = 20) -> ChatSessionListResponse:
    """현재 사용자의 최근 채팅 세션 목록 조회."""
    rows = await (
        ChatSession.filter(user_id=user_id, is_active=True)
        .annotate(message_count=Count("messages__id"), latest_message_at=Max("messages__created_at"))
        .order_by("-latest_message_at", "-id")
        .limit(limit)
        .values("id", "title", "created_at", "message_count", "latest_message_at")
    )

    sessions = [
        ChatSessionSummaryDTO(
            id=row["id"],
            title=(row["title"] or "새 대화").strip() or "새 대화",
            updated_at=row["latest_message_at"] or row["created_at"],
            message_count=int(row["message_count"] or 0),
        )
        for row in rows
    ]
    return ChatSessionListResponse(sessions=sessions)


async def delete_session(user_id: int, session_id: int) -> None:
    """Hide a chat session from the user's session list."""
    session = await ChatSession.get_or_none(id=session_id, user_id=user_id, is_active=True)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="세션을 찾을 수 없어요.",
        )

    session.is_active = False
    await session.save(update_fields=["is_active", "updated_at"])
