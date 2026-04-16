"""OpenAI-compatible streaming and SSE helpers."""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncGenerator
from typing import Any

import orjson

from backend.core import config
from backend.core.logger import setup_logger
from backend.services.chat.openai_client import (
    close_stream_resource,
    get_llm_target,
    get_openai_client,
    should_include_stream_usage,
)
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


def _log_chunk_usage(chunk: Any, chat_req_id: str | None, *, model: str, provider: str) -> None:
    usage = getattr(chunk, "usage", None)
    if usage is None:
        return
    logger.info(
        "chat_llm_usage",
        chat_req_id=chat_req_id,
        provider=provider,
        model=model,
        prompt_tokens=getattr(usage, "prompt_tokens", None),
        completion_tokens=getattr(usage, "completion_tokens", None),
        total_tokens=getattr(usage, "total_tokens", None),
    )


async def _stream_openai(  # noqa: C901
    messages: list[dict[str, str]],
    *,
    chat_req_id: str | None = None,
) -> AsyncGenerator[str | None, None]:
    """Primary LLM stream with pre-token OpenAI fallback."""

    started_at = time.perf_counter()
    total_deadline_at = started_at + (config.CHAT_OPENAI_STREAM_TOTAL_DEADLINE_MS / 1000)
    first_token_seen = False
    primary_target = get_llm_target("primary")
    fallback_target = get_llm_target("fallback")
    targets = [target for target in (primary_target, fallback_target) if target is not None]

    if not targets:
        logger.warning("chat_llm_not_configured", chat_req_id=chat_req_id)
        yield None
        return

    for index, target in enumerate(targets):
        stream = None
        try:
            client = get_openai_client(target.role)
            request_kwargs: dict[str, Any] = {
                "model": target.model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": _chat_openai_max_tokens(),
                "stream": True,
            }
            if should_include_stream_usage(target):
                request_kwargs["stream_options"] = {"include_usage": True}

            logger.info(
                "chat_llm_stream_start",
                chat_req_id=chat_req_id,
                provider=target.provider.value,
                model=target.model,
                role=target.role,
            )
            stream = await client.chat.completions.create(**request_kwargs)

            while True:
                remaining_total = total_deadline_at - time.perf_counter()
                if remaining_total <= 0:
                    logger.warning(
                        "chat_llm_timeout_total",
                        chat_req_id=chat_req_id,
                        provider=target.provider.value,
                        model=target.model,
                        reason="total_stream_deadline",
                    )
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
                    if not first_token_seen and index == 0 and fallback_target is not None:
                        logger.warning(
                            "chat_llm_pre_token_timeout_fallback",
                            chat_req_id=chat_req_id,
                            provider=target.provider.value,
                            model=target.model,
                        )
                        break

                    logger.warning(
                        "chat_llm_timeout_total",
                        chat_req_id=chat_req_id,
                        provider=target.provider.value,
                        model=target.model,
                        reason="first_token_timeout" if not first_token_seen else "inter_token_timeout",
                    )
                    yield None
                    return

                _log_chunk_usage(
                    chunk,
                    chat_req_id,
                    model=target.model,
                    provider=target.provider.value,
                )

                content = None
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content

                if content:
                    if not first_token_seen:
                        first_token_seen = True
                        first_content_ms = round((time.perf_counter() - started_at) * 1000, 2)
                        record_bench_budget_snapshot(
                            chat_req_id,
                            openai_first_content_ms=first_content_ms,
                            openai_max_tokens=_chat_openai_max_tokens(),
                            short_response_enabled=config.CHAT_OPENAI_SHORT_RESPONSE_ENABLED,
                            llm_provider=target.provider.value,
                            llm_model=target.model,
                        )
                        logger.info(
                            "chat_llm_first_content_ms",
                            chat_req_id=chat_req_id,
                            provider=target.provider.value,
                            model=target.model,
                            first_content_ms=first_content_ms,
                        )
                    yield content
        except Exception as exc:
            if not first_token_seen and index == 0 and fallback_target is not None:
                logger.warning(
                    "chat_llm_pre_token_fallback",
                    chat_req_id=chat_req_id,
                    provider=target.provider.value,
                    model=target.model,
                    error=type(exc).__name__,
                )
                continue

            logger.exception(
                "chat_stream_error_total",
                chat_req_id=chat_req_id,
                provider=target.provider.value,
                model=target.model,
                error=type(exc).__name__,
            )
            yield None
            return
        finally:
            if stream is not None:
                await close_stream_resource(stream)


def _sse_event(event_type: str, data: dict) -> str:
    """SSE event serialization."""
    return f"event: {event_type}\ndata: {orjson.dumps(data).decode('utf-8')}\n\n"
