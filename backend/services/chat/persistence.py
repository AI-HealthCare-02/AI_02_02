"""채팅 persistence helpers."""

from fastapi import HTTPException, status

from backend.dtos.chat import ChatHistoryResponse, ChatMessageDTO
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
