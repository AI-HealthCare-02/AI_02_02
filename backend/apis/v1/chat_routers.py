"""AI 채팅 API 라우터."""

from __future__ import annotations

from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse as Response
from fastapi.responses import StreamingResponse

from backend.dependencies.security import get_request_user
from backend.dtos.chat import HealthAnswerRequest, SendMessageRequest
from backend.middleware.rate_limit import limiter
from backend.models.users import User
from backend.services.chat import ChatService

chat_router = APIRouter(prefix="/chat", tags=["chat"])
_chat_service = ChatService()


def get_chat_service() -> ChatService:
    return _chat_service


@chat_router.post("/send")
@limiter.limit("20/minute")
async def send_message(
    request: Request,
    body: SendMessageRequest,
    user: Annotated[User, Depends(get_request_user)],
    chat_service: Annotated[ChatService, Depends(get_chat_service)],
) -> StreamingResponse:
    """사용자 메시지를 보내고 AI 응답을 SSE 스트림으로 받는다."""
    del request
    chat_req_id = uuid4().hex
    return StreamingResponse(
        chat_service.send_message_stream(
            user_id=user.id,
            message=body.message,
            session_id=body.session_id,
            chat_req_id=chat_req_id,
        ),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Chat-Request-ID": chat_req_id,
            "X-Chat-SSE-Receiver-Version": "v2",
        },
    )


@chat_router.get("/history")
async def get_history(
    user: Annotated[User, Depends(get_request_user)],
    chat_service: Annotated[ChatService, Depends(get_chat_service)],
    session_id: int = Query(...),
    limit: int = Query(50, ge=1, le=100),
    before_id: int | None = Query(None),
) -> Response:
    """대화 기록 조회."""
    result = await chat_service.get_history(
        user_id=user.id,
        session_id=session_id,
        limit=limit,
        before_id=before_id,
    )
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@chat_router.get("/sessions")
@limiter.limit("60/minute")
async def get_sessions(
    request: Request,
    user: Annotated[User, Depends(get_request_user)],
    chat_service: Annotated[ChatService, Depends(get_chat_service)],
    limit: int = Query(20, ge=1, le=50),
) -> Response:
    """현재 사용자의 최근 채팅 세션 목록 조회."""
    del request
    result = await chat_service.get_sessions(user_id=user.id, limit=limit)
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@chat_router.delete("/sessions/{session_id}")
@limiter.limit("30/minute")
async def delete_session(
    request: Request,
    session_id: int,
    user: Annotated[User, Depends(get_request_user)],
    chat_service: Annotated[ChatService, Depends(get_chat_service)],
) -> Response:
    """현재 사용자의 채팅 세션을 목록에서 삭제합니다."""
    del request
    await chat_service.delete_session(user_id=user.id, session_id=session_id)
    return Response(content={"ok": True}, status_code=status.HTTP_200_OK)


@chat_router.post("/health-answer")
@limiter.limit("20/minute")
async def submit_health_answer(
    request: Request,
    body: HealthAnswerRequest,
    user: Annotated[User, Depends(get_request_user)],
    chat_service: Annotated[ChatService, Depends(get_chat_service)],
) -> Response:
    """건강질문 응답 제출."""
    del request
    result = await chat_service.save_health_answer(
        user_id=user.id,
        bundle_key=body.bundle_key,
        answers=body.answers,
    )
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )
