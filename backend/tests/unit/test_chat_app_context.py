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
    assert "오늘 첫 질문" in layer


def test_help_layer_includes_answer_frame_rules():
    context = ChatAppContext(
        intent=ChatAppIntent.REPORT_HELP,
        help_snapshot=build_default_help_snapshot(),
    )

    layer = build_app_help_layer(context)

    assert "## 앱 질문 답변 방식" in layer
    assert "다나아 안에서 어떤 화면과 역할인지" in layer
    assert "상태가 없으면 값을 추측하지 말고" in layer


def test_state_layer_uses_safe_fallback_when_live_state_is_missing():
    context = ChatAppContext(
        intent=ChatAppIntent.PENDING_SURVEYS,
        help_snapshot=build_default_help_snapshot(),
        state_snapshot=None,
        has_live_state=False,
    )

    layer = build_app_state_layer(context)

    assert "현재 확인된 상태로는 정확한 값을 알 수 없어요" in layer
    assert "없는 숫자, 개수, 진행률을 추측하지 말고" in layer


def test_state_layer_formats_live_state_and_explains_pending_card_reason():
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
                    name="아침 걷기",
                    progress_pct=50.0,
                    today_checked=False,
                    current_streak=3,
                ),
            ),
            pending_count=2,
            pending_question_labels=("아침 식사 여부", "기분 상태"),
            pending_bundle_names=("아침 식사", "기분과 음주"),
            card_is_available=False,
            card_blocked_reason="daily_reset_wait",
            card_blocked_reason_text="새날 첫 설문은 새벽 4시부터 시작돼요.",
        ),
        has_live_state=True,
    )

    layer = build_app_state_layer(context)

    assert "[리포트 현재 상태]" in layer
    assert "[챌린지 현재 상태]" in layer
    assert "[오늘 아직 안 적은 질문 상태]" in layer
    assert "아침 걷기: 진행률 50.0%, 오늘 체크 필요, 현재 스트릭 3일" in layer
    assert "오늘 아직 안 적은 질문 수: 2" in layer
    assert "카드가 바로 안 보이는 이유: 새날 첫 설문은 새벽 4시부터 시작돼요." in layer
    assert "남아 있는 질문 묶음: 아침 식사, 기분과 음주" in layer
    assert "아침 식사 여부" not in layer
    assert "기분 상태" not in layer


# ─── 신규 intent 5종: 섹션 매핑 확인 ────────────────────────────────────


def test_help_layer_right_panel_intent():
    context = ChatAppContext(
        intent=ChatAppIntent.RIGHT_PANEL_HELP,
        help_snapshot=build_default_help_snapshot(),
    )
    layer = build_app_help_layer(context)
    assert "- 우측 Today 패널:" in layer
    # 다른 섹션은 포함되지 않아야 함
    assert "- 채팅:" not in layer
    assert "- 리포트:" not in layer


def test_help_layer_sidebar_intent():
    context = ChatAppContext(
        intent=ChatAppIntent.SIDEBAR_HELP,
        help_snapshot=build_default_help_snapshot(),
    )
    layer = build_app_help_layer(context)
    assert "- 사이드바:" in layer
    assert "왼쪽" in layer or "새 대화" in layer


def test_help_layer_settings_intent_mentions_password():
    context = ChatAppContext(
        intent=ChatAppIntent.SETTINGS_HELP,
        help_snapshot=build_default_help_snapshot(),
    )
    layer = build_app_help_layer(context)
    assert "- 설정:" in layer
    assert "비밀번호" in layer or "테마" in layer


def test_help_layer_onboarding_intent():
    context = ChatAppContext(
        intent=ChatAppIntent.ONBOARDING_HELP,
        help_snapshot=build_default_help_snapshot(),
    )
    layer = build_app_help_layer(context)
    assert "- 온보딩:" in layer


def test_help_layer_missed_modal_intent():
    context = ChatAppContext(
        intent=ChatAppIntent.MISSED_MODAL_HELP,
        help_snapshot=build_default_help_snapshot(),
    )
    layer = build_app_help_layer(context)
    assert "- 미응답 모달:" in layer
    assert "어제" in layer or "그제" in layer or "오늘" in layer


# ─── 길이 제한 ─────────────────────────────────────────────────────────


def test_help_layer_single_intent_within_1500_chars():
    context = ChatAppContext(
        intent=ChatAppIntent.RIGHT_PANEL_HELP,
        help_snapshot=build_default_help_snapshot(),
    )
    layer = build_app_help_layer(context)
    assert len(layer) <= 1500, f"단일 intent help_layer가 1500자 초과: {len(layer)}"


def test_help_layer_mixed_intent_within_2200_chars():
    context = ChatAppContext(
        intent=ChatAppIntent.MIXED,
        help_snapshot=build_default_help_snapshot(),
    )
    layer = build_app_help_layer(context)
    assert len(layer) <= 2200, f"MIXED help_layer가 2200자 초과: {len(layer)}"


# ─── 기존 호환성 ────────────────────────────────────────────────────────


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
