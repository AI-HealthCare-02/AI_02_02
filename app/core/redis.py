"""Redis 비동기 클라이언트 — ConnectionPool 기반.

단일 연결 대신 풀을 사용하여 동시 요청 처리 성능을 확보한다.
dev=20, prod=50 커넥션 (REDIS_MAX_CONNECTIONS 환경변수로 조정).
"""

from __future__ import annotations

import redis.asyncio as aioredis

from app.core.config import Config
from app.core.logger import setup_logger

logger = setup_logger("core.redis")

_config = Config()

_pool: aioredis.ConnectionPool | None = None
_redis_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Redis 비동기 클라이언트를 반환한다 (ConnectionPool 사용).

    Returns:
        redis.asyncio.Redis: 비동기 Redis 클라이언트
    """
    global _pool, _redis_client  # noqa: PLW0603

    if _redis_client is None:
        _pool = aioredis.ConnectionPool(
            host=_config.REDIS_HOST,
            port=_config.REDIS_PORT,
            db=_config.REDIS_DB,
            max_connections=_config.REDIS_MAX_CONNECTIONS,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
        )
        _redis_client = aioredis.Redis(connection_pool=_pool)
        logger.info(
            "Redis ConnectionPool 생성 — host=%s, port=%d, max_connections=%d",
            _config.REDIS_HOST,
            _config.REDIS_PORT,
            _config.REDIS_MAX_CONNECTIONS,
        )

    return _redis_client


async def close_redis() -> None:
    """Redis 연결 풀을 안전하게 종료한다."""
    global _pool, _redis_client  # noqa: PLW0603

    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None

    if _pool is not None:
        await _pool.disconnect()
        _pool = None
        logger.info("Redis ConnectionPool 종료 완료")
