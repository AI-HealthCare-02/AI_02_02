"""Compiled LangGraph instance for chat preparation."""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from backend.core.logger import setup_logger
from backend.services.chat_graph.nodes import (
    assemble_prompt_layers,
    build_user_context,
    decide_rag,
    decide_user_context,
    run_rag,
)
from backend.services.chat_graph.state import ChatPrepState

logger = setup_logger(__name__)

_compiled_graph = None
_compile_error: str | None = None


def build_chat_prep_graph():
    workflow = StateGraph(ChatPrepState)
    workflow.add_node("decide_rag", decide_rag)
    workflow.add_node("run_rag", run_rag)
    workflow.add_node("decide_user_context", decide_user_context)
    workflow.add_node("build_user_context", build_user_context)
    workflow.add_node("assemble_prompt_layers", assemble_prompt_layers)

    workflow.add_edge(START, "decide_rag")
    workflow.add_edge("decide_rag", "run_rag")
    workflow.add_edge("run_rag", "decide_user_context")
    workflow.add_edge("decide_user_context", "build_user_context")
    workflow.add_edge("build_user_context", "assemble_prompt_layers")
    workflow.add_edge("assemble_prompt_layers", END)
    return workflow.compile()


def get_chat_prep_graph():
    global _compiled_graph, _compile_error  # noqa: PLW0603
    if _compiled_graph is not None:
        return _compiled_graph
    if _compile_error is not None:
        return None
    try:
        _compiled_graph = build_chat_prep_graph()
        logger.info("chat_langgraph_compiled")
    except Exception as exc:
        _compile_error = repr(exc)
        logger.exception("chat_langgraph_compile_failed")
        return None
    return _compiled_graph


def warmup_chat_prep_graph() -> bool:
    return get_chat_prep_graph() is not None
