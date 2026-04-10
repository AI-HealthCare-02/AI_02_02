"""LangGraph node implementations for chat preparation."""

from __future__ import annotations

from types import SimpleNamespace

from backend.core.logger import setup_logger
from backend.services.chat.enrich import (
    _select_topic_hint,
    _should_build_user_context_from_projection,
    _should_run_rag_from_projection,
)
from backend.services.chat.prompting import _build_openai_messages_from_base_prompt
from backend.services.chat_graph.state import ChatPrepState, ProfileContextSnapshot

logger = setup_logger(__name__)

_rag_service = None
_user_context_service = None


def _get_rag_service():
    global _rag_service  # noqa: PLW0603
    if _rag_service is not None:
        return _rag_service
    try:
        from backend.services.rag import RAGService

        _rag_service = RAGService()
        return _rag_service
    except Exception:
        logger.warning("chat_langgraph_rag_init_failed")
        return None


def _get_user_context_service():
    global _user_context_service  # noqa: PLW0603
    if _user_context_service is not None:
        return _user_context_service
    try:
        from backend.services.user_context import UserContextService

        _user_context_service = UserContextService()
        return _user_context_service
    except Exception:
        logger.warning("chat_langgraph_user_context_init_failed")
        return None


def decide_rag(state: ChatPrepState) -> dict:
    message = state["message_text"]
    should_run = _should_run_rag_from_projection(
        message,
        state["route"],
        state["emotional_priority"],
        state["prompt_policy"],
        flags=state["flags"],
    )
    return {
        "should_run_rag": should_run,
        "topic_hint": _select_topic_hint(message),
    }


def run_rag(state: ChatPrepState) -> dict:
    if not state.get("should_run_rag", False):
        return {
            "rag_context_text": None,
            "rag_hit_count": 0,
            "rag_has_context": False,
        }

    rag_service = _get_rag_service()
    if rag_service is None:
        return {
            "rag_context_text": None,
            "rag_hit_count": 0,
            "rag_has_context": False,
        }

    result = rag_service.search(
        query=state["message_text"],
        top_k=1 if state["emotional_priority"] else state["flags"].rag_top_k,
    )
    if not result or not result.has_context:
        return {
            "rag_context_text": None,
            "rag_hit_count": 0,
            "rag_has_context": False,
        }

    return {
        "rag_context_text": result.prompt_context,
        "rag_hit_count": result.hit_count,
        "rag_has_context": result.has_context,
    }


def decide_user_context(state: ChatPrepState) -> dict:
    should_build = _should_build_user_context_from_projection(
        state["route"],
        state["emotional_priority"],
        state["prompt_policy"],
        has_profile=state.get("profile_context") is not None,
        flags=state["flags"],
    )
    return {"should_build_user_context": should_build}


def _profile_namespace(profile_context: ProfileContextSnapshot) -> SimpleNamespace:
    return SimpleNamespace(
        goals=list(profile_context.goals),
        exercise_frequency=profile_context.exercise_frequency,
        sleep_duration_bucket=profile_context.sleep_duration_bucket,
    )


def build_user_context(state: ChatPrepState) -> dict:
    if not state.get("should_build_user_context", False):
        return {
            "user_context_text": None,
            "user_context_has_context": False,
        }

    profile_context = state.get("profile_context")
    if profile_context is None:
        return {
            "user_context_text": None,
            "user_context_has_context": False,
        }

    user_context_service = _get_user_context_service()
    if user_context_service is None:
        return {
            "user_context_text": None,
            "user_context_has_context": False,
        }

    result = user_context_service.build_context(
        _profile_namespace(profile_context),
        topic_hint=state.get("topic_hint"),
    )
    if not result or not result.has_context:
        return {
            "user_context_text": None,
            "user_context_has_context": False,
        }

    return {
        "user_context_text": result.summary,
        "user_context_has_context": True,
    }


def assemble_prompt_layers(state: ChatPrepState) -> dict:
    result = _build_openai_messages_from_base_prompt(
        base_system_prompt=state["base_system_prompt"],
        history=state["history_turns"],
        route=state["route"],
        emotional_priority=state["emotional_priority"],
        prompt_policy=state["prompt_policy"],
        rag_context_text=state.get("rag_context_text"),
        user_context_text=state.get("user_context_text"),
        flags=state["flags"],
    )
    return {
        "openai_messages": tuple(result.openai_messages),
        "user_context_layer": result.user_context_layer,
        "route_layer": result.route_layer,
        "rag_layer": result.rag_layer,
        "filter_instruction_layer": result.filter_instruction_layer,
        "final_system_prompt": result.final_system_prompt,
    }
