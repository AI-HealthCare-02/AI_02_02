"""
APScheduler 기반 비동기 스케줄러 + Redis 분산 락.

- distributed_lock: Redis SETNX + Lua 원자적 해제로 다중 인스턴스 환경에서 중복 실행 방지
- get_scheduler / start_scheduler / shutdown_scheduler: APScheduler 생명주기 관리
"""

from __future__ import annotations

import contextlib
import uuid
from collections.abc import AsyncIterator
from datetime import timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from backend.core.logger import setup_logger
from backend.core.redis import get_redis

logger = setup_logger("tasks.scheduler")

# ──────────────────────────────────────────────
#  분산 락 (Distributed Lock)
# ──────────────────────────────────────────────

# Lua 스크립트: 토큰이 일치할 때만 키를 삭제 (원자적 연산)
_RELEASE_LOCK_LUA = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


@contextlib.asynccontextmanager
async def distributed_lock(
    lock_name: str,
    ttl: timedelta = timedelta(minutes=30),
) -> AsyncIterator[bool]:
    """Redis 기반 분산 락 컨텍스트 매니저.

    SETNX(SET if Not eXists)로 락을 획득하고, Lua 스크립트로 원자적으로 해제한다.
    TTL은 프로세스 크래시 시 락이 영원히 남는 것을 방지하는 안전장치이다.

    사용 예시::

        async with distributed_lock("daily-cron") as acquired:
            if acquired:
                await do_work()
            else:
                logger.info("다른 인스턴스가 이미 실행 중")

    Args:
        lock_name: 락의 Redis 키 이름 (접두사 "lock:" 자동 추가)
        ttl: 락 자동 만료 시간. 기본 30분

    Yields:
        bool: True면 락 획득 성공, False면 이미 다른 프로세스가 보유 중
    """
    redis = get_redis()
    key = f"lock:{lock_name}"
    token = str(uuid.uuid4())
    ttl_seconds = int(ttl.total_seconds())

    # SETNX + EX 를 한 번의 명령으로 처리 (원자적)
    acquired: bool = await redis.set(key, token, nx=True, ex=ttl_seconds)  # type: ignore[assignment]
    acquired = bool(acquired)

    if acquired:
        logger.info("분산 락 획득 — key=%s, ttl=%ds", key, ttl_seconds)
    else:
        logger.info("분산 락 획득 실패 (이미 보유 중) — key=%s", key)

    try:
        yield acquired
    finally:
        if acquired:
            # Lua 스크립트로 원자적 해제: 내 토큰일 때만 삭제
            result = await redis.eval(_RELEASE_LOCK_LUA, 1, key, token)
            if result:
                logger.info("분산 락 해제 완료 — key=%s", key)
            else:
                logger.warning("분산 락 해제 스킵 (TTL 만료 또는 토큰 불일치) — key=%s", key)


# ──────────────────────────────────────────────
#  APScheduler 구성
# ──────────────────────────────────────────────

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    """APScheduler 싱글턴을 반환한다.

    첫 호출 시 스케줄러를 생성하고 크론 잡을 등록한다.
    순환 임포트 방지를 위해 태스크 모듈은 이 함수 내부에서 lazy import 한다.

    Returns:
        AsyncIOScheduler: 구성 완료된 비동기 스케줄러
    """
    global _scheduler  # noqa: PLW0603

    if _scheduler is not None:
        return _scheduler

    # 순환 임포트 방지 — 태스크 모듈을 여기서 lazy import
    from backend.tasks.daily_cron import run_daily_cron
    from backend.tasks.push_notifications import run_push_notification_tick
    from backend.tasks.weekly_cron import run_weekly_cron

    _scheduler = AsyncIOScheduler(
        timezone="Asia/Seoul",
        job_defaults={
            "coalesce": True,       # 밀린 실행을 하나로 합침
            "max_instances": 1,     # 동시에 1개만 실행
            "misfire_grace_time": 3600,  # 최대 1시간까지 지연 실행 허용
        },
    )

    # 매일 자정 (KST 00:00) 실행
    _scheduler.add_job(
        run_daily_cron,
        trigger=CronTrigger(hour=0, minute=0, timezone="Asia/Seoul"),
        id="daily_cron",
        name="일일 크론 작업",
        replace_existing=True,
    )

    # 매주 월요일 새벽 1시 (KST 01:00) 실행
    _scheduler.add_job(
        run_weekly_cron,
        trigger=CronTrigger(day_of_week="mon", hour=1, minute=0, timezone="Asia/Seoul"),
        id="weekly_cron",
        name="주간 크론 작업",
        replace_existing=True,
    )

    _scheduler.add_job(
        run_push_notification_tick,
        trigger=IntervalTrigger(seconds=10, timezone="Asia/Seoul"),
        id="push_notifications",
        name="Web Push notification reminders",
        replace_existing=True,
    )

    logger.info("APScheduler 구성 완료 — 등록된 잡 %d개", len(_scheduler.get_jobs()))
    return _scheduler


# ──────────────────────────────────────────────
#  생명주기 함수
# ──────────────────────────────────────────────


def start_scheduler() -> None:
    """스케줄러를 시작한다.

    FastAPI lifespan 또는 startup 이벤트에서 호출한다.
    """
    scheduler = get_scheduler()
    scheduler.start()
    job_count = len(scheduler.get_jobs())
    logger.info("스케줄러 시작 완료 — 활성 잡 %d개", job_count)


def shutdown_scheduler() -> None:
    """스케줄러를 종료한다.

    FastAPI shutdown 이벤트에서 호출한다.
    wait=False로 현재 실행 중인 잡의 완료를 기다리지 않고 즉시 종료한다.
    """
    global _scheduler  # noqa: PLW0603

    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        logger.info("스케줄러 종료 완료")
        _scheduler = None
