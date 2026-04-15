from __future__ import annotations

from types import SimpleNamespace

from backend.services.chat import prompting


def test_message_text_appends_last_user_message():
    result = prompting._build_openai_messages_from_base_prompt(
        base_system_prompt="BASE",
        history=[
            SimpleNamespace(role="assistant", content="previous-answer"),
            SimpleNamespace(role="user", content="previous-question"),
        ],
        route=None,
        emotional_priority=False,
        prompt_policy=prompting.PromptPolicy.NONE,
        message_text="current-question",
    )

    assert result.openai_messages[-1] == {"role": "user", "content": "current-question"}
    assert [message["content"] for message in result.openai_messages[1:]] == [
        "previous-answer",
        "previous-question",
        "current-question",
    ]


def test_message_text_none_keeps_backward_compatibility():
    result = prompting._build_openai_messages_from_base_prompt(
        base_system_prompt="BASE",
        history=[SimpleNamespace(role="assistant", content="previous-answer")],
        route=None,
        emotional_priority=False,
        prompt_policy=prompting.PromptPolicy.NONE,
        message_text=None,
    )

    assert result.openai_messages == (
        {"role": "system", "content": result.final_system_prompt},
        {"role": "assistant", "content": "previous-answer"},
    )


def test_message_text_empty_string_is_not_appended():
    result = prompting._build_openai_messages_from_base_prompt(
        base_system_prompt="BASE",
        history=[SimpleNamespace(role="assistant", content="previous-answer")],
        route=None,
        emotional_priority=False,
        prompt_policy=prompting.PromptPolicy.NONE,
        message_text="",
    )

    assert len(result.openai_messages) == 2


def test_app_layers_are_added_outside_cached_base_prompt():
    result = prompting._build_openai_messages_from_base_prompt(
        base_system_prompt="BASE",
        history=[SimpleNamespace(role="assistant", content="history")],
        route=None,
        emotional_priority=False,
        prompt_policy=prompting.PromptPolicy.NONE,
        app_help_text="\n\n## 앱 기능 참고\n- 리포트: 설명",
        app_state_text="\n\n## 현재 확인된 앱 상태\n- 오늘 아직 안 적은 질문 수: 3",
        message_text="지금 뭐가 비어 있어?",
    )

    assert "## 앱 기능 참고" in result.final_system_prompt
    assert "## 현재 확인된 앱 상태" in result.final_system_prompt
    assert result.app_help_layer.endswith("리포트: 설명")
    assert "오늘 아직 안 적은 질문 수: 3" in result.app_state_layer
    assert result.openai_messages[-1] == {"role": "user", "content": "지금 뭐가 비어 있어?"}
