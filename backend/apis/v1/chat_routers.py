"""AI 채팅 API 엔드포인트.

1. POST /api/v1/chat/send — 메시지 전송 + AI 응답 (SSE 스트림)
2. GET /api/v1/chat/history — 대화 기록 조회
3. POST /api/v1/chat/health-answer — 건강질문 답변 제출
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse as Response
from fastapi.responses import StreamingResponse

from backend.dependencies.security import get_request_user
from backend.dtos.chat import HealthAnswerRequest, SendMessageRequest
from backend.middleware.rate_limit import limiter
from backend.models.users import User
from backend.services.chat import ChatService

chat_router = APIRouter(prefix="/chat", tags=["chat"])


@chat_router.post("/send")
@limiter.limit("20/minute")
async def send_message(
    request: Request,
    body: SendMessageRequest,
    user: Annotated[User, Depends(get_request_user)],
    chat_service: Annotated[ChatService, Depends(ChatService)],
) -> StreamingResponse:
    """사용자 메시지를 보내고 AI 응답을 SSE 스트리밍으로 받음."""
    return StreamingResponse(
        chat_service.send_message_stream(
            user_id=user.id,
            message=body.message,
            session_id=body.session_id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@chat_router.get("/history")
async def get_history(
    user: Annotated[User, Depends(get_request_user)],
    chat_service: Annotated[ChatService, Depends(ChatService)],
    session_id: int = Query(...),
    limit: int = Query(50, ge=1, le=100),
    before_id: int | None = Query(None),
) -> Response:
    """대화 기록 조회 (커서 기반 페이지네이션)."""
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


@chat_router.post("/health-answer")
async def submit_health_answer(
    request: HealthAnswerRequest,
    user: Annotated[User, Depends(get_request_user)],
    chat_service: Annotated[ChatService, Depends(ChatService)],
) -> Response:
    """건강질문 답변 제출."""
    result = await chat_service.save_health_answer(
        user_id=user.id,
        bundle_key=request.bundle_key,
        answers=request.answers,
    )
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )
