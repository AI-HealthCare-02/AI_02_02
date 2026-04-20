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
    "오늘의 브리핑",
    "오늘의 카드",
    "대화 카드",
    "수면 카드",
    "식사 카드",
    "복약 카드",
    "운동 카드",
    "수분 카드",
    "기분 카드",
    "음주 카드",
)
_RIGHT_PANEL_KEYWORDS = (
    "오른쪽 패널",
    "오른쪽",
    "사이드 패널",
    "우측 패널",
    "우측 카드",
    "today 패널",
    "오늘 패널",
    "우측 today",
)
_MISSED_MODAL_KEYWORDS = (
    "미응답 모달",
    "놓친 질문",
    "어제 기록",
    "그제 기록",
    "최근 3일",
    "미응답 버튼",
    "놓친 기록",
    "지난 기록 입력",
)
_SIDEBAR_KEYWORDS = (
    "사이드바",
    "왼쪽 메뉴",
    "왼쪽 사이드",
    "새 대화 버튼",
    "대화 목록",
    "좌측 메뉴",
    "좌측 패널",
)
_SETTINGS_KEYWORDS = (
    "설정 페이지",
    "설정 탭",
    "설정에서",
    "비밀번호 변경",
    "비밀번호 바꾸",
    "알림 설정",
    "알림 on",
    "알림 off",
    "알림 켜",
    "알림 꺼",
    "테마 바꾸",
    "테마 변경",
    "다크 모드",
    "라이트 모드",
    "프로필 수정",
    "프로필 변경",
    "로그아웃",
)
_ONBOARDING_KEYWORDS = (
    "온보딩",
    "설문 다시",
    "초기 설문",
    "온보딩 다시",
    "처음 설문",
    "가입 때 설문",
)
_REPORT_KEYWORDS = (
    "리포트",
    "레포트",
    "건강 요약",
    "초기 요약",
    "상세 리포트",
    "7일 리포트",
    "위험도 차트",
    "위험도 그래프",
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
    "뱃지",
    "미획득",
    "챌린지 탭",
    "챌린지 선택",
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
    "카드 설문",
    "왜 카드 설문 안나와",
    "왜 설문카드가 안붙어",
    "다음 카드 언제 나와",
    "지금 카드 못받는 이유",
)

_STATE_KEYWORDS = (
    "현재",
    "지금",
    "방금",
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
    "얼마나",
    "몇 번",
    "지금껏",
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

# Conservative fallback: UI 단어 + 의문사 둘 다 있을 때만 CHAT_HELP 승격
_UI_FALLBACK_WORDS = (
    "앱",
    "화면",
    "메뉴",
    "버튼",
    "패널",
    "카드",
    "탭",
    "페이지",
    "드롭다운",
    "모달",
    "기능",
)
_QUESTION_FALLBACK_WORDS = (
    "어디",
    "어떻게",
    "뭐야",
    "뭔데",
    "왜",
    "어떤",
    "가능해",
)


def _normalize(message: str) -> str:
    return _SPACE_RE.sub(" ", message.strip().lower())


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def classify_chat_app_intent(message: str) -> ChatAppIntent:  # noqa: C901
    text = _normalize(message)
    if not text:
        return ChatAppIntent.NONE

    right_panel_related = _contains_any(text, _RIGHT_PANEL_KEYWORDS)
    missed_modal_related = _contains_any(text, _MISSED_MODAL_KEYWORDS)
    sidebar_related = _contains_any(text, _SIDEBAR_KEYWORDS)
    settings_related = _contains_any(text, _SETTINGS_KEYWORDS)
    onboarding_related = _contains_any(text, _ONBOARDING_KEYWORDS)
    report_related = _contains_any(text, _REPORT_KEYWORDS)
    challenge_related = _contains_any(text, _CHALLENGE_KEYWORDS)
    pending_related = _contains_any(text, _PENDING_KEYWORDS)
    chat_related = _contains_any(text, _CHAT_HELP_KEYWORDS)
    asks_state = _contains_any(text, _STATE_KEYWORDS)
    asks_report_guide = any(pattern in text for pattern in _REPORT_GUIDE_PATTERNS)
    asks_report_help = any(pattern in text for pattern in _REPORT_HELP_PATTERNS)

    related_flags = (
        report_related or asks_report_help or asks_report_guide,
        challenge_related,
        pending_related,
        chat_related,
        right_panel_related,
        missed_modal_related,
        sidebar_related,
        settings_related,
        onboarding_related,
    )
    related_domains = sum(1 for flag in related_flags if flag)
    if related_domains >= 2:
        return ChatAppIntent.MIXED

    if missed_modal_related:
        return ChatAppIntent.MISSED_MODAL_HELP
    if right_panel_related:
        return ChatAppIntent.RIGHT_PANEL_HELP
    if sidebar_related:
        return ChatAppIntent.SIDEBAR_HELP
    if settings_related:
        return ChatAppIntent.SETTINGS_HELP
    if onboarding_related:
        return ChatAppIntent.ONBOARDING_HELP
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

    # 보수적 fallback — UI 단어 + 의문사 둘 다 있을 때만 가장 일반 헬프로 승격
    if _contains_any(text, _UI_FALLBACK_WORDS) and _contains_any(text, _QUESTION_FALLBACK_WORDS):
        return ChatAppIntent.CHAT_HELP

    return ChatAppIntent.NONE


def select_app_state_domains(message: str, intent: ChatAppIntent) -> list[str]:
    """Return the actual DB-query domains needed for this message.

    Empty list means no DB call even if intent is MIXED/STATE. This prevents
    help-flavored MIXED questions (예: "리포트랑 챌린지 설명해줘") from
    triggering live state queries.
    """
    text = _normalize(message)
    if not text:
        return []

    asks_state = _contains_any(text, _STATE_KEYWORDS)
    report_related = _contains_any(text, _REPORT_KEYWORDS)
    challenge_related = _contains_any(text, _CHALLENGE_KEYWORDS)
    pending_related = _contains_any(text, _PENDING_KEYWORDS)

    domains: list[str] = []

    # 단일 STATE 인텐트는 해당 domain만
    if intent == ChatAppIntent.REPORT_STATE:
        domains.append("report")
        return domains
    if intent == ChatAppIntent.CHALLENGE_STATE:
        domains.append("challenge")
        return domains
    if intent == ChatAppIntent.PENDING_SURVEYS:
        domains.append("pending")
        return domains

    # MIXED인 경우에만 state 키워드 + 실제 영역 단어 조합을 따져 선택
    if intent != ChatAppIntent.MIXED:
        return domains

    if not asks_state:
        return domains

    if report_related:
        domains.append("report")
    if challenge_related:
        domains.append("challenge")
    if pending_related:
        domains.append("pending")

    return domains
