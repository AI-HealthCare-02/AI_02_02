"""Redis 캐시 유틸리티 — orjson 직렬화.

쿼리별 개별 TTL로 대시보드 등에서 활용.
"""

from __future__ import annotations

from typing import Any

import orjson

from backend.core.redis import get_redis


async def get_cached(key: str) -> Any | None:
    """캐시 키로부터 JSON 역직렬화된 값을 반환한다. 없으면 None."""
    redis = get_redis()
    raw = await redis.get(key)
    if raw is None:
        return None
    return orjson.loads(raw)


async def set_cached(key: str, value: Any, ttl_seconds: int) -> None:
    """값을 JSON 직렬화하여 캐시에 저장한다."""
    redis = get_redis()
    await redis.set(key, orjson.dumps(value).decode(), ex=ttl_seconds)


async def delete_cached(key: str) -> None:
    """캐시 키를 삭제한다."""
    redis = get_redis()
    await redis.delete(key)
