from backend.services.chat.app_context import ChatAppIntent
from backend.services.chat.intent import classify_chat_app_intent


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
