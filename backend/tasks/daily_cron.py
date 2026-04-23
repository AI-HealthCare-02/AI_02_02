"""매일 자정(KST) 크론 — FINDRISC 재계산 + 참여 상태 갱신 + 챌린지 일일 리셋.

실행 시점: 매일 00:00 KST (APScheduler CronTrigger)
처리 내용:
  1. 전체 활성 사용자 FINDRISC 위험도 재계산 (BATCH_SIZE=100, 순차 처리)
  2. 전체 사용자 참여 상태(EngagementState) 갱신 — ORM 2회 조회 + 배치 업데이트
  3. 활성 챌린지의 ``today_checked`` 필드를 False로 리셋 (hot path 캐시 일관성)

분산 락으로 다중 인스턴스 환경에서 중복 실행을 방지한다.
"""

from __future__ import annotations

import time
from datetime import date, datetime, timedelta
from decimal import Decimal

from tortoise.functions import Count, Max

from backend.core import config
from backend.core.logger import setup_logger
from backend.models.assessments import UserEngagement
from backend.models.challenges import UserChallenge
from backend.models.enums import ChallengeStatus, EngagementState
from backend.models.health import DailyHealthLog
from backend.models.users import User
from backend.services.risk_analysis import RiskAnalysisService
from backend.tasks.scheduler import distributed_lock

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
        reset_count = await _reset_challenge_today_checked()

        elapsed = time.monotonic() - t0
        logger.info(
            "=== 일일 크론 완료 — risk(ok=%d, fail=%d) engagement(ok=%d, fail=%d) "
            "today_reset=%d elapsed=%.1fs ===",
            risk_ok,
            risk_fail,
            eng_ok,
            eng_fail,
            reset_count,
            elapsed,
        )


# ──────────────────────────────────────────────
#  1) FINDRISC 위험도 재계산
# ──────────────────────────────────────────────


async def _recalculate_all_risks() -> tuple[int, int]:
    """전체 활성 사용자의 FINDRISC 위험도를 순차 재계산한다.

    AI 코칭(OpenAI) 생성은 스킵 — 자정 일괄 호출은 비용 폭발 원인.
    대신 재계산 후 ``report:risk:{user_id}`` 캐시를 미리 워밍해서
    다음 날 첫 리포트 진입자에게 즉시 응답한다.

    Returns:
        (성공 건수, 실패 건수) 튜플
    """
    from backend.core.cache import set_cached
    from backend.services.risk_analysis import (
        CACHE_TTL_RISK_SECONDS,
        invalidate_report_caches,
        risk_current_cache_key,
    )

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
                detail = await service.recalculate_risk(user.id, generate_coaching=False)
                # 기존 report:* 캐시 무효화 후 최신 값 프리워밍
                await invalidate_report_caches(user.id)
                if detail is not None:
                    await set_cached(
                        risk_current_cache_key(user.id),
                        detail.model_dump(mode="json"),
                        ttl_seconds=CACHE_TTL_RISK_SECONDS,
                    )
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
    """전체 참여 데이터를 ORM으로 조회하고 상태를 갱신한다.

    N+1 방지: 2개 쿼리로 분리 (참여 데이터 + 7일 응답 통계).

    Returns:
        (성공 건수, 실패 건수) 튜플
    """
    today = date.today()
    week_ago = today - timedelta(days=7)
    now = datetime.now(tz=config.TIMEZONE)

    # 쿼리 1: 전체 참여 레코드
    engagements = await UserEngagement.all().values("user_id", "state", "state_since")

    # 쿼리 2: 최근 7일 응답 통계 (user_id별 응답 일수 + 마지막 기록일)
    stats_rows = await (
        DailyHealthLog.filter(log_date__gte=week_ago)
        .values("user_id")
        .annotate(responded_days=Count("log_date", distinct=True), last_log_date=Max("log_date"))
    )
    response_stats: dict[int, dict] = {}
    for row in stats_rows:
        last_log = row["last_log_date"]
        response_stats[row["user_id"]] = {
            "responded_days": row["responded_days"],
            "last_gap": (today - last_log).days if last_log else 31,
        }

    ok_count = 0
    fail_count = 0

    for eng in engagements:
        try:
            user_id: int = eng["user_id"]
            old_state: str = eng["state"]
            stats = response_stats.get(user_id, {"responded_days": 0, "last_gap": 31})
            responded_days: int = stats["responded_days"]
            last_gap: int = stats["last_gap"]

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
            logger.exception("참여 상태 갱신 실패 — user_id=%d", eng.get("user_id", -1))

    logger.info("참여 상태 갱신 완료 — ok=%d, fail=%d", ok_count, fail_count)
    return ok_count, fail_count


# ──────────────────────────────────────────────
#  3) 챌린지 today_checked 일일 리셋
# ──────────────────────────────────────────────


async def _reset_challenge_today_checked() -> int:
    """활성 챌린지의 ``today_checked`` 플래그를 False로 일괄 초기화.

    ``get_overview`` 는 ``ChallengeCheckin`` 조회로 오늘 체크인 여부를 동적 계산하지만,
    ``UserChallenge.today_checked`` 필드 역시 일관성을 위해 매일 자정에 리셋한다.
    크론 누락 시에도 동적 계산이 우선이므로 UX에는 영향 없다.

    Returns:
        갱신된 레코드 수 (백엔드 로그/모니터링용).
    """
    try:
        count = await UserChallenge.filter(
            status=ChallengeStatus.ACTIVE,
            today_checked=True,
        ).update(today_checked=False)
        logger.info("챌린지 today_checked 리셋 완료 — count=%d", count)
        return count
    except Exception:
        logger.exception("챌린지 today_checked 리셋 실패")
        return 0
