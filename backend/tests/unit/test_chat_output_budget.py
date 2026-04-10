from __future__ import annotations

from types import SimpleNamespace

from backend.services.chat import prompting, streaming


def test_stream_max_tokens_uses_default_config(monkeypatch):
    monkeypatch.setattr(streaming.config, "CHAT_OPENAI_SHORT_RESPONSE_ENABLED", False)
    monkeypatch.setattr(streaming.config, "CHAT_OPENAI_MAX_TOKENS", 384)

    assert streaming._chat_openai_max_tokens() == 384


def test_stream_max_tokens_uses_short_response_config(monkeypatch):
    monkeypatch.setattr(streaming.config, "CHAT_OPENAI_SHORT_RESPONSE_ENABLED", True)
    monkeypatch.setattr(streaming.config, "CHAT_OPENAI_SHORT_RESPONSE_MAX_TOKENS", 256)
    monkeypatch.setattr(streaming.config, "CHAT_OPENAI_MAX_TOKENS", 1024)

    assert streaming._chat_openai_max_tokens() == 256


def test_short_response_instruction_is_flagged(monkeypatch):
    monkeypatch.setattr(prompting.config, "CHAT_OPENAI_SHORT_RESPONSE_ENABLED", True)

    result = prompting._build_openai_messages_from_base_prompt(
        base_system_prompt="BASE",
        history=[SimpleNamespace(role="user", content="오늘 야식을 줄이고 싶어.")],
        route=None,
        emotional_priority=False,
        prompt_policy=prompting.PromptPolicy.NONE,
    )

    assert "응답 길이 실험 지시" in result.final_system_prompt
    assert "의료 안전 안내" in result.final_system_prompt
