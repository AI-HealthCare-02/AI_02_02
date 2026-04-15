from __future__ import annotations

from typing import Any

from backend.core import config
from backend.core.logger import setup_logger
from backend.dtos.dashboard import RiskDetailResponse
from backend.models.health import DailyHealthLog, HealthProfile
from backend.services.chat.openai_client import get_openai_client

logger = setup_logger(__name__)

FACTOR_LABELS = {
    "good_sleep": "수면 흐름이 안정적임",
    "poor_sleep": "수면 시간이 부족함",
    "healthy_diet": "식사 균형이 좋음",
    "poor_diet": "식습관 점검이 필요함",
    "regular_exercise": "운동 흐름이 유지됨",
    "low_activity": "활동량이 부족함",
    "regular_walk": "걷기 습관이 유지됨",
    "good_vegetable_intake": "채소 섭취가 안정적임",
    "low_vegetable_intake": "채소 섭취가 부족함",
    "carb_heavy_meals": "탄수화물 위주 식사가 잦음",
    "frequent_alcohol": "음주 빈도가 높음",
}

SLEEP_HOURS = {
    "under_5": 4.5,
    "between_5_6": 5.5,
    "between_6_7": 6.5,
    "between_7_8": 7.5,
    "over_8": 8.5,
}


def _avg(values: list[float | int | None]) -> float | None:
    filtered = [float(value) for value in values if value is not None]
    if not filtered:
        return None
    return round(sum(filtered) / len(filtered), 1)


def _factor_lines(values: list[str]) -> list[str]:
    return [FACTOR_LABELS.get(value, value) for value in values]


class ReportCoachingService:
    async def generate_lines(
        self,
        *,
        profile: HealthProfile,
        logs: list[DailyHealthLog],
        detail: RiskDetailResponse,
    ) -> list[str]:
        if not config.OPENAI_API_KEY:
            return []

        payload = self._build_payload(profile=profile, logs=logs, detail=detail)
        system_prompt = (
            "너는 건강 리포트 코치다. "
            "사용자에게 의료 진단처럼 단정하지 말고, 생활관리 관점에서 1~3줄의 짧은 피드백만 작성한다. "
            "좋은 점 1개와 보완점 1개를 포함하되, 과장하거나 공포를 조장하지 않는다. "
            "출력은 한국어 평문 줄바꿈 1~3줄만 사용하고, 번호나 마크다운은 쓰지 않는다."
        )
        user_prompt = (
            "아래 사용자 요약을 바탕으로 리포트용 짧은 코칭을 작성해줘.\n"
            f"{payload}"
        )

        try:
            client = get_openai_client()
            response = await client.chat.completions.create(
                model=config.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.4,
                max_tokens=120,
                stream=False,
            )
        except Exception:
            logger.exception("report_coaching_generation_failed")
            return []

        content = response.choices[0].message.content if response.choices else None
        if not content:
            return []

        lines = [line.strip(" -") for line in content.splitlines() if line.strip()]
        return lines[:3]

    def _build_payload(
        self,
        *,
        profile: HealthProfile,
        logs: list[DailyHealthLog],
        detail: RiskDetailResponse,
    ) -> dict[str, Any]:
        return {
            "user_group": str(profile.user_group),
            "relation": str(profile.relation),
            "bmi": round(float(profile.bmi), 1),
            "model_stage": detail.predicted_stage_label,
            "model_probability_pct": detail.predicted_score_pct,
            "lifestyle_score": detail.lifestyle_score,
            "findrisc_score": detail.findrisc_score,
            "sleep_hours_avg": _avg([SLEEP_HOURS.get(log.sleep_duration_bucket) for log in logs]),
            "exercise_days": sum(1 for log in logs if log.exercise_done),
            "exercise_minutes_total": sum(log.exercise_minutes or 0 for log in logs),
            "water_avg_cups": _avg([log.water_cups for log in logs]),
            "vegetable_good_days": sum(1 for log in logs if log.vegetable_intake_level == "enough"),
            "positive_factors": _factor_lines(detail.top_positive_factors or []),
            "risk_factors": _factor_lines(detail.top_risk_factors or []),
            "supporting_signals": detail.supporting_signals or [],
            "recommended_actions": detail.recommended_actions or [],
        }
