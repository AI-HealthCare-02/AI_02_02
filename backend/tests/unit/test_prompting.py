from __future__ import annotations

from types import SimpleNamespace

from backend.services.chat import prompting


def test_message_text_appends_last_user_message():
    result = prompting._build_openai_messages_from_base_prompt(
        base_system_prompt="BASE",
        history=[
            SimpleNamespace(role="assistant", content="이전 응답"),
            SimpleNamespace(role="user", content="이전 질문"),
        ],
        route=None,
        emotional_priority=False,
        prompt_policy=prompting.PromptPolicy.NONE,
        message_text="지금 질문",
    )

    assert result.openai_messages[-1] == {"role": "user", "content": "지금 질문"}
    assert [message["content"] for message in result.openai_messages[1:]] == [
        "이전 응답",
        "이전 질문",
        "지금 질문",
    ]


def test_message_text_none_keeps_backward_compatibility():
    result = prompting._build_openai_messages_from_base_prompt(
        base_system_prompt="BASE",
        history=[SimpleNamespace(role="assistant", content="이전 응답")],
        route=None,
        emotional_priority=False,
        prompt_policy=prompting.PromptPolicy.NONE,
        message_text=None,
    )

    assert result.openai_messages == (
        {"role": "system", "content": result.final_system_prompt},
        {"role": "assistant", "content": "이전 응답"},
    )


def test_message_text_empty_string_is_not_appended():
    result = prompting._build_openai_messages_from_base_prompt(
        base_system_prompt="BASE",
        history=[SimpleNamespace(role="assistant", content="이전 응답")],
        route=None,
        emotional_priority=False,
        prompt_policy=prompting.PromptPolicy.NONE,
        message_text="",
    )

    assert len(result.openai_messages) == 2
