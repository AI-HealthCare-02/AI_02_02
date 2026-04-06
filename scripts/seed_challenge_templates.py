"""챌린지 템플릿 초기 데이터 생성 스크립트.

사용법: python scripts/seed_challenge_templates.py
챌린지 시스템 사용 전 반드시 1회 실행 필요.
"""

from __future__ import annotations

import asyncio
import sys

# 프로젝트 루트를 path에 추가
sys.path.insert(0, ".")

from tortoise import Tortoise

from backend.db.databases import TORTOISE_ORM

TEMPLATES = [
    {
        "code": "exercise_150min",
        "name": "주 150분 운동",
        "emoji": "🏃",
        "category": "exercise",
        "description": "WHO 권장 기준, 일주일에 총 150분 이상 운동하기",
        "goal_criteria": {"field": "exercise_minutes", "weekly_target": 150},
        "default_duration_days": 14,
        "evidence_summary": "DPP 2002 NEJM — 주 150분 운동 시 당뇨 발병 58% 감소",
        "for_groups": ["A", "B", "C"],
    },
    {
        "code": "daily_walk_30min",
        "name": "매일 30분 걷기",
        "emoji": "🚶",
        "category": "exercise",
        "description": "매일 30분 이상 걷기 실천",
        "goal_criteria": {"field": "walk_done", "daily_target": True},
        "default_duration_days": 14,
        "evidence_summary": "WHO 신체활동 가이드라인 — 매일 보행 권장",
        "for_groups": ["A", "B", "C"],
    },
    {
        "code": "vegetable_3servings",
        "name": "하루 채소 3접시",
        "emoji": "🥗",
        "category": "diet",
        "description": "매일 충분한 채소 섭취 실천",
        "goal_criteria": {"field": "vegetable_intake_level", "daily_target": "enough"},
        "default_duration_days": 14,
        "evidence_summary": "FINDRISC 직접 변수 — 채소/과일 매일 섭취 시 1점 감소",
        "for_groups": ["A", "B", "C"],
    },
    {
        "code": "no_nightsnack",
        "name": "야식 안 먹기",
        "emoji": "🌙",
        "category": "diet",
        "description": "저녁 식사 후 야식 자제하기",
        "goal_criteria": {"field": "nightsnack_level", "daily_target": "none"},
        "default_duration_days": 14,
        "evidence_summary": "야간 식이 패턴과 혈당 변동 연관성",
        "for_groups": ["A", "B", "C"],
    },
    {
        "code": "water_6cups",
        "name": "하루 물 6잔",
        "emoji": "💧",
        "category": "hydration",
        "description": "매일 물 6잔(약 1.2L) 이상 마시기",
        "goal_criteria": {"field": "water_cups", "daily_target": 6},
        "default_duration_days": 14,
        "evidence_summary": "충분한 수분 섭취와 대사 건강 연관성",
        "for_groups": ["A", "B", "C"],
    },
    {
        "code": "no_sweetdrink",
        "name": "단음료 끊기",
        "emoji": "🚫",
        "category": "diet",
        "description": "가당 음료 섭취 자제하기",
        "goal_criteria": {"field": "sweetdrink_level", "daily_target": "none"},
        "default_duration_days": 14,
        "evidence_summary": "가당 음료와 제2형 당뇨 발병 위험 증가 연관성",
        "for_groups": ["A", "B", "C"],
    },
    {
        "code": "sleep_7h",
        "name": "7시간 이상 수면",
        "emoji": "😴",
        "category": "sleep",
        "description": "매일 7시간 이상 충분히 수면하기",
        "goal_criteria": {"field": "sleep_duration_bucket", "daily_target": ["between_7_8", "over_8"]},
        "default_duration_days": 14,
        "evidence_summary": "Cappuccio 2010 — 6시간 이하 수면 시 당뇨 위험 28% 증가",
        "for_groups": ["A", "B", "C"],
    },
    {
        "code": "medication_daily",
        "name": "매일 약 챙기기",
        "emoji": "💊",
        "category": "medication",
        "description": "처방 받은 약을 매일 빠짐없이 복용하기",
        "goal_criteria": {"field": "took_medication", "daily_target": True},
        "default_duration_days": 14,
        "evidence_summary": "Cramer 2004 — 복약 비순응 시 합병증 위험 35-65% 증가",
        "for_groups": ["A"],
    },
    {
        "code": "alcohol_limit",
        "name": "음주 줄이기",
        "emoji": "🍷",
        "category": "lifestyle",
        "description": "음주 횟수와 양 줄이기",
        "goal_criteria": {"field": "alcohol_today", "daily_target": False},
        "default_duration_days": 14,
        "evidence_summary": "P1 우선순위 — FINDRISC 간접 영향, 생활습관 개선 핵심",
        "for_groups": ["A", "B", "C"],
    },
]


async def seed() -> None:
    """챌린지 템플릿 시드 데이터 생성."""
    await Tortoise.init(config=TORTOISE_ORM)

    from backend.models.challenges import ChallengeTemplate

    created = 0
    skipped = 0

    for t in TEMPLATES:
        existing = await ChallengeTemplate.get_or_none(code=t["code"])
        if existing:
            skipped += 1
            print(f"  [SKIP] {t['code']} (이미 존재)")
            continue

        await ChallengeTemplate.create(**t)
        created += 1
        print(f"  [CREATE] {t['code']} — {t['name']}")

    print()
    print(f"완료: {created}개 생성, {skipped}개 건너뜀 (총 {created + skipped}개)")

    await Tortoise.close_connections()


if __name__ == "__main__":
    print()
    print("=" * 45)
    print("  챌린지 템플릿 시드 데이터 생성")
    print("=" * 45)
    print()
    asyncio.run(seed())
