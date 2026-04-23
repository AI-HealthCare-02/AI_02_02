"""Internal app-context contracts for product-aware chat answers."""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import StrEnum
from functools import lru_cache
from pathlib import Path

from backend.core.logger import setup_logger

logger = setup_logger(__name__)

_GUIDE_PATH = Path(__file__).resolve().parents[3] / "shared" / "danaa_product_guide.v1.json"
_RISK_LEVEL_LABELS = {
    "low": "낮음",
    "slight": "약간 높음",
    "moderate": "보통",
    "high": "높음",
    "very_high": "매우 높음",
}


class ChatAppIntent(StrEnum):
    NONE = "none"
    CHAT_HELP = "chat_help"
    REPORT_HELP = "report_help"
    REPORT_STATE = "report_state"
    CHALLENGE_HELP = "challenge_help"
    CHALLENGE_STATE = "challenge_state"
    PENDING_SURVEYS = "pending_surveys"
    SIDEBAR_HELP = "sidebar_help"
    SETTINGS_HELP = "settings_help"
    ONBOARDING_HELP = "onboarding_help"
    RIGHT_PANEL_HELP = "right_panel_help"
    MISSED_MODAL_HELP = "missed_modal_help"
    MIXED = "mixed"


@dataclass(frozen=True)
class ChatAppHelpSnapshot:
    chat_help: str
    report_help: str
    challenge_help: str
    pending_help: str
    sidebar_help: str | None = None
    settings_help: str | None = None
    onboarding_help: str | None = None
    right_panel_help: str | None = None
    missed_modal_help: str | None = None


@dataclass(frozen=True)
class ChatAppChallengeStateItem:
    name: str
    progress_pct: float
    today_checked: bool
    current_streak: int | None = None


@dataclass(frozen=True)
class ChatAppStateSnapshot:
    onboarding_completed: bool | None = None
    user_group: str | None = None
    initial_risk_level: str | None = None
    active_count: int | None = None
    remaining_active_slots: int | None = None
    active_challenges: tuple[ChatAppChallengeStateItem, ...] = ()
    recommended_names: tuple[str, ...] = ()
    pending_count: int | None = None
    pending_question_labels: tuple[str, ...] = ()
    pending_bundle_names: tuple[str, ...] = ()
    card_is_available: bool | None = None
    card_next_bundle_key: str | None = None
    card_next_bundle_name: str | None = None
    card_blocked_reason: str | None = None
    card_blocked_reason_text: str | None = None
    card_available_after: object | None = None
    card_sequence_started_at: object | None = None
    schema_version: str = "chat_app_context_v1"

    def state_keys(self) -> tuple[str, ...]:  # noqa: C901
        keys: list[str] = []
        if self.onboarding_completed is not None:
            keys.append("onboarding_completed")
        if self.user_group is not None:
            keys.append("user_group")
        if self.initial_risk_level is not None:
            keys.append("initial_risk_level")
        if self.active_count is not None:
            keys.append("active_count")
        if self.remaining_active_slots is not None:
            keys.append("remaining_active_slots")
        if self.active_challenges:
            keys.append("active_challenges")
        if self.recommended_names:
            keys.append("recommended_names")
        if self.pending_count is not None:
            keys.append("pending_count")
        if self.pending_question_labels:
            keys.append("pending_question_labels")
        if self.pending_bundle_names:
            keys.append("pending_bundle_names")
        if self.card_is_available is not None:
            keys.append("card_is_available")
        if self.card_next_bundle_key is not None:
            keys.append("card_next_bundle_key")
        if self.card_next_bundle_name is not None:
            keys.append("card_next_bundle_name")
        if self.card_blocked_reason is not None:
            keys.append("card_blocked_reason")
        if self.card_blocked_reason_text is not None:
            keys.append("card_blocked_reason_text")
        if self.card_available_after is not None:
            keys.append("card_available_after")
        if self.card_sequence_started_at is not None:
            keys.append("card_sequence_started_at")
        return tuple(keys)


@dataclass(frozen=True)
class ChatAppContext:
    intent: ChatAppIntent
    help_snapshot: ChatAppHelpSnapshot | None = None
    state_snapshot: ChatAppStateSnapshot | None = None
    has_live_state: bool = False


def _fallback_help_snapshot() -> ChatAppHelpSnapshot:
    return ChatAppHelpSnapshot(
        chat_help=(
            "채팅에서는 AI 답변 아래에 뜨는 기록 카드로 오늘 건강 기록을 남길 수 있어요. "
            "오른쪽 패널은 저장 창이 아니라 오늘의 카드, 오늘의 브리핑, 나의 습관, 미답변 질문을 요약해서 보여주는 공간이에요."
        ),
        report_help=(
            "리포트는 초기 요약과 건강 흐름을 보는 화면이에요. "
            "기록이 쌓일수록 더 풍부하게 보이고, 7일 이상 기록하면 상세 리포트에서 항목별 분석을 더 의미 있게 볼 수 있어요."
        ),
        challenge_help=(
            "챌린지는 최대 2개까지 동시에 진행할 수 있고, 시작, 일시정지, 재개, 취소가 가능해요. "
            "진행률과 연속 달성도 확인할 수 있어요."
        ),
        pending_help=(
            "오늘 아직 안 적은 질문은 채팅 답변 아래 카드에서 바로 기록할 수 있어요. "
            "오른쪽 패널의 미답변 질문은 입력창이 아니라 남은 질문 요약이에요."
        ),
        sidebar_help=(
            "왼쪽 사이드바에는 AI 채팅·리포트·챌린지 메인 메뉴와 '+ 새 대화' 버튼, 최근 대화 목록, 사용자 프로필이 모여 있어요."
        ),
        settings_help=(
            "설정 페이지에서는 프로필(이름·생년월일·전화) 수정, 알림 on/off, 테마(다크/라이트) 선택, 비밀번호 변경, 로그아웃을 할 수 있어요."
        ),
        onboarding_help=(
            "온보딩은 가입 직후 15단계 건강 설문으로, 약관·프로필·체형·의료력·검사수치·생활습관·목표 순으로 진행돼요. 완료되면 AI 채팅 자동 질문이 시작돼요."
        ),
        right_panel_help=(
            "우측 Today 패널은 오늘 기록 카드 7종(수면·식사·복약·운동·수분·기분·음주), 상단 요약 문장, 도전 챌린지, 최근 3일 미응답 버튼을 한곳에 모은 영역이에요. 복약 카드는 A그룹(집중 관리 단계)에만 표시돼요."
        ),
        missed_modal_help=(
            "미응답 질문 모달은 어제·그제 미기록 항목을 드롭다운으로 일괄 입력하는 팝업이에요. 오늘은 우측 Today 카드에서 입력해요."
        ),
    )


@lru_cache(maxsize=1)
def _load_product_guide() -> dict[str, dict] | None:
    try:
        raw = _GUIDE_PATH.read_text(encoding="utf-8")
        data = json.loads(raw)
    except FileNotFoundError:
        logger.warning("chat_product_guide_missing", path=str(_GUIDE_PATH))
        return None
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning(
            "chat_product_guide_invalid",
            path=str(_GUIDE_PATH),
            error=type(exc).__name__,
        )
        return None

    # 기존 4섹션은 필수 (v1 호환). 신규 5섹션은 optional.
    required_sections = {"chat", "report", "challenge", "pending"}
    # v2 필수 최소 필드 — headline+summary만 있으면 OK (details/next_action/limitations는 optional).
    # v1 구조(what_it_is/where_to_check/next_action/limitations)도 계속 호환 유지.
    if not isinstance(data, dict) or not required_sections.issubset(data.keys()):
        logger.warning("chat_product_guide_shape_invalid", path=str(_GUIDE_PATH))
        return None

    for section_name in required_sections:
        section = data.get(section_name)
        if not isinstance(section, dict):
            logger.warning(
                "chat_product_guide_section_invalid",
                path=str(_GUIDE_PATH),
                section=section_name,
            )
            return None
        # v2: headline+summary가 있거나
        # v1: what_it_is+where_to_check가 있어야 의미 있는 섹션으로 간주
        has_v2 = "headline" in section and "summary" in section
        has_v1 = "what_it_is" in section and "where_to_check" in section
        if not (has_v2 or has_v1):
            logger.warning(
                "chat_product_guide_section_fields_missing",
                path=str(_GUIDE_PATH),
                section=section_name,
            )
            return None

    return data


def _section_to_help_text(section: dict | None, fallback: str, *, max_details: int = 0) -> str:
    """섹션 dict을 한 줄 help text로 변환. v2(summary+details) / v1(what_it_is…) 모두 지원.

    max_details: summary 뒤에 붙일 details bullet 최대 개수 (0=summary만).
    """
    if not section:
        return fallback

    summary = section.get("summary")
    if isinstance(summary, str) and summary.strip():
        parts: list[str] = [summary.strip()]
        if max_details > 0:
            details = section.get("details")
            if isinstance(details, list):
                picked = [str(item).strip() for item in details if isinstance(item, str) and item.strip()][:max_details]
                if picked:
                    parts.append(" ".join(f"• {item}" for item in picked))
        next_action = section.get("next_action")
        if isinstance(next_action, str) and next_action.strip() and max_details > 0:
            parts.append(f"다음 행동: {next_action.strip()}")
        limitations = section.get("limitations")
        if isinstance(limitations, str) and limitations.strip() and max_details > 0:
            parts.append(f"참고: {limitations.strip()}")
        return " ".join(parts)

    # v1 fallback
    ordered_keys = ("what_it_is", "where_to_check", "next_action", "limitations")
    parts = [
        str(section.get(key, "")).strip()
        for key in ordered_keys
        if isinstance(section.get(key), str) and section.get(key, "").strip()
    ]
    return " ".join(parts) if parts else fallback


def build_default_help_snapshot() -> ChatAppHelpSnapshot:
    fallback = _fallback_help_snapshot()
    guide = _load_product_guide()
    if guide is None:
        return fallback

    def _get(section_key: str, fallback_text: str | None) -> str | None:
        section = guide.get(section_key)
        if not isinstance(section, dict):
            return fallback_text
        text = _section_to_help_text(section, fallback_text or "")
        return text or fallback_text

    return ChatAppHelpSnapshot(
        chat_help=_get("chat", fallback.chat_help) or fallback.chat_help,
        report_help=_get("report", fallback.report_help) or fallback.report_help,
        challenge_help=_get("challenge", fallback.challenge_help) or fallback.challenge_help,
        pending_help=_get("pending", fallback.pending_help) or fallback.pending_help,
        sidebar_help=_get("sidebar", fallback.sidebar_help),
        settings_help=_get("settings", fallback.settings_help),
        onboarding_help=_get("onboarding", fallback.onboarding_help),
        right_panel_help=_get("right_panel", fallback.right_panel_help),
        missed_modal_help=_get("missed_modal", fallback.missed_modal_help),
    )


def _section_with_details(section_key: str, fallback_text: str | None, max_details: int = 2) -> str | None:
    """intent와 일치할 때 사용 — summary + details 최대 N개까지 포함."""
    guide = _load_product_guide()
    if guide is None:
        return fallback_text
    section = guide.get(section_key)
    if not isinstance(section, dict):
        return fallback_text
    return _section_to_help_text(section, fallback_text or "", max_details=max_details) or fallback_text


def intent_requests_state(intent: ChatAppIntent) -> bool:
    return intent in {
        ChatAppIntent.REPORT_STATE,
        ChatAppIntent.CHALLENGE_STATE,
        ChatAppIntent.PENDING_SURVEYS,
        ChatAppIntent.MIXED,
    }


_HELP_INTENTS = frozenset(
    {
        ChatAppIntent.CHAT_HELP,
        ChatAppIntent.REPORT_HELP,
        ChatAppIntent.CHALLENGE_HELP,
        ChatAppIntent.SIDEBAR_HELP,
        ChatAppIntent.SETTINGS_HELP,
        ChatAppIntent.ONBOARDING_HELP,
        ChatAppIntent.RIGHT_PANEL_HELP,
        ChatAppIntent.MISSED_MODAL_HELP,
        ChatAppIntent.MIXED,
    }
)

HELP_LAYER_MAX_CHARS = 1500
MIXED_HELP_LAYER_MAX_CHARS = 2200

# 신규 intent 추가 시 이 테이블 1개 항목만 확장하면 됨 — (label, section_intent, section_key, snapshot_attr, also_triggered_by)
# also_triggered_by: 이 섹션을 포함시킬 추가 intent (보통 *_STATE 연계 또는 빈 tuple)
_INTENT_SECTION_MAP: tuple[tuple[str, ChatAppIntent, str, str, tuple[ChatAppIntent, ...]], ...] = (
    ("채팅", ChatAppIntent.CHAT_HELP, "chat", "chat_help", ()),
    ("리포트", ChatAppIntent.REPORT_HELP, "report", "report_help", (ChatAppIntent.REPORT_STATE,)),
    ("챌린지", ChatAppIntent.CHALLENGE_HELP, "challenge", "challenge_help", (ChatAppIntent.CHALLENGE_STATE,)),
    ("오늘 기록", ChatAppIntent.PENDING_SURVEYS, "pending", "pending_help", ()),
    ("사이드바", ChatAppIntent.SIDEBAR_HELP, "sidebar", "sidebar_help", ()),
    ("설정", ChatAppIntent.SETTINGS_HELP, "settings", "settings_help", ()),
    ("온보딩", ChatAppIntent.ONBOARDING_HELP, "onboarding", "onboarding_help", ()),
    ("우측 Today 패널", ChatAppIntent.RIGHT_PANEL_HELP, "right_panel", "right_panel_help", ()),
    ("미응답 모달", ChatAppIntent.MISSED_MODAL_HELP, "missed_modal", "missed_modal_help", ()),
)


def intent_requests_help(intent: ChatAppIntent) -> bool:
    return intent in _HELP_INTENTS or intent_requests_state(intent)


def _section_line(label: str, intent: ChatAppIntent, section_intent: ChatAppIntent, section_key: str, fallback_text: str | None) -> str | None:
    """intent와 섹션이 정확히 일치하면 details 2개까지, 아니면 summary만."""
    if fallback_text is None:
        return None
    if intent == section_intent:
        text = _section_with_details(section_key, fallback_text, max_details=2)
    else:
        text = fallback_text
    if not text:
        return None
    return f"- {label}: {text}"


def build_app_help_layer(context: ChatAppContext | None) -> str:
    if context is None or context.help_snapshot is None or not intent_requests_help(context.intent):
        return ""

    snap = context.help_snapshot
    intent = context.intent
    sections: list[str] = []

    for label, section_intent, section_key, snapshot_attr, also_triggered_by in _INTENT_SECTION_MAP:
        triggers = {section_intent, ChatAppIntent.MIXED, *also_triggered_by}
        if intent not in triggers:
            continue
        fallback_text = getattr(snap, snapshot_attr, None)
        line = _section_line(label, intent, section_intent, section_key, fallback_text)
        if line:
            sections.append(line)

    if not sections:
        return ""

    # 중복 제거 (같은 label·본문이 여러 번 포함되는 경우 방지)
    deduped = list(dict.fromkeys(sections))

    answer_frame = (
        "\n\n## 앱 질문 답변 방식\n"
        "1. 먼저 질문에 바로 답하세요.\n"
        "2. 그 기능이 다나아 안에서 어떤 화면과 역할인지 짧게 설명하세요.\n"
        "3. 마지막에는 어디를 보거나 무엇을 하면 되는지 한 문장으로 안내하세요.\n"
        "상태가 없으면 값을 추측하지 말고, 확인 방법만 안내하세요."
    )

    # 길이 제한 — MIXED는 다중 섹션이라 한도 2200, 단일 intent는 1500
    char_budget = MIXED_HELP_LAYER_MAX_CHARS if intent == ChatAppIntent.MIXED else HELP_LAYER_MAX_CHARS
    # 뒤쪽 섹션부터 줄여 전체가 한도 안에 들도록
    while deduped:
        body = "\n".join(deduped)
        candidate = "\n\n## 앱 기능 참고\n" + body + answer_frame
        if len(candidate) <= char_budget:
            return candidate
        deduped.pop()

    # 최악 케이스: 섹션이 하나도 안 남으면 빈 문자열
    return ""


def _format_risk_level(value: str) -> str:
    label = _RISK_LEVEL_LABELS.get(value.lower(), value)
    return f"{label} ({value})" if label != value else value


def _format_user_group(value: object) -> str:
    raw = value.value if hasattr(value, "value") else value
    labels = {
        "A": "A그룹(집중 관리 단계)",
        "B": "B그룹(주의 관리 단계)",
        "C": "C그룹(일반 관리 단계)",
    }
    return labels.get(str(raw), str(raw))


def _build_report_state_lines(snapshot: ChatAppStateSnapshot) -> list[str]:
    lines: list[str] = []
    if snapshot.onboarding_completed is not None:
        lines.append(
            f"- 온보딩 완료 여부: {'완료' if snapshot.onboarding_completed else '미완료'}"
        )
    if snapshot.user_group:
        lines.append(f"- 사용자 그룹: {_format_user_group(snapshot.user_group)}")
    if snapshot.initial_risk_level:
        lines.append(f"- 초기 위험도: {_format_risk_level(snapshot.initial_risk_level)}")
    return lines


def _build_challenge_state_lines(snapshot: ChatAppStateSnapshot) -> list[str]:
    lines: list[str] = []
    if snapshot.active_count is not None:
        lines.append(f"- 진행 중인 챌린지 수: {snapshot.active_count}")
    if snapshot.remaining_active_slots is not None:
        lines.append(f"- 남은 활성 슬롯: {snapshot.remaining_active_slots}")
    for challenge in snapshot.active_challenges:
        streak_text = (
            f", 현재 스트릭 {challenge.current_streak}일"
            if challenge.current_streak is not None
            else ""
        )
        today_text = "오늘 체크 완료" if challenge.today_checked else "오늘 체크 필요"
        lines.append(
            f"- {challenge.name}: 진행률 {challenge.progress_pct:.1f}%, {today_text}{streak_text}"
        )
    return lines


def _build_pending_state_lines(snapshot: ChatAppStateSnapshot) -> list[str]:
    if snapshot.pending_count is None:
        return []
    lines = [f"- 오늘 아직 안 적은 질문 수: {snapshot.pending_count}"]
    if snapshot.card_is_available and snapshot.card_next_bundle_name:
        lines.append(f"- 지금 자동으로 붙을 다음 카드: {snapshot.card_next_bundle_name}")
    elif snapshot.card_blocked_reason_text:
        lines.append(f"- 카드가 바로 안 보이는 이유: {snapshot.card_blocked_reason_text}")
    if snapshot.card_available_after is not None:
        lines.append(f"- 다시 자동 카드가 열리는 시각: {snapshot.card_available_after}")

    if snapshot.pending_bundle_names:
        lines.append(f"- 남아 있는 질문 묶음: {', '.join(snapshot.pending_bundle_names[:3])}")

    return lines


def build_app_state_layer(context: ChatAppContext | None) -> str:
    if context is None or not intent_requests_state(context.intent):
        return ""

    if not context.has_live_state or context.state_snapshot is None:
        return (
            "\n\n## 현재 상태 답변 규칙\n"
            "현재 확인된 상태로는 정확한 값을 알 수 없어요. "
            "없는 숫자, 개수, 진행률을 추측하지 말고 기능 설명과 확인 방법만 안내하세요."
        )

    snapshot = context.state_snapshot
    lines: list[str] = []
    if context.intent in {ChatAppIntent.REPORT_STATE, ChatAppIntent.MIXED}:
        report_lines = _build_report_state_lines(snapshot)
        if report_lines:
            lines.append("[리포트 현재 상태]")
            lines.extend(report_lines)
    if context.intent in {ChatAppIntent.CHALLENGE_STATE, ChatAppIntent.MIXED}:
        challenge_lines = _build_challenge_state_lines(snapshot)
        if challenge_lines:
            lines.append("[챌린지 현재 상태]")
            lines.extend(challenge_lines)
    if context.intent in {ChatAppIntent.PENDING_SURVEYS, ChatAppIntent.MIXED}:
        pending_lines = _build_pending_state_lines(snapshot)
        if pending_lines:
            lines.append("[오늘 아직 안 적은 질문 상태]")
            lines.extend(pending_lines)

    if not lines:
        return (
            "\n\n## 현재 상태 답변 규칙\n"
            "현재 확인된 상태로는 정확한 값을 알 수 없어요. "
            "없는 숫자, 개수, 진행률을 추측하지 말고 기능 설명과 확인 방법만 안내하세요."
        )

    return (
        "\n\n## 현재 확인된 앱 상태\n"
        "아래 값만 현재 상태로 사용하세요. 없는 숫자나 진행률은 추측하면 안 됩니다.\n"
        + "\n".join(lines)
    )
