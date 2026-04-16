from __future__ import annotations

import asyncio
from types import SimpleNamespace

from backend.core.config import LLMFallbackProvider, LLMProvider
from backend.services.chat import openai_client, streaming


class _FakeStream:
    def __init__(self, items):
        self._iterator = iter(items)

    async def __anext__(self):
        try:
            item = next(self._iterator)
        except StopIteration as exc:
            raise StopAsyncIteration from exc
        if isinstance(item, Exception):
            raise item
        return item


def _chunk(content: str):
    return SimpleNamespace(
        choices=[SimpleNamespace(delta=SimpleNamespace(content=content))],
        usage=None,
    )


def test_get_llm_target_prefers_gemma_primary_and_openai_fallback(monkeypatch):
    monkeypatch.setattr(openai_client.config, "LLM_PROVIDER", LLMProvider.GEMMA_VLLM)
    monkeypatch.setattr(openai_client.config, "LLM_BASE_URL", "http://gemma-runtime:8001/v1")
    monkeypatch.setattr(openai_client.config, "LLM_MODEL", "google/gemma-4-E4B-it")
    monkeypatch.setattr(openai_client.config, "LLM_API_KEY", "")
    monkeypatch.setattr(openai_client.config, "LLM_FALLBACK_PROVIDER", LLMFallbackProvider.OPENAI)
    monkeypatch.setattr(openai_client.config, "OPENAI_API_KEY", "test-openai-key")
    monkeypatch.setattr(openai_client.config, "OPENAI_BASE_URL", "")
    monkeypatch.setattr(openai_client.config, "OPENAI_MODEL", "gpt-4o-mini")

    primary = openai_client.get_llm_target("primary")
    fallback = openai_client.get_llm_target("fallback")

    assert primary is not None
    assert primary.provider == LLMProvider.GEMMA_VLLM
    assert primary.model == "google/gemma-4-E4B-it"
    assert primary.base_url == "http://gemma-runtime:8001/v1"
    assert primary.api_key == "local-vllm"

    assert fallback is not None
    assert fallback.provider == LLMProvider.OPENAI
    assert fallback.model == "gpt-4o-mini"


def test_stream_openai_falls_back_before_first_token(monkeypatch):
    primary = openai_client.LLMTarget(
        role="primary",
        provider=LLMProvider.GEMMA_VLLM,
        model="google/gemma-4-E4B-it",
        base_url="http://gemma-runtime:8001/v1",
        api_key="local-vllm",
    )
    fallback = openai_client.LLMTarget(
        role="fallback",
        provider=LLMProvider.OPENAI,
        model="gpt-4o-mini",
        base_url=None,
        api_key="test-openai-key",
    )

    class _PrimaryClient:
        def __init__(self):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

        async def create(self, **_kwargs):
            raise RuntimeError("primary unavailable")

    class _FallbackClient:
        def __init__(self):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

        async def create(self, **_kwargs):
            return _FakeStream([_chunk("fallback-answer")])

    def _target(role: str):
        return primary if role == "primary" else fallback

    def _client(role: str):
        return _PrimaryClient() if role == "primary" else _FallbackClient()

    monkeypatch.setattr(streaming, "get_llm_target", _target)
    monkeypatch.setattr(streaming, "get_openai_client", _client)
    monkeypatch.setattr(streaming, "should_include_stream_usage", lambda _target: False)

    async def _collect():
        return [chunk async for chunk in streaming._stream_openai([{"role": "user", "content": "안녕"}], chat_req_id="req-1")]

    assert asyncio.run(_collect()) == ["fallback-answer"]


def test_stream_openai_does_not_switch_provider_after_first_token(monkeypatch):
    primary = openai_client.LLMTarget(
        role="primary",
        provider=LLMProvider.GEMMA_VLLM,
        model="google/gemma-4-E4B-it",
        base_url="http://gemma-runtime:8001/v1",
        api_key="local-vllm",
    )
    fallback = openai_client.LLMTarget(
        role="fallback",
        provider=LLMProvider.OPENAI,
        model="gpt-4o-mini",
        base_url=None,
        api_key="test-openai-key",
    )

    class _PrimaryClient:
        def __init__(self):
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

        async def create(self, **_kwargs):
            return _FakeStream([_chunk("primary-answer"), RuntimeError("mid-stream failure")])

    def _target(role: str):
        return primary if role == "primary" else fallback

    fallback_calls: list[str] = []

    def _client(role: str):
        if role == "fallback":
            fallback_calls.append(role)
        return _PrimaryClient()

    monkeypatch.setattr(streaming, "get_llm_target", _target)
    monkeypatch.setattr(streaming, "get_openai_client", _client)
    monkeypatch.setattr(streaming, "should_include_stream_usage", lambda _target: False)

    async def _collect():
        return [chunk async for chunk in streaming._stream_openai([{"role": "user", "content": "안녕"}], chat_req_id="req-2")]

    assert asyncio.run(_collect()) == ["primary-answer", None]
    assert fallback_calls == []
