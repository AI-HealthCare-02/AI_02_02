"""Shared OpenAI client lifecycle for chat streaming."""

from __future__ import annotations

import asyncio
import inspect
from typing import Any

import httpx
from openai import AsyncOpenAI

from backend.core import config
from backend.core.logger import setup_logger

logger = setup_logger(__name__)

_shared_http_client: httpx.AsyncClient | None = None
_shared_openai_client: AsyncOpenAI | None = None


def _build_http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.AsyncHTTPTransport(retries=0),
        timeout=httpx.Timeout(
            connect=config.CHAT_OPENAI_STREAM_CONNECT_TIMEOUT_MS / 1000,
            pool=config.CHAT_OPENAI_STREAM_POOL_TIMEOUT_MS / 1000,
            write=config.CHAT_OPENAI_STREAM_WRITE_TIMEOUT_MS / 1000,
            read=None,
        ),
        limits=httpx.Limits(
            max_connections=config.CHAT_OPENAI_STREAM_MAX_CONNECTIONS,
            max_keepalive_connections=config.CHAT_OPENAI_STREAM_MAX_KEEPALIVE_CONNECTIONS,
        ),
    )


def _build_openai_client(http_client: httpx.AsyncClient) -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=config.OPENAI_API_KEY,
        http_client=http_client,
        max_retries=config.CHAT_OPENAI_STREAM_MAX_RETRIES,
    )


async def init_shared_openai_client() -> None:
    global _shared_http_client, _shared_openai_client  # noqa: PLW0603
    if _shared_openai_client is not None or not config.OPENAI_API_KEY:
        return

    _shared_http_client = _build_http_client()
    _shared_openai_client = _build_openai_client(_shared_http_client)


async def warmup_shared_openai_client() -> bool:
    try:
        await init_shared_openai_client()
        if _shared_openai_client is None:
            return False
        # 실제 OpenAI 네트워크 호출로 TCP/TLS/DNS/OpenAI 내부 라우팅 캐시 warming.
        # 1 토큰 dummy 요청으로 첫 사용자 cold latency를 startup 시점에 흡수.
        # 실패는 non-fatal: 앱 부팅은 계속되고 첫 사용자가 cold를 그대로 겪을 뿐.
        await asyncio.wait_for(
            _shared_openai_client.chat.completions.create(
                model=config.OPENAI_MODEL,
                messages=[{"role": "user", "content": "."}],
                max_tokens=1,
                stream=False,
                user="warmup",
            ),
            timeout=10.0,
        )
        # 스트리밍 경로도 warm: stream=True 전용 핸드쉐이크/커넥션 캐시.
        stream = None
        try:
            stream = await asyncio.wait_for(
                _shared_openai_client.chat.completions.create(
                    model=config.OPENAI_MODEL,
                    messages=[{"role": "user", "content": "."}],
                    max_tokens=1,
                    stream=True,
                    user="warmup-stream",
                ),
                timeout=5.0,
            )
            await asyncio.wait_for(anext(stream), timeout=5.0)
        except Exception:
            logger.warning("chat_openai_client_stream_warmup_failed")
        finally:
            if stream is not None:
                await close_stream_resource(stream)
        return True
    except Exception:
        logger.warning("chat_openai_client_warmup_failed")
        return False


async def close_shared_openai_client() -> None:
    global _shared_http_client, _shared_openai_client  # noqa: PLW0603
    client = _shared_http_client
    _shared_openai_client = None
    _shared_http_client = None
    if client is not None:
        await client.aclose()


def get_openai_client() -> AsyncOpenAI:
    global _shared_http_client, _shared_openai_client  # noqa: PLW0603
    if not config.CHAT_OPENAI_SHARED_CLIENT_ENABLED:
        return AsyncOpenAI(api_key=config.OPENAI_API_KEY)

    if _shared_openai_client is None:
        _shared_http_client = _build_http_client()
        _shared_openai_client = _build_openai_client(_shared_http_client)
    return _shared_openai_client


async def close_stream_resource(resource: Any) -> None:
    close = getattr(resource, "close", None)
    if close is not None:
        maybe = close()
        if inspect.isawaitable(maybe):
            await maybe
        return

    aclose = getattr(resource, "aclose", None)
    if aclose is not None:
        await aclose()
