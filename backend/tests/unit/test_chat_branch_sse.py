"""send_message_stream early-return/SSE branch regression tests."""

import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from backend.models.enums import FilterExpressionVerdict, FilterMedicalAction
from backend.services.chat import ChatService, _sse_event
from backend.services.content_filter import FilterResult
from backend.services.content_filter_reason_codes import FilterReasonCode


def _parse_sse(payload: str) -> tuple[str, dict]:
    lines = payload.strip().splitlines()
    assert len(lines) >= 2
    assert lines[0].startswith("event: ")
    assert lines[1].startswith("data: ")
    return lines[0][7:], json.loads(lines[1][6:])


async def _collect_events(service: ChatService) -> list[str]:
    return [
        event
        async for event in service.send_message_stream(
            user_id=1,
            message="테스트 메시지",
            session_id=None,
        )
    ]


class TestChatBranchSse:
    def _service(self) -> ChatService:
        return ChatService()

    def test_crisis_branch_passthrough(self):
        service = self._service()
        service._validate_request = AsyncMock(return_value=None)
        service._validate_chat_access = AsyncMock(return_value=(None, None))
        service._build_openai_messages = AsyncMock(side_effect=AssertionError("crisis should not build messages"))
        service._stream_openai = AsyncMock(side_effect=AssertionError("crisis should not stream openai"))
        service.content_filter.check_message = Mock(
            return_value=FilterResult(
                expression_verdict=FilterExpressionVerdict.ALLOW,
                medical_action=FilterMedicalAction.CRISIS_ESCALATE,
                reason_codes=[FilterReasonCode.CRISIS_INTENT],
                user_facing_message="위기 응답",
            )
        )

        async def fake_handle_crisis(*args, **kwargs):
            del args, kwargs
            yield _sse_event("token", {"content": "위기 응답"})
            yield _sse_event("done", {"session_id": 99})

        service._handle_crisis = fake_handle_crisis
        service._prepare_session = AsyncMock(side_effect=AssertionError("crisis should short-circuit"))

        events = asyncio.run(_collect_events(service))

        assert events == [
            _sse_event("token", {"content": "위기 응답"}),
            _sse_event("done", {"session_id": 99}),
        ]

    @pytest.mark.parametrize(
        ("name", "filter_result", "consent_error", "expected_event", "expected_code"),
        [
            (
                "block",
                FilterResult(
                    expression_verdict=FilterExpressionVerdict.BLOCK,
                    medical_action=FilterMedicalAction.NONE,
                    user_facing_message="차단 메시지",
                ),
                None,
                "error",
                "content_blocked",
            ),
            (
                "consent_declined",
                FilterResult(
                    expression_verdict=FilterExpressionVerdict.ALLOW,
                    medical_action=FilterMedicalAction.NONE,
                ),
                "AI 동의 필요",
                "error",
                "ai_consent_required",
            ),
        ],
    )
    def test_early_exit_error_branches(
        self,
        name: str,
        filter_result: FilterResult,
        consent_error: str | None,
        expected_event: str,
        expected_code: str,
    ):
        service = self._service()
        service._validate_request = AsyncMock(return_value=None)
        service._validate_chat_access = AsyncMock(return_value=(None, consent_error))
        service.content_filter.check_message = Mock(return_value=filter_result)
        service._build_openai_messages = AsyncMock(side_effect=AssertionError(f"{name} should not build messages"))
        service._stream_openai = AsyncMock(side_effect=AssertionError(f"{name} should not stream openai"))
        service._prepare_session = AsyncMock(side_effect=AssertionError(f"{name} should short-circuit"))

        events = asyncio.run(_collect_events(service))

        assert len(events) == 1
        event_type, data = _parse_sse(events[0])
        assert event_type == expected_event
        assert data["code"] == expected_code
        service._build_openai_messages.assert_not_called()
        service._stream_openai.assert_not_called()

    def test_stream_failure_branch_emits_error(self, monkeypatch: pytest.MonkeyPatch):
        service = self._service()
        service._validate_request = AsyncMock(return_value=None)
        service._validate_chat_access = AsyncMock(return_value=(None, None))
        service.content_filter.check_message = Mock(
            return_value=FilterResult(
                expression_verdict=FilterExpressionVerdict.ALLOW,
                medical_action=FilterMedicalAction.NONE,
            )
        )
        service._prepare_session = AsyncMock(return_value=SimpleNamespace(id=7))
        service.health_question_service.get_eligible_bundles = AsyncMock(return_value=[])
        service._build_openai_messages = AsyncMock(return_value=[{"role": "system", "content": "stub"}])
        service._save_response = AsyncMock()

        async def fake_stream(_messages):
            yield None

        service._stream_openai = fake_stream

        create_mock = AsyncMock()

        class _HistoryQuery:
            def order_by(self, *_args, **_kwargs):
                return self

            def limit(self, *_args, **_kwargs):
                return self

            async def all(self):
                return []

        monkeypatch.setattr("backend.services.chat.service.ChatMessage.create", create_mock)
        monkeypatch.setattr("backend.services.chat.service.ChatMessage.filter", lambda *args, **kwargs: _HistoryQuery())

        events = asyncio.run(_collect_events(service))

        assert len(events) == 1
        event_type, data = _parse_sse(events[0])
        assert event_type == "error"
        assert "message" in data
        create_mock.assert_awaited_once()
        service._save_response.assert_not_called()
