"""Serializable state contracts for LangGraph-backed chat preparation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict

from backend.models.enums import MessageRoute
from backend.services.chat.prep_types import (
    HistoryTurnSnapshot,
    PrepFlags,
    ProfileContextSnapshot,
    PromptPolicy,
)


@dataclass(frozen=True)
class ChatPrepInputs:
    user_id: int
    message_text: str
    base_system_prompt: str
    history_turns: tuple[HistoryTurnSnapshot, ...]
    route: MessageRoute | None
    emotional_priority: bool
    prompt_policy: PromptPolicy
    flags: PrepFlags
    profile_context: ProfileContextSnapshot | None = None
    app_help_text: str | None = None
    app_state_text: str | None = None


class ChatPrepState(TypedDict, total=False):
    user_id: int
    message_text: str
    base_system_prompt: str
    app_help_text: str | None
    app_state_text: str | None
    history_turns: tuple[HistoryTurnSnapshot, ...]
    route: MessageRoute | None
    emotional_priority: bool
    prompt_policy: PromptPolicy
    flags: PrepFlags
    profile_context: ProfileContextSnapshot | None
    should_run_rag: bool
    should_build_user_context: bool
    topic_hint: str | None
    rag_context_text: str | None
    rag_hit_count: int
    rag_has_context: bool
    user_context_text: str | None
    user_context_has_context: bool
    openai_messages: tuple[dict[str, str], ...]
    app_help_layer: str
    app_state_layer: str
    user_context_layer: str
    route_layer: str
    rag_layer: str
    filter_instruction_layer: str
    final_system_prompt: str


@dataclass(frozen=True)
class ChatPrepOutput:
    openai_messages: tuple[dict[str, str], ...]
    should_run_rag: bool
    should_build_user_context: bool
    topic_hint: str | None
    rag_hit_count: int
    rag_has_context: bool
    user_context_has_context: bool
    user_context_layer: str
    route_layer: str
    rag_layer: str
    filter_instruction_layer: str
    final_system_prompt: str
    app_help_layer: str = ""
    app_state_layer: str = ""
