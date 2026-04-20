import pytest

from backend.services.chat.app_context import ChatAppIntent
from backend.services.chat.intent import classify_chat_app_intent, select_app_state_domains


def test_classify_chat_help():
    assert classify_chat_app_intent("채팅에서 기록은 어떻게 남겨?") == ChatAppIntent.CHAT_HELP


def test_classify_report_help():
    assert classify_chat_app_intent("리포트에 어떤 기능이 있어?") == ChatAppIntent.REPORT_HELP


def test_classify_pending_surveys():
    assert classify_chat_app_intent("현재 누락된 설문은 몇 개야?") == ChatAppIntent.PENDING_SURVEYS


def test_classify_challenge_state():
    assert classify_chat_app_intent("챌린지에서 내가 해야 되는 건 뭐야?") == ChatAppIntent.CHALLENGE_STATE


def test_classify_mixed_question():
    assert classify_chat_app_intent("리포트랑 챌린지 둘 다 설명해줘") == ChatAppIntent.MIXED


def test_classify_new_ui_phrases_for_pending():
    assert classify_chat_app_intent("오늘 뭐가 비어 있어?") == ChatAppIntent.PENDING_SURVEYS


def test_classify_new_ui_phrases_for_report():
    assert classify_chat_app_intent("리포트 뭐부터 보면 돼?") == ChatAppIntent.REPORT_HELP


def test_classify_new_ui_phrases_for_chat_help():
    assert classify_chat_app_intent("기록은 어디서 남겨?") == ChatAppIntent.CHAT_HELP


# ─── 신규 intent 5종 분류 ──────────────────────────────────────────────


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("오른쪽 패널이 뭐야? 어떻게 써?", ChatAppIntent.RIGHT_PANEL_HELP),
        ("Today 패널에는 뭐가 있어?", ChatAppIntent.RIGHT_PANEL_HELP),
        ("우측 패널 카드들 설명해줘", ChatAppIntent.RIGHT_PANEL_HELP),
        ("미응답 모달에 오늘이 왜 없어?", ChatAppIntent.MISSED_MODAL_HELP),
        ("놓친 질문은 어디서 입력해?", ChatAppIntent.MISSED_MODAL_HELP),
        ("사이드바 메뉴 구성이 어떻게 돼?", ChatAppIntent.SIDEBAR_HELP),
        ("새 대화 버튼은 뭐야?", ChatAppIntent.SIDEBAR_HELP),
        ("설정에서 비밀번호 바꿀 수 있어?", ChatAppIntent.SETTINGS_HELP),
        ("알림 설정 어떻게 해?", ChatAppIntent.SETTINGS_HELP),
        ("테마 바꾸려면 어디로?", ChatAppIntent.SETTINGS_HELP),
        ("온보딩 다시 할 수 있어?", ChatAppIntent.ONBOARDING_HELP),
        ("초기 설문 다시 하고 싶어", ChatAppIntent.ONBOARDING_HELP),
    ],
)
def test_classify_new_help_intents(message: str, expected: ChatAppIntent) -> None:
    assert classify_chat_app_intent(message) == expected


# ─── fallback: UI 단어 + 의문사 조합만 CHAT_HELP로 승격 ──────────────────


@pytest.mark.parametrize(
    "message",
    [
        "이 앱은 어떻게 쓰는 거야?",
        "화면에 버튼이 뭐야?",
        "이 기능 왜 있어?",
    ],
)
def test_fallback_ui_word_with_question_promotes(message: str) -> None:
    assert classify_chat_app_intent(message) == ChatAppIntent.CHAT_HELP


# ─── fallback negative: 일반 건강/의료/날씨 질문은 NONE 유지 ──────────────


@pytest.mark.parametrize(
    "message",
    [
        "오늘 저녁 뭐 먹으면 좋아?",
        "잠을 잘 못 자는데 어떻게 해?",
        "당뇨에 좋은 음식 알려줘",
        "내일 서울 날씨 어때?",
        "혈압약 부작용 있어?",
        "운동 30분 하면 충분해?",
        "스트레스 받을 때 뭐 하면 좋아?",
        "아침 식사 꼭 먹어야 해?",
        "다이어트 방법 추천해줘",
        "고혈압 예방하려면 어떻게 해야 해?",
    ],
)
def test_fallback_does_not_promote_general_health(message: str) -> None:
    assert classify_chat_app_intent(message) == ChatAppIntent.NONE


# ─── select_app_state_domains ──────────────────────────────────────────


def test_state_domains_help_intent_returns_empty():
    # HELP intent는 DB 조회 필요 없음
    assert select_app_state_domains("오른쪽 패널 뭐야?", ChatAppIntent.RIGHT_PANEL_HELP) == []
    assert select_app_state_domains("사이드바가 뭐야?", ChatAppIntent.SIDEBAR_HELP) == []
    assert select_app_state_domains("챌린지 최대 몇 개까지?", ChatAppIntent.CHALLENGE_HELP) == []


def test_state_domains_single_state_intents():
    assert select_app_state_domains("지금 챌린지 몇 개 진행 중?", ChatAppIntent.CHALLENGE_STATE) == ["challenge"]
    assert select_app_state_domains("지금 남은 질문 수", ChatAppIntent.PENDING_SURVEYS) == ["pending"]
    assert select_app_state_domains("현재 내 위험도 얼마야?", ChatAppIntent.REPORT_STATE) == ["report"]


def test_state_domains_mixed_help_question_no_query():
    # "리포트랑 챌린지 설명해줘" — state 키워드(지금/현재/몇 개) 없음 → 빈 배열
    assert select_app_state_domains("리포트랑 챌린지 설명해줘", ChatAppIntent.MIXED) == []


def test_state_domains_mixed_with_state_words():
    # MIXED + 지금/몇 개 + 챌린지·미응답 모두 있음
    domains = select_app_state_domains(
        "지금 챌린지 몇 개 진행 중이고 미응답 남은 질문은 얼마나 돼?",
        ChatAppIntent.MIXED,
    )
    assert "challenge" in domains
    assert "pending" in domains


def test_state_domains_mixed_with_one_state_area():
    # "지금 챌린지 몇 개?" + report 키워드 없음 → challenge만
    domains = select_app_state_domains("지금 챌린지 몇 개 진행 중이야?", ChatAppIntent.MIXED)
    assert domains == ["challenge"]
