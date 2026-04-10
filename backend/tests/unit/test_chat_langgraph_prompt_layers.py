"""Prompt layer hash parity between legacy and LangGraph prep."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

import backend.services.chat_graph.adapter as graph_adapter
import backend.services.chat_graph.graph as graph_module
import backend.services.chat_graph.nodes as graph_nodes
from backend.models.enums import FilterExpressionVerdict, FilterMedicalAction, MessageRoute
from backend.services.content_filter import FilterResult


class _FakeRagService:
    def search(self, query: str, top_k: int = 2):
        del query, top_k
        return SimpleNamespace(
            prompt_context="\n\n## 참고 정보\n- 운동 루틴 문맥\n",
            hit_count=1,
            has_context=True,
        )


class _FakeUserContextService:
    def build_context(self, profile, topic_hint=None):
        del profile, topic_hint
        return SimpleNamespace(summary="운동 목표, 수면 7-8시간", has_context=True)


@pytest.mark.asyncio
async def test_prompt_layer_hashes_match(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(graph_adapter.config, "RAG_ENABLED", True)
    monkeypatch.setattr(graph_adapter.config, "RAG_APPLY_ENABLED", True)
    monkeypatch.setattr(graph_adapter.config, "USER_CONTEXT_ENABLED", True)
    monkeypatch.setattr(graph_adapter.config, "USER_CONTEXT_APPLY_ENABLED", True)
    monkeypatch.setattr(graph_adapter.config, "CONTENT_FILTER_ROUTING_APPLY_ENABLED", True)
    monkeypatch.setattr(graph_nodes, "_get_rag_service", lambda: _FakeRagService())
    monkeypatch.setattr(graph_nodes, "_get_user_context_service", lambda: _FakeUserContextService())
    graph_module._compiled_graph = None
    graph_module._compile_error = None

    filter_result = FilterResult(
        expression_verdict=FilterExpressionVerdict.WARN,
        medical_action=FilterMedicalAction.NONE,
        message_route=MessageRoute.HEALTH_SPECIFIC,
        emotional_priority=True,
        prompt_instruction="추가 안내",
    )
    profile = SimpleNamespace(
        goals=["exercise_habit"],
        exercise_frequency="3_4_per_week",
        sleep_duration_bucket="between_7_8",
        user_group="B",
    )
    history = [SimpleNamespace(role="assistant", content="이전 답변")]

    inputs = graph_adapter._build_inputs(
        user_id=8,
        message_text="운동 계획 어떻게 세워?",
        base_system_prompt="BASE\n",
        history=history,
        filter_result=filter_result,
        profile=profile,
    )

    legacy_output = await graph_adapter._run_legacy_prep(inputs)
    graph_output = await graph_adapter._run_graph_prep(inputs)
    _, _, legacy_fields, graph_fields = graph_adapter._compare_parity(
        legacy_output,
        graph_output,
        route=inputs.route,
        emotional_priority=inputs.emotional_priority,
        prompt_policy=inputs.prompt_policy,
    )

    assert legacy_fields["system_prompt_sha256"] == graph_fields["system_prompt_sha256"]
    assert legacy_fields["user_context_layer_sha256"] == graph_fields["user_context_layer_sha256"]
    assert legacy_fields["route_layer_sha256"] == graph_fields["route_layer_sha256"]
    assert legacy_fields["rag_layer_sha256"] == graph_fields["rag_layer_sha256"]
    assert legacy_fields["filter_instruction_layer_sha256"] == graph_fields["filter_instruction_layer_sha256"]
    assert legacy_fields["openai_messages_sha256"] == graph_fields["openai_messages_sha256"]
    assert legacy_fields["openai_role_sequence"] == graph_fields["openai_role_sequence"]
