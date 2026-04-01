from datetime import datetime
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse as Response, StreamingResponse
from pydantic import BaseModel

from app.dependencies.security import get_request_token_payload

chat_router = APIRouter(prefix="/chat", tags=["chat"])


class ChatSessionCreateResponse(BaseModel):
    session_id: str
    created_at: datetime


class ChatMessageRequest(BaseModel):
    session_id: str
    content: str


class ChatMessageItem(BaseModel):
    role: str
    content: str
    sent_at: datetime


class ChatMessagesResponse(BaseModel):
    messages: list[ChatMessageItem]
    has_more: bool


@chat_router.post("/sessions", response_model=ChatSessionCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_session(_: Annotated[dict, Depends(get_request_token_payload)]) -> Response:
    response = ChatSessionCreateResponse(
        session_id=str(uuid4()),
        created_at=datetime.fromisoformat("2026-04-01T10:00:00+09:00"),
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_201_CREATED)


@chat_router.post("/messages", status_code=status.HTTP_200_OK)
async def stream_chat_message(
    request: ChatMessageRequest,
    _: Annotated[dict, Depends(get_request_token_payload)],
) -> StreamingResponse:
    events = [
        'event: token\ndata: {"text": "잘"}\n\n',
        'event: token\ndata: {"text": "하셨어요"}\n\n',
        (
            'event: health_questions\ndata: {"bundle_key":"bundle_4","questions":'
            '[{"field":"exercise","question":"어떤 운동을 하셨나요?","options":["걷기","달리기","자전거"]}]}\n\n'
        ),
        (
            'event: done\ndata: {"session_id":"%s","sent_at":"2026-04-01T10:00:05+09:00"}\n\n'
            % request.session_id
        ),
    ]
    return StreamingResponse(iter(events), media_type="text/event-stream")


@chat_router.get("/sessions/{session_id}/messages", response_model=ChatMessagesResponse, status_code=status.HTTP_200_OK)
async def get_chat_messages(
    session_id: str,
    _: Annotated[dict, Depends(get_request_token_payload)],
) -> Response:
    response = ChatMessagesResponse(
        messages=[
            ChatMessageItem(
                role="user",
                content="오늘 아침에 운동했어요",
                sent_at=datetime.fromisoformat("2026-04-01T10:00:00+09:00"),
            ),
            ChatMessageItem(
                role="assistant",
                content=f"{session_id} 세션 기준으로 운동 기록을 도와드릴게요.",
                sent_at=datetime.fromisoformat("2026-04-01T10:00:05+09:00"),
            ),
        ],
        has_more=False,
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)
