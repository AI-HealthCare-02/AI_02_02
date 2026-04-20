"""매주 월요일 01:00(KST) 크론 — 주간 건강 리포트 생성.

실행 시점: 매주 월요일 01:00 KST (APScheduler CronTrigger)
처리 내용:
  전체 활성 사용자의 주간 위험도 재계산 (RiskAssessment period_type=WEEKLY 생성)

recalculate_risk()가 이미 WEEKLY 리포트 저장 로직을 포함하므로,
이 크론은 대상 사용자를 순회하며 호출만 한다.
중복 방지를 위해 당일 이미 계산된 사용자는 스킵한다.
"""

from __future__ import annotations

import time
from datetime import date, timedelta

from backend.core.logger import setup_logger
from backend.models.assessments import RiskAssessment
from backend.models.enums import PeriodType
from backend.models.users import User
from backend.services.risk_analysis import RiskAnalysisService
from backend.tasks.scheduler import distributed_lock

logger = setup_logger("tasks.weekly_cron")

BATCH_SIZE = 100


async def run_weekly_cron() -> None:
    """주간 크론 작업 진입점.

    분산 락(TTL 60분)을 획득한 인스턴스만 실행한다.
    """
    async with distributed_lock("weekly-cron", ttl=timedelta(minutes=60)) as acquired:
        if not acquired:
            return

        t0 = time.monotonic()
        logger.info("=== 주간 크론 시작 ===")

        ok_count, skip_count, fail_count = await _generate_weekly_reports()

        elapsed = time.monotonic() - t0
        logger.info(
            "=== 주간 크론 완료 — ok=%d, skip=%d, fail=%d, elapsed=%.1fs ===",
            ok_count,
            skip_count,
            fail_count,
            elapsed,
        )


async def _generate_weekly_reports() -> tuple[int, int, int]:
    """전체 활성 사용자의 주간 건강 리포트를 생성한다.

    recalculate_risk()는 내부에서 RiskAssessment.create()를 호출하므로,
    중복 생성 방지를 위해 당일 period_end인 WEEKLY 레코드가 이미 있으면 스킵한다.

    Returns:
        (성공 건수, 스킵 건수, 실패 건수) 튜플
    """
    service = RiskAnalysisService()
    today = date.today()
    ok_count = 0
    skip_count = 0
    fail_count = 0
    offset = 0

    while True:
        users = await User.filter(is_active=True).offset(offset).limit(BATCH_SIZE).only("id")

        if not users:
            break

        for user in users:
            try:
                # 중복 방지: 오늘 날짜로 이미 주간 리포트가 있으면 스킵
                existing = await RiskAssessment.filter(
                    user_id=user.id,
                    period_type=PeriodType.WEEKLY,
                    period_end=today,
                ).exists()

                if existing:
                    skip_count += 1
                    continue

                # 코칭(OpenAI)은 자정 일괄 호출 비용 방지 차 생략 —
                # 사용자가 리포트 진입 시 `/risk/coaching`이 on-demand로 생성한다.
                await service.recalculate_risk(user.id, generate_coaching=False)
                ok_count += 1

            except Exception:
                fail_count += 1
                logger.exception("주간 리포트 생성 실패 — user_id=%d", user.id)

        offset += BATCH_SIZE

    logger.info(
        "주간 리포트 생성 완료 — ok=%d, skip=%d, fail=%d",
        ok_count,
        skip_count,
        fail_count,
    )
    return ok_count, skip_count, fail_count
