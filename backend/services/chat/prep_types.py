"""Shared chat preparation contracts used by legacy and LangGraph prep paths."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class PromptPolicy(Enum):
    NONE = "none"
    WARN = "warn"
    MEDICAL_NOTE = "medical_note"


@dataclass(frozen=True)
class HistoryTurnSnapshot:
    role: str
    content: str


@dataclass(frozen=True)
class ProfileContextSnapshot:
    goals: tuple[str, ...]
    exercise_frequency: str | None
    sleep_duration_bucket: str | None


@dataclass(frozen=True)
class PrepFlags:
    rag_enabled: bool
    rag_apply_enabled: bool
    user_context_enabled: bool
    user_context_apply_enabled: bool
    routing_apply_enabled: bool
    rag_top_k: int
