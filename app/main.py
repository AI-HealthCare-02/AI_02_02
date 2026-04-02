from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
from tortoise import Tortoise

from app.apis.v1 import v1_routers
from app.core.logger import setup_logger
from app.db.databases import TORTOISE_APP_MODELS, TORTOISE_ORM

logger = setup_logger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """FastAPI 생명주기: Tortoise → Redis → Scheduler 순서로 시작, 역순 종료."""
    # ── Startup ──────────────────────────────────────────────
    # 1) Tortoise ORM
    Tortoise.init_models(TORTOISE_APP_MODELS, "models")
    await Tortoise.init(config=TORTOISE_ORM)
    logger.info("Tortoise ORM 초기화 완료")

    # 2) Redis + Scheduler (우아한 저하: Redis 실패 시 스케줄러만 비활성화)
    scheduler_started = False
    try:
        from app.core.redis import get_redis

        redis = get_redis()
        await redis.ping()
        logger.info("Redis 연결 성공")

        from app.tasks.scheduler import start_scheduler

        start_scheduler()
        scheduler_started = True
    except Exception:
        logger.warning("Redis/Scheduler 시작 실패 — 스케줄러 비활성화, API는 정상 작동")

    yield

    # ── Shutdown (역순) ──────────────────────────────────────
    if scheduler_started:
        from app.tasks.scheduler import shutdown_scheduler

        shutdown_scheduler()

    try:
        from app.core.redis import close_redis

        await close_redis()
    except Exception:
        pass

    await Tortoise.close_connections()
    logger.info("모든 연결 종료 완료")


app = FastAPI(
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.include_router(v1_routers)
