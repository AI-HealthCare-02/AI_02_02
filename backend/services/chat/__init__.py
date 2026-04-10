"""Chat service package public surface."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.services.chat.prompting import EMOTIONAL_INSTRUCTION, ROUTE_INSTRUCTIONS
    from backend.services.chat.service import ChatService
    from backend.services.chat.streaming import _sse_event

__all__ = [
    "ChatService",
    "_sse_event",
    "ROUTE_INSTRUCTIONS",
    "EMOTIONAL_INSTRUCTION",
]


def __getattr__(name: str):
    if name == "ChatService":
        from backend.services.chat.service import ChatService

        return ChatService
    if name == "_sse_event":
        from backend.services.chat.streaming import _sse_event

        return _sse_event
    if name == "ROUTE_INSTRUCTIONS":
        from backend.services.chat.prompting import ROUTE_INSTRUCTIONS

        return ROUTE_INSTRUCTIONS
    if name == "EMOTIONAL_INSTRUCTION":
        from backend.services.chat.prompting import EMOTIONAL_INSTRUCTION

        return EMOTIONAL_INSTRUCTION
    raise AttributeError(name)
