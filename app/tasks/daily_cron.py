"""매일 자정(KST) 크론 — FINDRISC 재계산 + 참여 상태 갱신.

실행 시점: 매일 00:00 KST (APScheduler CronTrigger)
처리 내용:
  1. 전체 활성 사용자 FINDRISC 위험도 재계산 (BATCH_SIZE=100, 순차 처리)
  2. 전체 사용자 참여 상태(EngagementState) 갱신 — Raw SQL 1회 조회 + 배치 업데이트

분산 락으로 다중 인스턴스 환경에서 중복 실행을 방지한다.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta
from decimal import Decimal

from tortoise import connections

from app.core import config
from app.core.logger import setup_logger
from app.models.assessments import UserEngagement
from app.models.enums import EngagementState
from app.models.users import User
from app.services.risk_analysis import RiskAnalysisService
from app.tasks.scheduler import distributed_lock

logger = setup_logger("tasks.daily_cron")

BATCH_SIZE = 100


# ──────────────────────────────────────────────
#  메인 진입점
# ──────────────────────────────────────────────


async def run_daily_cron() -> None:
    """매일 자정 크론 작업 진입점.

    분산 락을 획득한 인스턴스만 실행한다.
    FINDRISC 재계산 → 참여 상태 갱신 순서로 처리.
    """
    async with distributed_lock("daily-cron", ttl=timedelta(minutes=30)) as acquired:
        if not acquired:
            return

        t0 = time.monotonic()
        logger.info("=== 일일 크론 시작 ===")

        risk_ok, risk_fail = await _recalculate_all_risks()
        eng_ok, eng_fail = await _update_all_engagements()

        elapsed = time.monotonic() - t0
        logger.info(
            "=== 일일 크론 완료 — risk(ok=%d, fail=%d) engagement(ok=%d, fail=%d) elapsed=%.1fs ===",
            risk_ok,
            risk_fail,
            eng_ok,
            eng_fail,
            elapsed,
        )


# ──────────────────────────────────────────────
#  1) FINDRISC 위험도 재계산
# ──────────────────────────────────────────────


async def _recalculate_all_risks() -> tuple[int, int]:
    """전체 활성 사용자의 FINDRISC 위험도를 순차 재계산한다.

    Returns:
        (성공 건수, 실패 건수) 튜플
    """
    service = RiskAnalysisService()
    ok_count = 0
    fail_count = 0
    offset = 0

    while True:
        users = await User.filter(is_active=True).offset(offset).limit(BATCH_SIZE).only("id")

        if not users:
            break

        for user in users:
            try:
                await service.recalculate_risk(user.id)
                ok_count += 1
            except Exception:
                fail_count += 1
                logger.exception("FINDRISC 재계산 실패 — user_id=%d", user.id)

        offset += BATCH_SIZE

    logger.info("FINDRISC 재계산 완료 — ok=%d, fail=%d", ok_count, fail_count)
    return ok_count, fail_count


# ──────────────────────────────────────────────
#  2) 참여 상태(Engagement) 갱신
# ──────────────────────────────────────────────

_ENGAGEMENT_QUERY = """
SELECT ue.user_id, ue.state, ue.state_since,
       COUNT(DISTINCT dhl.log_date) as responded_days,
       DATEDIFF(CURDATE(), COALESCE(MAX(dhl.log_date), DATE_SUB(CURDATE(), INTERVAL 31 DAY))) as last_gap
FROM user_engagements ue
LEFT JOIN daily_health_logs dhl
  ON ue.user_id = dhl.user_id
  AND dhl.log_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY ue.user_id, ue.state, ue.state_since
"""


def _determine_state(responded_days: int, last_gap: int) -> EngagementState:
    """7일 응답률과 마지막 응답 격차로 참여 상태를 결정한다.

    상태 머신 규칙:
      - consecutive_missed > 30 → HIBERNATING
      - rate < 0.20 AND last_gap > 7 → DORMANT
      - rate < 0.50 → LOW
      - rate < 0.80 → MODERATE
      - rate >= 0.80 → ACTIVE

    Args:
        responded_days: 최근 7일 중 응답한 일수 (0-7)
        last_gap: 마지막 응답으로부터 경과한 일수

    Returns:
        결정된 EngagementState
    """
    rate = responded_days / 7.0

    if last_gap > 30:
        return EngagementState.HIBERNATING
    if rate < 0.20 and last_gap > 7:
        return EngagementState.DORMANT
    if rate < 0.50:
        return EngagementState.LOW
    if rate < 0.80:
        return EngagementState.MODERATE
    return EngagementState.ACTIVE


async def _update_all_engagements() -> tuple[int, int]:
    """Raw SQL로 전체 참여 데이터를 조회하고 상태를 갱신한다.

    N+1 문제를 방지하기 위해 단일 쿼리로 모든 사용자의
    7일 응답 일수와 마지막 응답 격차를 한 번에 가져온다.

    Returns:
        (성공 건수, 실패 건수) 튜플
    """
    conn = connections.get("default")
    rows = await conn.execute_query_dict(_ENGAGEMENT_QUERY)

    now = datetime.now(tz=config.TIMEZONE)
    ok_count = 0
    fail_count = 0

    for row in rows:
        try:
            user_id: int = row["user_id"]
            old_state: str = row["state"]
            responded_days: int = row["responded_days"] or 0
            last_gap: int = row["last_gap"] or 0

            new_state = _determine_state(responded_days, last_gap)
            rate = responded_days / 7.0
            rate_decimal = Decimal(str(round(rate, 3)))

            update_fields: dict = {
                "seven_day_response_rate": rate_decimal,
                "consecutive_missed_days": last_gap,
            }

            # 상태가 변경된 경우에만 state + state_since 갱신
            if new_state.value != old_state:
                update_fields["state"] = new_state
                update_fields["state_since"] = now
                logger.info(
                    "참여 상태 변경 — user_id=%d, %s -> %s (rate=%.3f, gap=%d)",
                    user_id,
                    old_state,
                    new_state.value,
                    rate,
                    last_gap,
                )

            await UserEngagement.filter(user_id=user_id).update(**update_fields)
            ok_count += 1

        except Exception:
            fail_count += 1
            logger.exception("참여 상태 갱신 실패 — user_id=%d", row.get("user_id", -1))

    logger.info("참여 상태 갱신 완료 — ok=%d, fail=%d", ok_count, fail_count)
    return ok_count, fail_count
