import asyncio
from collections.abc import Sequence
from typing import Any

from tortoise import Tortoise

from app.db.databases import TORTOISE_ORM
from app.domains.challenges.enums import ChallengeCategory
from app.domains.challenges.models import ChallengeTemplate

CHALLENGE_TEMPLATE_SEEDS: Sequence[dict[str, Any]] = (
    {
        "name": "주 150분 운동",
        "category": ChallengeCategory.EXERCISE,
        "description": "주간 운동 시간을 150분 이상 채우는 챌린지",
        "goal_criteria": {"type": "weekly_minutes", "field": "exercise_minutes", "operator": ">=", "value": 150},
        "duration_days": 7,
        "evidence_summary": "주당 150분 이상 운동은 당뇨 위험 감소와 직접 연결됩니다.",
        "risk_factor": "exercise",
        "for_groups": ["A", "B", "C"],
    },
    {
        "name": "식후 산책",
        "category": ChallengeCategory.EXERCISE,
        "description": "식후 산책을 주 5회 이상 실천하는 챌린지",
        "goal_criteria": {"type": "weekly_count", "field": "walk", "operator": ">=", "value": 5},
        "duration_days": 7,
        "evidence_summary": "짧은 식후 걷기는 혈당 변동 완화에 도움이 됩니다.",
        "risk_factor": "exercise",
        "for_groups": ["A", "B", "C"],
    },
    {
        "name": "아침 챙겨먹기",
        "category": ChallengeCategory.DIET,
        "description": "주 5일 이상 아침 식사를 챙겨 먹는 챌린지",
        "goal_criteria": {"type": "weekly_count", "field": "breakfast", "operator": ">=", "value": 5, "exclude": ["none"]},
        "duration_days": 7,
        "evidence_summary": "규칙적인 아침 식사는 식사 패턴 안정화에 유리합니다.",
        "risk_factor": "diet",
        "for_groups": ["A", "B", "C"],
    },
    {
        "name": "매일 채소 먹기",
        "category": ChallengeCategory.DIET,
        "description": "주 5일 이상 채소 섭취를 기록하는 챌린지",
        "goal_criteria": {"type": "weekly_count", "field": "veggie", "operator": ">=", "value": 5},
        "duration_days": 7,
        "evidence_summary": "채소 섭취는 FINDRISC 식이 항목과 직접 연결됩니다.",
        "risk_factor": "diet",
        "for_groups": ["A", "B", "C"],
    },
    {
        "name": "당음료 줄이기",
        "category": ChallengeCategory.DIET,
        "description": "주 6일 이상 당음료를 마시지 않는 챌린지",
        "goal_criteria": {"type": "weekly_count", "field": "sweetdrink", "operator": ">=", "value": 6, "equals": "no"},
        "duration_days": 7,
        "evidence_summary": "당음료 섭취 감소는 혈당 관리와 체중 관리에 모두 중요합니다.",
        "risk_factor": "diet",
        "for_groups": ["A", "B", "C"],
    },
    {
        "name": "야식 끊기",
        "category": ChallengeCategory.DIET,
        "description": "주 6일 이상 야식을 피하는 챌린지",
        "goal_criteria": {"type": "weekly_count", "field": "nightsnack", "operator": ">=", "value": 6, "equals": "no"},
        "duration_days": 7,
        "evidence_summary": "늦은 야식은 혈당과 생활리듬에 부담이 될 수 있습니다.",
        "risk_factor": "diet",
        "for_groups": ["A", "B", "C"],
    },
    {
        "name": "11시 전 수면 루틴",
        "category": ChallengeCategory.SLEEP,
        "description": "규칙적인 취침 루틴을 유지하는 수면 챌린지",
        "goal_criteria": {"type": "quality_proxy", "field": "sleep", "target_values": ["great", "good"], "value": 5},
        "duration_days": 7,
        "evidence_summary": "수면 습관 개선은 대사 건강과 생활 점수에 큰 영향을 줍니다.",
        "risk_factor": "sleep",
        "for_groups": ["A", "B", "C"],
    },
    {
        "name": "숙면 점수 올리기",
        "category": ChallengeCategory.SLEEP,
        "description": "주 5일 이상 좋은 수면 상태를 기록하는 챌린지",
        "goal_criteria": {"type": "weekly_count", "field": "sleep", "operator": ">=", "value": 5, "in": ["great", "good"]},
        "duration_days": 7,
        "evidence_summary": "수면 질 향상은 피로와 생활 습관 전반에 긍정적인 영향을 줍니다.",
        "risk_factor": "sleep",
        "for_groups": ["A", "B", "C"],
    },
    {
        "name": "복약 체크",
        "category": ChallengeCategory.MEDICATION,
        "description": "주 5일 이상 복약 여부를 체크하는 챌린지",
        "goal_criteria": {"type": "weekly_count", "field": "took_medication", "operator": ">=", "value": 5, "equals": "yes"},
        "duration_days": 7,
        "evidence_summary": "복약 기록은 진단군 사용자에게 가장 직접적인 관리 지표입니다.",
        "risk_factor": "medication",
        "for_groups": ["A"],
    },
    {
        "name": "주간 체중 기록",
        "category": ChallengeCategory.WEIGHT,
        "description": "2주 동안 체중을 2회 이상 기록하는 챌린지",
        "goal_criteria": {"type": "periodic_measurement_count", "field": "weight", "operator": ">=", "value": 2, "window_days": 14},
        "duration_days": 14,
        "evidence_summary": "주기적인 체중 기록은 체중 추이 인지와 감량 행동 유지에 도움이 됩니다.",
        "risk_factor": "weight",
        "for_groups": ["A", "B", "C"],
    },
)


async def seed_challenge_templates() -> None:
    await Tortoise.init(config=TORTOISE_ORM)
    try:
        for item in CHALLENGE_TEMPLATE_SEEDS:
            await ChallengeTemplate.update_or_create(
                defaults={key: value for key, value in item.items() if key != "name"},
                name=item["name"],
            )
    finally:
        await Tortoise.close_connections()


def main() -> None:
    asyncio.run(seed_challenge_templates())


if __name__ == "__main__":
    main()
