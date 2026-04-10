"""OpenAI streaming and SSE helpers."""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncGenerator

import orjson

from backend.core import config
from backend.core.logger import setup_logger
from backend.services.chat.openai_client import close_stream_resource, get_openai_client
from backend.services.chat.token_budget import record_bench_budget_snapshot

logger = setup_logger(__name__)


def _chat_openai_max_tokens() -> int:
    """Return the active output cap for TTFT/done experiments."""
    value = (
        config.CHAT_OPENAI_SHORT_RESPONSE_MAX_TOKENS
        if config.CHAT_OPENAI_SHORT_RESPONSE_ENABLED
        else config.CHAT_OPENAI_MAX_TOKENS
    )
    return max(1, int(value))


async def _stream_openai(
    messages: list[dict[str, str]],
    *,
    chat_req_id: str | None = None,
) -> AsyncGenerator[str | None, None]:
    """OpenAI 스트리밍 응답. 오류 시 None yield."""
    stream = None
    first_chunk_started_at = time.perf_counter()
    total_deadline_at = first_chunk_started_at + (config.CHAT_OPENAI_STREAM_TOTAL_DEADLINE_MS / 1000)
    first_token_seen = False

    try:
        client = get_openai_client()
        stream = await client.chat.completions.create(
            model=config.OPENAI_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=_chat_openai_max_tokens(),
            stream=True,
        )

        while True:
            remaining_total = total_deadline_at - time.perf_counter()
            if remaining_total <= 0:
                logger.warning("chat_openai_timeout_total", chat_req_id=chat_req_id, reason="total_stream_deadline")
                yield None
                return

            timeout_ms = (
                config.CHAT_OPENAI_STREAM_FIRST_TOKEN_TIMEOUT_MS
                if not first_token_seen
                else config.CHAT_OPENAI_STREAM_INTER_TOKEN_TIMEOUT_MS
            )
            timeout_seconds = min(timeout_ms / 1000, remaining_total)

            try:
                chunk = await asyncio.wait_for(anext(stream), timeout=timeout_seconds)
            except StopAsyncIteration:
                return
            except TimeoutError:
                logger.warning(
                    "chat_openai_timeout_total",
                    chat_req_id=chat_req_id,
                    reason="first_token_timeout" if not first_token_seen else "inter_token_timeout",
                )
                yield None
                return

            content = None
            if chunk.choices and chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content

            if content:
                if not first_token_seen:
                    first_token_seen = True
                    first_content_ms = round((time.perf_counter() - first_chunk_started_at) * 1000, 2)
                    record_bench_budget_snapshot(
                        chat_req_id,
                        openai_first_content_ms=first_content_ms,
                        openai_max_tokens=_chat_openai_max_tokens(),
                        short_response_enabled=config.CHAT_OPENAI_SHORT_RESPONSE_ENABLED,
                    )
                    logger.info(
                        "chat_openai_first_content_ms",
                        chat_req_id=chat_req_id,
                        first_content_ms=first_content_ms,
                    )
                yield content
    except Exception as exc:
        logger.exception("chat_stream_error_total", chat_req_id=chat_req_id, error=type(exc).__name__)
        yield None
    finally:
        if stream is not None:
            await close_stream_resource(stream)


def _sse_event(event_type: str, data: dict) -> str:
    """SSE 이벤트 포맷."""
    return f"event: {event_type}\ndata: {orjson.dumps(data).decode('utf-8')}\n\n"
