from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
from tortoise import Tortoise

from backend.apis.v1 import v1_routers
from backend.core import config
from backend.core.config import ChatLangGraphMode, Env
from backend.core.logger import setup_logger
from backend.core.sentry import init_sentry
from backend.db.databases import TORTOISE_APP_MODELS, TORTOISE_ORM
from backend.middleware.cors import setup_cors
from backend.middleware.rate_limit import setup_rate_limit

logger = setup_logger("backend.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:  # noqa: C901
    """FastAPI 수명주기."""
    del app
    init_sentry()

    Tortoise.init_models(TORTOISE_APP_MODELS, "models")
    await Tortoise.init(config=TORTOISE_ORM)
    logger.info("tortoise_ready")

    scheduler_started = False
    try:
        from backend.core.redis import get_redis

        redis = get_redis()
        await redis.ping()
        logger.info("redis_ready")

        from backend.tasks.scheduler import start_scheduler

        start_scheduler()
        scheduler_started = True
    except Exception:
        logger.warning("redis_or_scheduler_startup_failed")

    if config.RAG_ENABLED:
        try:
            from backend.services.rag_corpus import load_corpus

            load_corpus()
            logger.info("rag_corpus_loaded")
        except Exception:
            logger.warning("rag_corpus_load_failed")

    try:
        from backend.services.chat.openai_client import init_shared_openai_client, warmup_shared_openai_client

        await init_shared_openai_client()
        if await warmup_shared_openai_client():
            logger.info("chat_llm_client_ready")
        else:
            logger.warning("chat_llm_client_warmup_skipped")
    except Exception:
        logger.warning("chat_llm_client_startup_failed")

    if config.CHAT_LANGGRAPH_MODE != ChatLangGraphMode.OFF:
        try:
            from backend.services.chat_graph.adapter import start_audit_worker
            from backend.services.chat_graph.graph import warmup_chat_prep_graph

            start_audit_worker()
            if warmup_chat_prep_graph():
                logger.info("chat_langgraph_ready")
            else:
                logger.warning("chat_langgraph_disabled")
        except Exception:
            logger.warning("chat_langgraph_startup_failed")

    yield

    if scheduler_started:
        from backend.tasks.scheduler import shutdown_scheduler

        shutdown_scheduler()

    try:
        from backend.core.redis import close_redis

        await close_redis()
    except Exception:
        pass

    try:
        from backend.services.chat_graph.adapter import stop_audit_worker

        await stop_audit_worker()
    except Exception:
        pass

    try:
        from backend.services.chat.openai_client import close_shared_openai_client

        await close_shared_openai_client()
    except Exception:
        pass

    await Tortoise.close_connections()
    logger.info("shutdown_complete")


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
