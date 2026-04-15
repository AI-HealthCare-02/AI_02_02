"""Rule-based intent detection for product-aware chat questions."""

from __future__ import annotations

import re

from backend.services.chat.app_context import ChatAppIntent

_SPACE_RE = re.compile(r"\s+")

_CHAT_HELP_KEYWORDS = (
    "채팅",
    "기록 카드",
    "카드로 기록",
    "본문 카드",
    "답변 아래 카드",
    "기록은 어디서 남겨",
    "어디에 써",
    "오른쪽 패널",
    "오른쪽",
    "사이드 패널",
    "사이드",
    "패널",
    "오늘의 브리핑",
    "오늘의 카드",
)
_REPORT_KEYWORDS = (
    "리포트",
    "레포트",
    "건강 요약",
    "초기 요약",
    "상세 리포트",
    "어디서 봐",
    "무슨 기능",
    "뭐부터",
    "얼마나 봐야",
)
_CHALLENGE_KEYWORDS = (
    "챌린지",
    "목표 달성",
    "습관 들이기",
    "연속 기록",
    "스트릭",
    "오늘 체크",
    "진행률",
    "진행 중인 챌린지",
)
_PENDING_KEYWORDS = (
    "누락된 설문",
    "미답변 질문",
    "답 안 한",
    "기록 빠진",
    "못 적은",
    "작성 안 된",
    "남은 질문",
    "뭐가 비어 있어",
    "오늘 뭐가 비어 있어",
)
_STATE_KEYWORDS = (
    "현재",
    "지금",
    "내 상태",
    "내 정보",
    "최근 현황",
    "해야 하는",
    "해야 되는",
    "뭐 해야",
    "해야 될",
    "내가 해야",
    "몇 개",
    "몇개",
    "남았어",
    "남아 있어",
    "진행 중",
)
_REPORT_GUIDE_PATTERNS = (
    "리포트는 얼마나 봐야",
    "리포트 얼마나 봐야",
    "리포트 자주",
)
_REPORT_HELP_PATTERNS = (
    "리포트에 어떤 기능",
    "리포트 기능",
    "리포트 뭐가 있어",
)


def _normalize(message: str) -> str:
    return _SPACE_RE.sub(" ", message.strip().lower())


def classify_chat_app_intent(message: str) -> ChatAppIntent:
    text = _normalize(message)
    if not text:
        return ChatAppIntent.NONE

    report_related = any(keyword in text for keyword in _REPORT_KEYWORDS)
    challenge_related = any(keyword in text for keyword in _CHALLENGE_KEYWORDS)
    pending_related = any(keyword in text for keyword in _PENDING_KEYWORDS)
    chat_related = any(keyword in text for keyword in _CHAT_HELP_KEYWORDS)
    asks_state = any(keyword in text for keyword in _STATE_KEYWORDS)
    asks_report_guide = any(pattern in text for pattern in _REPORT_GUIDE_PATTERNS)
    asks_report_help = any(pattern in text for pattern in _REPORT_HELP_PATTERNS)

    related_domains = sum(
        1
        for flag in (
            report_related or asks_report_help or asks_report_guide,
            challenge_related,
            pending_related,
            chat_related,
        )
        if flag
    )
    if related_domains >= 2:
        return ChatAppIntent.MIXED

    if pending_related:
        return ChatAppIntent.PENDING_SURVEYS
    if report_related or asks_report_help or asks_report_guide:
        if asks_report_help or asks_report_guide:
            return ChatAppIntent.REPORT_HELP
        return ChatAppIntent.REPORT_STATE if asks_state else ChatAppIntent.REPORT_HELP
    if challenge_related:
        return ChatAppIntent.CHALLENGE_STATE if asks_state else ChatAppIntent.CHALLENGE_HELP
    if chat_related:
        return ChatAppIntent.CHAT_HELP
    return ChatAppIntent.NONE
