"""사용자 맥락 서비스 — HealthProfile → 행동적 요약 생성.

pure formatter: DB 조회 없음, gating 없음.
chat.py가 gating + 삽입을 전담.
"""

from __future__ import annotations

from dataclasses import dataclass

# ── 결과 타입 ──────────────────────────────────────────────────
MAX_SUMMARY_CHARS = 160


@dataclass(frozen=True)
class UserContextResult:
    summary: str
    has_context: bool
    mode: str  # "profile_only" | "none"


# ── Goals enum → 한국어 매핑 ──────────────────────────────────
GOAL_MAP: dict[str, str] = {
    "weight_management": "체중관리 목표",
    "diet_improvement": "식사개선 목표",
    "exercise_habit": "운동습관 목표",
    "health_tracking": "건강기록 관심",
    "risk_assessment": "건강점검 관심",
    # "all" → 생략
}

# ── Habit 필드 → 한국어 매핑 ──────────────────────────────────
EXERCISE_FREQ_MAP: dict[str, str] = {
    "none": "운동 안함",
    "1_2_per_week": "운동 주1-2회",
    "3_4_per_week": "운동 주3-4회",
    "5_plus_per_week": "운동 주5회 이상",
}

SLEEP_BUCKET_MAP: dict[str, str] = {
    "under_5": "수면 5시간 미만",
    "between_5_6": "수면 5-6시간",
    "between_6_7": "수면 6-7시간",
    "between_7_8": "수면 7-8시간",
    "over_8": "수면 8시간 이상",
}


# ── UserContextService ────────────────────────────────────────
class UserContextService:
    """HealthProfile → chat-safe personalization 문자열 생성.

    DB 조회 없음. profile 객체를 받아 포맷팅만 수행.
    """

    def build_context(
        self,
        profile,  # HealthProfile | None
        topic_hint: str | None = None,
    ) -> UserContextResult:
        """profile → 행동적 요약 생성.

        Args:
            profile: HealthProfile 객체 또는 None.
            topic_hint: "sleep" | "exercise" | None.
                메시지 키워드 기반으로 chat.py가 결정.
        """
        if profile is None:
            return UserContextResult(summary="", has_context=False, mode="none")

        parts: list[str] = []

        # 1. goals (항상 포함)
        goal_text = self._format_goals(profile.goals)
        if goal_text:
            parts.append(goal_text)

        # 2. topic hint 기반 habit (최대 1개)
        if topic_hint == "sleep":
            sleep_text = SLEEP_BUCKET_MAP.get(str(profile.sleep_duration_bucket))
            if sleep_text:
                parts.append(f"{sleep_text} 수준")
        elif topic_hint == "exercise":
            exercise_text = EXERCISE_FREQ_MAP.get(str(profile.exercise_frequency))
            if exercise_text:
                parts.append(f"{exercise_text} 수준")
        # topic_hint=None → goals만

        if not parts:
            return UserContextResult(summary="", has_context=False, mode="none")

        summary = ", ".join(parts)

        # 160자 하드캡
        if len(summary) > MAX_SUMMARY_CHARS:
            summary = summary[:MAX_SUMMARY_CHARS]

        return UserContextResult(
            summary=summary,
            has_context=True,
            mode="profile_only",
        )

    def _format_goals(self, goals) -> str:
        """goals JSON 리스트 → 한국어 요약."""
        if not goals:
            return ""

        mapped: list[str] = []
        for g in goals:
            label = GOAL_MAP.get(str(g))
            if label:
                mapped.append(label)

        if not mapped:
            return ""

        # 최대 3개만
        return "·".join(mapped[:3])
