"""Routing-related structural tests for chat prompt instructions."""

from backend.models.enums import (
    FilterExpressionVerdict,
    FilterMedicalAction,
    MessageRoute,
)
from backend.services.chat import (
    EMOTIONAL_INSTRUCTION,
    ROUTE_INSTRUCTIONS,
)
from backend.services.content_filter import FilterResult
from backend.services.content_filter_reason_codes import FilterReasonCode


class TestRouteInstructions:
    def test_specific_instruction_exists(self):
        assert MessageRoute.HEALTH_SPECIFIC in ROUTE_INSTRUCTIONS
        assert "구체적인 건강 수치" in ROUTE_INSTRUCTIONS[MessageRoute.HEALTH_SPECIFIC]

    def test_general_has_no_instruction(self):
        assert MessageRoute.HEALTH_GENERAL not in ROUTE_INSTRUCTIONS

    def test_lifestyle_has_no_instruction(self):
        assert MessageRoute.LIFESTYLE_CHAT not in ROUTE_INSTRUCTIONS

    def test_emotional_instruction_content(self):
        assert "공감" in EMOTIONAL_INSTRUCTION
        assert "건강 관련 질문" in EMOTIONAL_INSTRUCTION


class TestFilterResultCompat:
    def test_default_values(self):
        result = FilterResult(
            expression_verdict=FilterExpressionVerdict.ALLOW,
            medical_action=FilterMedicalAction.NONE,
        )
        assert result.message_route is None
        assert result.emotional_priority is False

    def test_with_route_and_emotional(self):
        result = FilterResult(
            expression_verdict=FilterExpressionVerdict.ALLOW,
            medical_action=FilterMedicalAction.NONE,
            message_route=MessageRoute.HEALTH_SPECIFIC,
            emotional_priority=True,
        )
        assert result.message_route == MessageRoute.HEALTH_SPECIFIC
        assert result.emotional_priority is True

    def test_crisis_result_compat(self):
        result = FilterResult(
            expression_verdict=FilterExpressionVerdict.ALLOW,
            medical_action=FilterMedicalAction.CRISIS_ESCALATE,
            reason_codes=[FilterReasonCode.CRISIS_INTENT],
            user_facing_message="위기 응답",
            prompt_instruction=None,
        )
        assert result.message_route is None
        assert result.emotional_priority is False


class TestNoExposure:
    def test_done_data_has_no_route(self):
        from backend.services.chat import ChatService

        svc = ChatService()
        data = svc._build_done_data(session_id=1, eligible_bundles=[])
        assert "message_route" not in data
        assert "emotional_priority" not in data

    def test_done_data_with_bundles_has_no_route(self):
        from backend.services.chat import ChatService

        svc = ChatService()
        data = svc._build_done_data(session_id=1, eligible_bundles=["bundle_1"])
        assert "message_route" not in data
        assert "emotional_priority" not in data
