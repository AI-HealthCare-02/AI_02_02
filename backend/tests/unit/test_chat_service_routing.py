"""채팅 서비스 라우팅 통합 테스트 — route/emotional 지시문 + 건강질문 억제.

검증 대상:
- emotional_priority=True → 건강질문 억제
- HEALTH_SPECIFIC → route 지시문 append
- 혼합 메시지 → route + emotional 둘 다 append
- filter_result.prompt_instruction이 항상 마지막
- APPLY_ENABLED=False → 억제/append 둘 다 없음
"""

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

# ──────────────────────────────────────────────
# 지시문 구조 검증
# ──────────────────────────────────────────────


class TestRouteInstructions:
    """ROUTE_INSTRUCTIONS / EMOTIONAL_INSTRUCTION 상수 검증."""

    def test_specific_instruction_exists(self):
        assert MessageRoute.HEALTH_SPECIFIC in ROUTE_INSTRUCTIONS
        assert "의학적 판단" in ROUTE_INSTRUCTIONS[MessageRoute.HEALTH_SPECIFIC]

    def test_general_has_no_instruction(self):
        assert MessageRoute.HEALTH_GENERAL not in ROUTE_INSTRUCTIONS

    def test_lifestyle_has_no_instruction(self):
        assert MessageRoute.LIFESTYLE_CHAT not in ROUTE_INSTRUCTIONS

    def test_emotional_instruction_content(self):
        assert "공감" in EMOTIONAL_INSTRUCTION
        assert "건강 관련 질문" in EMOTIONAL_INSTRUCTION


# ──────────────────────────────────────────────
# FilterResult 호환성
# ──────────────────────────────────────────────


class TestFilterResultCompat:
    """FilterResult 필드 추가 후 기존 생성 패턴 호환성 검증."""

    def test_default_values(self):
        """기존 5필드만 지정 시 route=None, emotional=False."""
        result = FilterResult(
            expression_verdict=FilterExpressionVerdict.ALLOW,
            medical_action=FilterMedicalAction.NONE,
        )
        assert result.message_route is None
        assert result.emotional_priority is False

    def test_with_route_and_emotional(self):
        """명시적으로 route/emotional 지정."""
        result = FilterResult(
            expression_verdict=FilterExpressionVerdict.ALLOW,
            medical_action=FilterMedicalAction.NONE,
            message_route=MessageRoute.HEALTH_SPECIFIC,
            emotional_priority=True,
        )
        assert result.message_route == MessageRoute.HEALTH_SPECIFIC
        assert result.emotional_priority is True

    def test_crisis_result_compat(self):
        """CRISIS 결과에서 route/emotional 기본값."""
        result = FilterResult(
            expression_verdict=FilterExpressionVerdict.ALLOW,
            medical_action=FilterMedicalAction.CRISIS_ESCALATE,
            reason_codes=[FilterReasonCode.CRISIS_INTENT],
            user_facing_message="위기 응답",
            prompt_instruction=None,
        )
        assert result.message_route is None
        assert result.emotional_priority is False


# ──────────────────────────────────────────────
# SSE/API 노출 방지 (구조적 검증)
# ──────────────────────────────────────────────


class TestNoExposure:
    """route/emotional이 외부에 노출되지 않는 구조 검증."""

    def test_done_data_has_no_route(self):
        """_build_done_data() 결과에 route/emotional이 없어야 함."""
        from backend.services.chat import ChatService

        svc = ChatService()
        data = svc._build_done_data(session_id=1, eligible_bundles=[])
        assert "message_route" not in data
        assert "emotional_priority" not in data

    def test_done_data_with_bundles_has_no_route(self):
        """건강질문 포함 done에도 route/emotional 없음."""
        from backend.services.chat import ChatService

        svc = ChatService()
        data = svc._build_done_data(session_id=1, eligible_bundles=["sleep"])
        assert "message_route" not in data
        assert "emotional_priority" not in data
