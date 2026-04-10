"""LangGraph chat prep parity tests."""

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
            prompt_context="\n\n## 참고 정보\n- 생활 습관 문맥\n",
            hit_count=1,
            has_context=True,
        )


class _FakeUserContextService:
    def build_context(self, profile, topic_hint=None):
        del profile, topic_hint
        return SimpleNamespace(
            summary="체중관리 목표, 수면 6-7시간 유지",
            has_context=True,
        )


def _filter_result() -> FilterResult:
    return FilterResult(
        expression_verdict=FilterExpressionVerdict.ALLOW,
        medical_action=FilterMedicalAction.NONE,
        message_route=MessageRoute.HEALTH_GENERAL,
        emotional_priority=False,
    )


def _profile():
    return SimpleNamespace(
        goals=["weight_management"],
        exercise_frequency="1_2_per_week",
        sleep_duration_bucket="between_6_7",
        user_group="B",
    )


def _history():
    return [
        SimpleNamespace(role="user", content="이전 질문"),
        SimpleNamespace(role="assistant", content="이전 답변"),
    ]


@pytest.mark.asyncio
async def test_graph_matches_legacy_parity(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(graph_adapter.config, "RAG_ENABLED", True)
    monkeypatch.setattr(graph_adapter.config, "RAG_APPLY_ENABLED", True)
    monkeypatch.setattr(graph_adapter.config, "USER_CONTEXT_ENABLED", True)
    monkeypatch.setattr(graph_adapter.config, "USER_CONTEXT_APPLY_ENABLED", True)
    monkeypatch.setattr(graph_adapter.config, "CONTENT_FILTER_ROUTING_APPLY_ENABLED", True)
    monkeypatch.setattr(graph_nodes, "_get_rag_service", lambda: _FakeRagService())
    monkeypatch.setattr(graph_nodes, "_get_user_context_service", lambda: _FakeUserContextService())
    graph_module._compiled_graph = None
    graph_module._compile_error = None

    inputs = graph_adapter._build_inputs(
        user_id=7,
        message_text="수면 관리 방법 알려줘",
        base_system_prompt="BASE\n",
        history=_history(),
        filter_result=_filter_result(),
        profile=_profile(),
    )

    legacy_output = await graph_adapter._run_legacy_prep(inputs)
    graph_output = await graph_adapter._run_graph_prep(inputs)

    parity_ok, mismatches, legacy_fields, graph_fields = graph_adapter._compare_parity(
        legacy_output,
        graph_output,
        route=inputs.route,
        emotional_priority=inputs.emotional_priority,
        prompt_policy=inputs.prompt_policy,
    )

    assert parity_ok is True
    assert mismatches == []
    assert legacy_fields["should_run_rag"] is True
    assert graph_fields["should_build_user_context"] is True
    assert legacy_fields["message_route"] == MessageRoute.HEALTH_GENERAL.value
