"""
Redis 비동기 싱글턴 클라이언트.

애플리케이션 전체에서 하나의 Redis 커넥션을 공유한다.
첫 호출 시 연결을 생성하고, 이후에는 캐싱된 인스턴스를 반환한다.
"""

from __future__ import annotations

import redis.asyncio as aioredis

from app.core.config import Config
from app.core.logger import setup_logger

logger = setup_logger("core.redis")

_config = Config()

# 모듈 레벨 싱글턴 — get_redis()로만 접근
_redis_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Redis 비동기 클라이언트 싱글턴을 반환한다.

    첫 호출 시 커넥션을 생성하고, 이후에는 동일 인스턴스를 재사용한다.
    decode_responses=True 이므로 모든 응답이 str로 디코딩된다.

    Returns:
        redis.asyncio.Redis: 비동기 Redis 클라이언트
    """
    global _redis_client  # noqa: PLW0603

    if _redis_client is None:
        _redis_client = aioredis.Redis(
            host=_config.REDIS_HOST,
            port=_config.REDIS_PORT,
            db=_config.REDIS_DB,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
        )
        logger.info(
            "Redis 클라이언트 생성 완료 — host=%s, port=%d, db=%d",
            _config.REDIS_HOST,
            _config.REDIS_PORT,
            _config.REDIS_DB,
        )

    return _redis_client


async def close_redis() -> None:
    """Redis 연결을 안전하게 종료한다.

    애플리케이션 shutdown 이벤트에서 호출해야 한다.
    이미 닫혀 있거나 생성되지 않은 경우 아무 동작도 하지 않는다.
    """
    global _redis_client  # noqa: PLW0603

    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
        logger.info("Redis 연결 종료 완료")
