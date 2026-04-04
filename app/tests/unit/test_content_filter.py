"""콘텐츠 필터 단위 테스트 — 2축 판정 로직 검증.

핵심 테스트:
- 관용구 오탐 방지 ("배고파 죽겠다" → ALLOW)
- 진짜 위기 감지 ("죽고 싶다" → CRISIS_ESCALATE)
- 질문 vs 선언 구분 ("약을 끊으면 어떻게 되나요?" → ALLOW)
- 좌절감 + 긍정 제외 ("혈당이 잘 나왔어요" → ALLOW)
- 의료 화이트리스트 ("씹어서 드세요" → ALLOW)
"""

import pytest

from app.models.enums import FilterExpressionVerdict, FilterMedicalAction, MessageRoute
from app.services.content_filter import ContentFilterService, _normalize_text


@pytest.fixture
def service():
    """ContentFilterService 인스턴스 (테스트용)."""
    return ContentFilterService()


# ──────────────────────────────────────────────
# Unicode 정규화
# ──────────────────────────────────────────────


class TestNormalize:
    def test_zero_width_removal(self):
        assert _normalize_text("죽\u200b고 싶") == "죽고 싶"

    def test_nfkc_normalization(self):
        # 전각 문자 → 반각
        assert _normalize_text("Ａ") == "A"


# ──────────────────────────────────────────────
# 관용구 오탐 방지 (CRISIS 판정 취소)
# ──────────────────────────────────────────────


class TestIdiomFalsePositive:
    """관용구가 위기로 오탐되지 않는지 검증."""

    @pytest.mark.parametrize(
        "text",
        [
            "배고파 죽겠다",
            "힘들어 죽겠다",
            "더워 죽겠다",
            "살기 싫은 날씨네요",
            "혈당 관리에 목숨 거는 환자예요",
            "약 먹기 싫어 죽겠다 ㅋㅋ",
            "피곤해 죽겠어",
            "졸려 죽겠다",
            "짜증나 죽겠네",
            "인슐린 맞기 싫어 죽겠다",
        ],
    )
    def test_idiom_not_crisis(self, service, text):
        result = service.check_message(text)
        assert result.medical_action != FilterMedicalAction.CRISIS_ESCALATE, f"관용구 '{text}' 가 CRISIS 로 오탐됨"

    def test_news_about_suicide_not_crisis(self, service):
        result = service.check_message("자살 예방 상담전화 109번입니다")
        assert result.medical_action != FilterMedicalAction.CRISIS_ESCALATE

    def test_self_harm_prevention_not_crisis(self, service):
        result = service.check_message("자해 방지 프로그램에 대해 알려줘")
        assert result.medical_action != FilterMedicalAction.CRISIS_ESCALATE


# ──────────────────────────────────────────────
# 진짜 위기 감지
# ──────────────────────────────────────────────


class TestCrisisDetection:
    """진짜 위기 표현을 정확히 감지하는지 검증."""

    @pytest.mark.parametrize(
        "text",
        [
            "죽고 싶다",
            "다 끝내고 싶어",
            "차라리 죽는 게 낫겠다",
            "자살하고 싶다",
            "자해하고 싶어",
            "죽을래",
            "이 세상에 없었으면",
            "유서 쓰고 있어",
        ],
    )
    def test_genuine_crisis(self, service, text):
        result = service.check_message(text)
        assert result.medical_action == FilterMedicalAction.CRISIS_ESCALATE, f"진짜 위기 '{text}' 를 감지하지 못함"
        assert result.user_facing_message is not None
        assert "1393" in result.user_facing_message


# ──────────────────────────────────────────────
# MEDICAL_NOTE: 질문 vs 선언 구분
# ──────────────────────────────────────────────


class TestMedicalNote:
    """질문은 ALLOW, 선언은 MEDICAL_NOTE 로 구분하는지 검증."""

    @pytest.mark.parametrize(
        "text",
        [
            "약을 끊으면 어떻게 되나요?",
            "운동 쉬어도 되는 날 있어?",
            "약을 하루 빼먹었는데 어떡하지?",
            "감기약 중단해도 괜찮을까요?",
            "인슐린 안 맞으면 어떻게 되나요?",
        ],
    )
    def test_question_is_allow(self, service, text):
        result = service.check_message(text)
        assert result.medical_action != FilterMedicalAction.MEDICAL_NOTE, f"질문 '{text}' 가 MEDICAL_NOTE 로 오탐됨"

    @pytest.mark.parametrize(
        "text",
        [
            "약을 끊을 거예요",
            "운동 안 하겠어요",
            "인슐린 용량 줄이겠어요",
            "혈당 관리 안 할 거야",
        ],
    )
    def test_declaration_is_medical_note(self, service, text):
        result = service.check_message(text)
        assert result.medical_action == FilterMedicalAction.MEDICAL_NOTE, (
            f"선언 '{text}' 를 MEDICAL_NOTE 로 감지하지 못함"
        )
        assert result.prompt_instruction is not None


# ──────────────────────────────────────────────
# 건강 좌절감 (WARN) + 긍정 제외
# ──────────────────────────────────────────────


class TestHealthFrustration:
    """좌절감은 WARN, 긍정 표현은 ALLOW 로 구분하는지 검증."""

    @pytest.mark.parametrize(
        "text",
        [
            "혈당이 왜 이렇게 잘 나왔어요?",
            "힘들지만 노력해야 해요",
            "그래도 약은 계속 먹고 있어요",
        ],
    )
    def test_positive_is_allow(self, service, text):
        result = service.check_message(text)
        assert result.expression_verdict == FilterExpressionVerdict.ALLOW, f"긍정 '{text}' 가 WARN 으로 오탐됨"

    @pytest.mark.parametrize(
        "text",
        [
            "혈당 짜증나 왜 이래",
            "당뇨약 먹기 귀찮아",
            "당뇨 지겹다",
        ],
    )
    def test_frustration_is_warn(self, service, text):
        result = service.check_message(text)
        assert result.expression_verdict == FilterExpressionVerdict.WARN, f"좌절감 '{text}' 를 WARN 으로 감지하지 못함"
        assert result.prompt_instruction is not None


# ──────────────────────────────────────────────
# 의료 화이트리스트
# ──────────────────────────────────────────────


class TestWhitelist:
    """의료 용어가 욕설로 오탐되지 않는지 검증."""

    @pytest.mark.parametrize(
        "text",
        [
            "씹어서 드세요",
            "개인 사정으로 못 갔어요",
            "혈당 수치가 높아요",
            "유방암 검사를 받았어요",
        ],
    )
    def test_medical_terms_not_blocked(self, service, text):
        result = service.check_message(text)
        assert result.expression_verdict != FilterExpressionVerdict.BLOCK, f"의료 용어 '{text}' 가 BLOCK 으로 오탐됨"


# ──────────────────────────────────────────────
# 표현축 — 욕설 판정
# ──────────────────────────────────────────────


class TestProfanityDetection:
    """욕설 감지 + 심각도 판정."""

    def test_clean_message_is_allow(self, service):
        result = service.check_message("오늘 혈당이 좀 높게 나왔어요")
        assert result.expression_verdict == FilterExpressionVerdict.ALLOW

    def test_normal_greeting_is_allow(self, service):
        result = service.check_message("안녕하세요 오늘 기분이 좋아요")
        assert result.expression_verdict == FilterExpressionVerdict.ALLOW


# ──────────────────────────────────────────────
# 판정 우선순위
# ──────────────────────────────────────────────


class TestPriority:
    """CRISIS > BLOCK > MEDICAL_NOTE > WARN > ALLOW 우선순위 검증."""

    def test_crisis_overrides_all(self, service):
        """위기 의도가 있으면 다른 판정보다 우선."""
        result = service.check_message("죽고 싶다")
        assert result.medical_action == FilterMedicalAction.CRISIS_ESCALATE
        assert result.user_facing_message is not None


# ──────────────────────────────────────────────
# 메시지 라우팅 분류
# ──────────────────────────────────────────────


@pytest.fixture
def routing_service(monkeypatch):
    """ROUTING_ENABLED=True인 ContentFilterService 인스턴스."""
    monkeypatch.setenv("CONTENT_FILTER_ROUTING_ENABLED", "true")
    return ContentFilterService()


class TestRoutingSpecific:
    """HEALTH_SPECIFIC 분류 검증."""

    @pytest.mark.parametrize(
        "text",
        [
            "혈당이 130이에요",
            "당뇨약 먹고 있어요",
            "인슐린 용량이 걱정돼",
        ],
    )
    def test_specific_route(self, routing_service, text):
        result = routing_service.check_message(text)
        assert result.message_route == MessageRoute.HEALTH_SPECIFIC, f"'{text}' → expected HEALTH_SPECIFIC"
        assert result.emotional_priority is False


class TestRoutingGeneral:
    """HEALTH_GENERAL 분류 검증."""

    @pytest.mark.parametrize(
        "text",
        [
            "혈당이 왜 올라가?",
            "식단 관리 어떻게 해?",
            "운동하면 혈당이 떨어져?",
        ],
    )
    def test_general_route(self, routing_service, text):
        result = routing_service.check_message(text)
        assert result.message_route == MessageRoute.HEALTH_GENERAL, f"'{text}' → expected HEALTH_GENERAL"
        assert result.emotional_priority is False


class TestRoutingLifestyle:
    """LIFESTYLE_CHAT 분류 검증."""

    @pytest.mark.parametrize(
        "text",
        [
            "안녕",
            "오늘 날씨 좋다",
            "밥 먹었어?",
        ],
    )
    def test_lifestyle_route(self, routing_service, text):
        result = routing_service.check_message(text)
        assert result.message_route == MessageRoute.LIFESTYLE_CHAT, f"'{text}' → expected LIFESTYLE_CHAT"
        assert result.emotional_priority is False


class TestRoutingEmotional:
    """emotional_priority 분류 검증."""

    @pytest.mark.parametrize(
        "text,expected_route",
        [
            ("요즘 너무 우울해", MessageRoute.LIFESTYLE_CHAT),
            ("너무 불안해", MessageRoute.LIFESTYLE_CHAT),
        ],
    )
    def test_pure_emotional(self, routing_service, text, expected_route):
        result = routing_service.check_message(text)
        assert result.message_route == expected_route, f"'{text}' → expected {expected_route}"
        assert result.emotional_priority is True


class TestRoutingMixed:
    """혼합 메시지 — route + emotional 동시 검증 (핵심 시나리오)."""

    def test_specific_with_emotional(self, routing_service):
        """혈당 수치 + 불안 → HEALTH_SPECIFIC + emotional=True."""
        result = routing_service.check_message("혈당 130인데 너무 불안해")
        assert result.message_route == MessageRoute.HEALTH_SPECIFIC
        assert result.emotional_priority is True

    def test_general_with_emotional(self, routing_service):
        """운동 + 힘듦 → HEALTH_GENERAL + emotional=True."""
        result = routing_service.check_message("운동했는데 너무 힘들어")
        assert result.message_route == MessageRoute.HEALTH_GENERAL
        assert result.emotional_priority is True

    def test_medication_with_emotional(self, routing_service):
        """약 미복용 + 우울 → HEALTH_SPECIFIC + emotional=True."""
        result = routing_service.check_message("우울한데 약도 안 먹었어")
        assert result.message_route == MessageRoute.HEALTH_SPECIFIC
        assert result.emotional_priority is True


class TestRoutingFalsePositive:
    """오탐 방지 검증."""

    @pytest.mark.parametrize(
        "text",
        [
            "살짝 늦었어",
            "물어봐도 돼?",
            "오늘 날씨 좋다",
        ],
    )
    def test_no_false_positive(self, routing_service, text):
        result = routing_service.check_message(text)
        assert result.message_route == MessageRoute.LIFESTYLE_CHAT, f"'{text}' → expected LIFESTYLE_CHAT"
        assert result.emotional_priority is False


class TestRoutingFeatureFlagOff:
    """feature flag off 시 기존 동작 유지."""

    def test_flag_off_returns_none(self, service):
        """ROUTING_ENABLED=False(기본) → route=None, emotional=False."""
        result = service.check_message("혈당이 130이에요")
        assert result.message_route is None
        assert result.emotional_priority is False

    def test_existing_tests_unaffected(self, service):
        """기존 2축 판정이 영향받지 않는지 확인."""
        result = service.check_message("죽고 싶다")
        assert result.medical_action == FilterMedicalAction.CRISIS_ESCALATE
        assert result.message_route is None
