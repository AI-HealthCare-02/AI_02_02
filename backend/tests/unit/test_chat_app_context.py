from backend.core.logger import _redact_app_context
from backend.services.chat.app_context import (
    ChatAppChallengeStateItem,
    ChatAppContext,
    ChatAppIntent,
    ChatAppStateSnapshot,
    build_app_help_layer,
    build_app_state_layer,
    build_default_help_snapshot,
)


def test_help_layer_uses_pending_help_for_pending_questions():
    context = ChatAppContext(
        intent=ChatAppIntent.PENDING_SURVEYS,
        help_snapshot=build_default_help_snapshot(),
    )

    layer = build_app_help_layer(context)

    assert "## 앱 기능 참고" in layer
    assert "- 오늘 기록:" in layer
    assert "- 채팅:" not in layer
    assert "답변 아래 카드" in layer


def test_help_layer_includes_answer_frame_rules():
    context = ChatAppContext(
        intent=ChatAppIntent.REPORT_HELP,
        help_snapshot=build_default_help_snapshot(),
    )

    layer = build_app_help_layer(context)

    assert "## 앱 질문 답변 방식" in layer
    assert "먼저 질문에 바로 답하세요." in layer
    assert "상태가 없으면 값을 추측하지 말고" in layer


def test_state_layer_uses_safe_fallback_when_live_state_is_missing():
    context = ChatAppContext(
        intent=ChatAppIntent.PENDING_SURVEYS,
        help_snapshot=build_default_help_snapshot(),
        state_snapshot=None,
        has_live_state=False,
    )

    layer = build_app_state_layer(context)

    assert "현재 확인된 상태로는 정확한 값을 알 수 없어요." in layer
    assert "숫자, 개수, 진행률을 추측하지 말고" in layer


def test_state_layer_formats_live_state_and_hides_pending_labels():
    context = ChatAppContext(
        intent=ChatAppIntent.MIXED,
        help_snapshot=build_default_help_snapshot(),
        state_snapshot=ChatAppStateSnapshot(
            onboarding_completed=True,
            user_group="B",
            initial_risk_level="moderate",
            active_count=1,
            remaining_active_slots=1,
            active_challenges=(
                ChatAppChallengeStateItem(
                    name="아침 산책",
                    progress_pct=50.0,
                    today_checked=False,
                    current_streak=3,
                ),
            ),
            pending_count=2,
            pending_question_labels=("아침 식사 여부", "기분 상태"),
            pending_bundle_names=("아침 식사", "기분과 음주"),
        ),
        has_live_state=True,
    )

    layer = build_app_state_layer(context)

    assert "[리포트 현재 상태]" in layer
    assert "[챌린지 현재 상태]" in layer
    assert "[오늘 아직 안 적은 질문 상태]" in layer
    assert "아침 산책: 진행률 50.0%, 오늘 체크 필요, 현재 스트릭 3일" in layer
    assert "오늘 아직 안 적은 질문 수: 2" in layer
    assert "아침 식사 여부" not in layer
    assert "기분 상태" not in layer
    assert "기분과 음주" not in layer


def test_logger_redacts_app_context_fields():
    event = {
        "message": "test",
        "app_help_text": "raw help",
        "app_state_text": "raw state",
        "state_snapshot": {"pending_count": 3},
    }

    redacted = _redact_app_context(None, None, event)

    assert redacted["app_help_text"] == "<redacted>"
    assert redacted["app_state_text"] == "<redacted>"
    assert redacted["state_snapshot"] == "<redacted>"
