"""Mode switch and fallback tests for chat LangGraph adapter."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta

import pytest

import backend.services.chat_graph.adapter as graph_adapter
from backend.core import config
from backend.core.config import ChatLangGraphMode
from backend.models.enums import FilterExpressionVerdict, FilterMedicalAction, MessageRoute
from backend.services.chat import ChatService
from backend.services.chat_graph.state import ChatPrepOutput
from backend.services.content_filter import FilterResult


def _output(label: str) -> ChatPrepOutput:
    return ChatPrepOutput(
        openai_messages=({"role": "system", "content": label},),
        should_run_rag=False,
        should_build_user_context=False,
        topic_hint=None,
        rag_hit_count=0,
        rag_has_context=False,
        user_context_has_context=False,
        user_context_layer="",
        route_layer="",
        rag_layer="",
        filter_instruction_layer="",
        final_system_prompt=label,
    )


def _filter_result() -> FilterResult:
    return FilterResult(
        expression_verdict=FilterExpressionVerdict.ALLOW,
        medical_action=FilterMedicalAction.NONE,
        message_route=MessageRoute.HEALTH_GENERAL,
        emotional_priority=False,
    )


def test_shadow_zero_sample_does_not_enter_adapter(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_MODE", ChatLangGraphMode.SHADOW)
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE", 0.0)
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_FORCE_FALLBACK", False)

    assert graph_adapter.should_enter_langgraph_adapter(1, _filter_result()) is False


def test_shadow_sampled_request_enters_adapter(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_MODE", ChatLangGraphMode.SHADOW)
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE", 1.0)
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_FORCE_FALLBACK", False)

    assert graph_adapter.should_enter_langgraph_adapter(1, _filter_result()) is True


@pytest.mark.asyncio
async def test_mode_off_uses_legacy(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_MODE", ChatLangGraphMode.OFF)
    monkeypatch.setattr(graph_adapter, "_run_legacy_prep", lambda *_args, **_kwargs: asyncio.sleep(0, result=_output("legacy")))
    monkeypatch.setattr(graph_adapter, "_run_graph_prep", lambda *_args, **_kwargs: asyncio.sleep(0, result=_output("graph")))

    result = await graph_adapter.prepare_openai_messages(
        user_id=1,
        message_text="테스트",
        base_system_prompt="BASE",
        history=[],
        filter_result=_filter_result(),
        profile=None,
    )

    assert result[0]["content"] == "legacy"


@pytest.mark.asyncio
async def test_mode_shadow_returns_legacy_and_schedules_audit(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_MODE", ChatLangGraphMode.SHADOW)
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE", 1.0)
    scheduled: list[bool] = []

    monkeypatch.setattr(graph_adapter, "_run_legacy_prep", lambda *_args, **_kwargs: asyncio.sleep(0, result=_output("legacy-shadow")))
    monkeypatch.setattr(graph_adapter, "_schedule_background_audit", lambda coro: (scheduled.append(True), coro.close()))

    result = await graph_adapter.prepare_openai_messages(
        user_id=2,
        message_text="테스트",
        base_system_prompt="BASE",
        history=[],
        filter_result=_filter_result(),
        profile=None,
    )

    assert result[0]["content"] == "legacy-shadow"
    assert scheduled == [True]


@pytest.mark.asyncio
async def test_mode_partial_uses_graph(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_MODE", ChatLangGraphMode.PARTIAL)
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_PARTIAL_PERCENT", 100)
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_AUDIT_SAMPLE_RATE", 0.0)
    monkeypatch.setattr(graph_adapter, "_run_graph_prep", lambda *_args, **_kwargs: asyncio.sleep(0, result=_output("graph-live")))

    result = await graph_adapter.prepare_openai_messages(
        user_id=3,
        message_text="테스트",
        base_system_prompt="BASE",
        history=[],
        filter_result=_filter_result(),
        profile=None,
    )

    assert result[0]["content"] == "graph-live"


@pytest.mark.asyncio
async def test_timeout_falls_back_to_legacy(monkeypatch: pytest.MonkeyPatch):
    async def _slow_graph(*_args, **_kwargs):
        await asyncio.sleep(0.02)
        return _output("graph-slow")

    monkeypatch.setattr(config, "CHAT_LANGGRAPH_MODE", ChatLangGraphMode.PARTIAL)
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_PARTIAL_PERCENT", 100)
    monkeypatch.setattr(config, "CHAT_LANGGRAPH_PREP_TIMEOUT_MS", 1)
    monkeypatch.setattr(graph_adapter, "_run_graph_prep", _slow_graph)
    monkeypatch.setattr(graph_adapter, "_run_legacy_prep", lambda *_args, **_kwargs: asyncio.sleep(0, result=_output("legacy-timeout")))

    result = await graph_adapter.prepare_openai_messages(
        user_id=4,
        message_text="테스트",
        base_system_prompt="BASE",
        history=[],
        filter_result=_filter_result(),
        profile=None,
    )

    assert result[0]["content"] == "legacy-timeout"


def test_crisis_cooldown_boundary():
    service = ChatService()
    now = datetime.now(tz=config.TIMEZONE)
    service._last_crisis_at[1] = now - timedelta(hours=23, minutes=59)
    assert service._is_in_crisis_cooldown(1) is True

    service._last_crisis_at[1] = now - timedelta(hours=24, seconds=1)
    assert service._is_in_crisis_cooldown(1) is False
