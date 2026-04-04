from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
from tortoise import Tortoise

from app.apis.v1 import v1_routers
from app.core import config
from app.core.config import Env
from app.core.logger import setup_logger
from app.core.sentry import init_sentry
from app.db.databases import TORTOISE_APP_MODELS, TORTOISE_ORM
from app.middleware.cors import setup_cors
from app.middleware.rate_limit import setup_rate_limit

logger = setup_logger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """FastAPI 생명주기: Sentry → Tortoise → Redis → Scheduler 순서로 시작, 역순 종료."""
    # ── Startup ──────────────────────────────────────────────
    # 0) Sentry (에러 추적 — DSN 비어있으면 건너뜀)
    init_sentry()

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

    # 3) RAG corpus warm-up (실패해도 앱 차단 안 함)
    if config.RAG_ENABLED:
        try:
            from app.services.rag_corpus import load_corpus

            load_corpus()
            logger.info("rag_corpus_loaded")
        except Exception:
            logger.warning("rag_corpus_load_failed")

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


_is_prod = config.ENV == Env.PROD

app = FastAPI(
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
    docs_url=None if _is_prod else "/api/docs",
    redoc_url=None if _is_prod else "/api/redoc",
    openapi_url=None if _is_prod else "/api/openapi.json",
)

setup_cors(app)
setup_rate_limit(app)

app.include_router(v1_routers)
