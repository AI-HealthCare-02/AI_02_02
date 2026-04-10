"""Logging guardrails for LangGraph parity/audit events."""

from __future__ import annotations

import json
from unittest.mock import Mock

import pytest

import backend.services.chat_graph.adapter as graph_adapter
from backend.services.chat_graph.state import ChatPrepInputs, ChatPrepOutput, PrepFlags, PromptPolicy


@pytest.mark.asyncio
async def test_shadow_compare_logs_hashes_not_raw_prompt_or_context(monkeypatch: pytest.MonkeyPatch):
    logger = Mock()
    monkeypatch.setattr(graph_adapter, "logger", logger)

    inputs = ChatPrepInputs(
        user_id=5,
        message_text="원본 사용자 메시지",
        base_system_prompt="BASE SYSTEM PROMPT",
        history_turns=(),
        route=None,
        emotional_priority=False,
        prompt_policy=PromptPolicy.NONE,
        flags=PrepFlags(
            rag_enabled=False,
            rag_apply_enabled=False,
            user_context_enabled=False,
            user_context_apply_enabled=False,
            routing_apply_enabled=False,
            rag_top_k=2,
        ),
        profile_context=None,
    )
    output = ChatPrepOutput(
        openai_messages=({"role": "system", "content": "BASE SYSTEM PROMPT"},),
        should_run_rag=False,
        should_build_user_context=False,
        topic_hint=None,
        rag_hit_count=0,
        rag_has_context=False,
        user_context_has_context=False,
        user_context_layer="USER CONTEXT LAYER",
        route_layer="",
        rag_layer="RAG CONTEXT LAYER",
        filter_instruction_layer="",
        final_system_prompt="BASE SYSTEM PROMPTUSER CONTEXT LAYERRAG CONTEXT LAYER",
    )

    async def _same_output(_inputs):
        return output

    monkeypatch.setattr(graph_adapter, "_run_graph_prep", _same_output)

    await graph_adapter._shadow_compare(inputs, output)

    event_name = logger.info.call_args.kwargs.get("event") if "event" in logger.info.call_args.kwargs else logger.info.call_args.args[0]
    assert event_name == "chat_langgraph_shadow_parity"

    serialized = json.dumps(logger.info.call_args.kwargs, ensure_ascii=False, default=str)
    assert "원본 사용자 메시지" not in serialized
    assert "BASE SYSTEM PROMPT" not in serialized
    assert "USER CONTEXT LAYER" not in serialized
    assert "RAG CONTEXT LAYER" not in serialized
