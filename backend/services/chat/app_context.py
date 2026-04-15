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
    MIXED = "mixed"


@dataclass(frozen=True)
class ChatAppHelpSnapshot:
    chat_help: str
    report_help: str
    challenge_help: str
    pending_help: str


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
    )


@lru_cache(maxsize=1)
def _load_product_guide() -> dict[str, dict[str, str]] | None:
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

    required_sections = {"chat", "report", "challenge", "pending"}
    required_fields = {"headline", "what_it_is", "where_to_check", "next_action", "limitations"}
    if not isinstance(data, dict) or not required_sections.issubset(data.keys()):
        logger.warning("chat_product_guide_shape_invalid", path=str(_GUIDE_PATH))
        return None

    for section_name in required_sections:
        section = data.get(section_name)
        if not isinstance(section, dict) or not required_fields.issubset(section.keys()):
            logger.warning(
                "chat_product_guide_section_invalid",
                path=str(_GUIDE_PATH),
                section=section_name,
            )
            return None

    return data


def _section_to_help_text(section: dict[str, str] | None, fallback: str) -> str:
    if not section:
        return fallback

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

    return ChatAppHelpSnapshot(
        chat_help=_section_to_help_text(guide.get("chat"), fallback.chat_help),
        report_help=_section_to_help_text(guide.get("report"), fallback.report_help),
        challenge_help=_section_to_help_text(guide.get("challenge"), fallback.challenge_help),
        pending_help=_section_to_help_text(guide.get("pending"), fallback.pending_help),
    )


def intent_requests_state(intent: ChatAppIntent) -> bool:
    return intent in {
        ChatAppIntent.REPORT_STATE,
        ChatAppIntent.CHALLENGE_STATE,
        ChatAppIntent.PENDING_SURVEYS,
        ChatAppIntent.MIXED,
    }


def intent_requests_help(intent: ChatAppIntent) -> bool:
    return intent in {
        ChatAppIntent.CHAT_HELP,
        ChatAppIntent.REPORT_HELP,
        ChatAppIntent.CHALLENGE_HELP,
        ChatAppIntent.MIXED,
    } or intent_requests_state(intent)


def build_app_help_layer(context: ChatAppContext | None) -> str:
    if context is None or context.help_snapshot is None or not intent_requests_help(context.intent):
        return ""

    sections: list[str] = []
    if context.intent in {ChatAppIntent.CHAT_HELP, ChatAppIntent.MIXED}:
        sections.append(f"- 채팅: {context.help_snapshot.chat_help}")
    if context.intent in {
        ChatAppIntent.REPORT_HELP,
        ChatAppIntent.REPORT_STATE,
        ChatAppIntent.MIXED,
    }:
        sections.append(f"- 리포트: {context.help_snapshot.report_help}")
    if context.intent in {
        ChatAppIntent.CHALLENGE_HELP,
        ChatAppIntent.CHALLENGE_STATE,
        ChatAppIntent.MIXED,
    }:
        sections.append(f"- 챌린지: {context.help_snapshot.challenge_help}")
    if context.intent == ChatAppIntent.PENDING_SURVEYS:
        sections.append(f"- 오늘 기록: {context.help_snapshot.pending_help}")

    if not sections:
        return ""

    answer_frame = (
        "\n\n## 앱 질문 답변 방식\n"
        "1. 먼저 질문에 바로 답하세요.\n"
        "2. 그 기능이 다나아 안에서 어떤 화면과 역할인지 짧게 설명하세요.\n"
        "3. 마지막에는 어디를 보거나 무엇을 하면 되는지 한 문장으로 안내하세요.\n"
        "상태가 없으면 값을 추측하지 말고, 확인 방법만 안내하세요."
    )
    return "\n\n## 앱 기능 참고\n" + "\n".join(dict.fromkeys(sections)) + answer_frame


def _format_risk_level(value: str) -> str:
    label = _RISK_LEVEL_LABELS.get(value.lower(), value)
    return f"{label} ({value})" if label != value else value


def _build_report_state_lines(snapshot: ChatAppStateSnapshot) -> list[str]:
    lines: list[str] = []
    if snapshot.onboarding_completed is not None:
        lines.append(
            f"- 온보딩 완료 여부: {'완료' if snapshot.onboarding_completed else '미완료'}"
        )
    if snapshot.user_group:
        lines.append(f"- 사용자 그룹: {snapshot.user_group}")
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
    return [f"- 오늘 아직 안 적은 질문 수: {snapshot.pending_count}"]


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
