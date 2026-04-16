"""Shared OpenAI-compatible client lifecycle for chat streaming."""

from __future__ import annotations

import asyncio
import inspect
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from openai import AsyncOpenAI

from backend.core import config
from backend.core.config import LLMFallbackProvider, LLMProvider
from backend.core.logger import setup_logger

logger = setup_logger(__name__)

ClientRole = Literal["primary", "fallback"]


@dataclass(frozen=True)
class LLMTarget:
    role: ClientRole
    provider: LLMProvider
    model: str
    base_url: str | None
    api_key: str


_shared_http_clients: dict[ClientRole, httpx.AsyncClient] = {}
_shared_openai_clients: dict[ClientRole, AsyncOpenAI] = {}


def _clean(value: str | None) -> str:
    return (value or "").strip()


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


def _build_openai_client(target: LLMTarget, http_client: httpx.AsyncClient) -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=target.api_key,
        base_url=target.base_url,
        http_client=http_client,
        max_retries=config.CHAT_OPENAI_STREAM_MAX_RETRIES,
    )


def _gemma_target() -> LLMTarget:
    base_url = _clean(config.LLM_BASE_URL) or "http://gemma-runtime:8001/v1"
    model = _clean(config.LLM_MODEL) or "google/gemma-4-E4B-it"
    api_key = _clean(config.LLM_API_KEY) or "local-vllm"
    return LLMTarget(
        role="primary",
        provider=LLMProvider.GEMMA_VLLM,
        model=model,
        base_url=base_url,
        api_key=api_key,
    )


def _openai_target(*, role: ClientRole) -> LLMTarget | None:
    if role == "primary":
        model = _clean(config.LLM_MODEL) or _clean(config.OPENAI_MODEL)
        api_key = _clean(config.LLM_API_KEY) or _clean(config.OPENAI_API_KEY)
        base_url = _clean(config.LLM_BASE_URL) or _clean(config.OPENAI_BASE_URL)
    else:
        if config.LLM_FALLBACK_PROVIDER != LLMFallbackProvider.OPENAI:
            return None
        model = _clean(config.OPENAI_MODEL)
        api_key = _clean(config.OPENAI_API_KEY)
        base_url = _clean(config.OPENAI_BASE_URL)

    if not model or not api_key:
        return None

    return LLMTarget(
        role=role,
        provider=LLMProvider.OPENAI,
        model=model,
        base_url=base_url or None,
        api_key=api_key,
    )


def get_llm_target(role: ClientRole = "primary") -> LLMTarget | None:
    if role == "primary":
        if config.LLM_PROVIDER == LLMProvider.GEMMA_VLLM:
            return _gemma_target()
        return _openai_target(role="primary")

    fallback = _openai_target(role="fallback")
    primary = get_llm_target("primary")
    if fallback is None:
        return None
    if primary is not None and (
        fallback.provider,
        fallback.model,
        fallback.base_url,
        fallback.api_key,
    ) == (
        primary.provider,
        primary.model,
        primary.base_url,
        primary.api_key,
    ):
        return None
    return fallback


def has_any_llm_target() -> bool:
    return get_llm_target("primary") is not None or get_llm_target("fallback") is not None


def get_active_llm_model() -> str:
    target = get_llm_target("primary") or get_llm_target("fallback")
    return target.model if target is not None else (_clean(config.LLM_MODEL) or _clean(config.OPENAI_MODEL))


def get_active_llm_provider() -> str:
    target = get_llm_target("primary") or get_llm_target("fallback")
    return target.provider.value if target is not None else config.LLM_PROVIDER.value


def should_include_stream_usage(target: LLMTarget) -> bool:
    return target.provider == LLMProvider.OPENAI


async def init_shared_openai_client() -> None:
    for role in ("primary", "fallback"):
        target = get_llm_target(role)
        if target is None or role in _shared_openai_clients:
            continue
        http_client = _build_http_client()
        _shared_http_clients[role] = http_client
        _shared_openai_clients[role] = _build_openai_client(target, http_client)


async def warmup_shared_openai_client() -> bool:
    await init_shared_openai_client()
    targets = [target for target in (get_llm_target("primary"), get_llm_target("fallback")) if target is not None]
    if not targets:
        return False

    for target in targets:
        try:
            client = get_openai_client(target.role)
            await asyncio.wait_for(
                client.chat.completions.create(
                    model=target.model,
                    messages=[{"role": "user", "content": "."}],
                    max_tokens=1,
                    stream=False,
                    user="warmup",
                ),
                timeout=10.0,
            )

            stream = None
            try:
                kwargs = {}
                if should_include_stream_usage(target):
                    kwargs["stream_options"] = {"include_usage": True}
                stream = await asyncio.wait_for(
                    client.chat.completions.create(
                        model=target.model,
                        messages=[{"role": "user", "content": "."}],
                        max_tokens=1,
                        stream=True,
                        user="warmup-stream",
                        **kwargs,
                    ),
                    timeout=5.0,
                )
                await asyncio.wait_for(anext(stream), timeout=5.0)
            except Exception:
                logger.warning("chat_llm_stream_warmup_failed", provider=target.provider.value, model=target.model)
            finally:
                if stream is not None:
                    await close_stream_resource(stream)
            return True
        except Exception:
            logger.warning("chat_llm_client_target_warmup_failed", provider=target.provider.value, model=target.model)

    logger.warning("chat_llm_client_warmup_failed")
    return False


async def close_shared_openai_client() -> None:
    clients = list(_shared_http_clients.values())
    _shared_openai_clients.clear()
    _shared_http_clients.clear()
    for client in clients:
        await client.aclose()


def get_openai_client(role: ClientRole = "primary") -> AsyncOpenAI:
    target = get_llm_target(role)
    if target is None:
        raise RuntimeError(f"LLM target is not configured for role={role}")

    if not config.CHAT_OPENAI_SHARED_CLIENT_ENABLED:
        return AsyncOpenAI(
            api_key=target.api_key,
            base_url=target.base_url,
            max_retries=config.CHAT_OPENAI_STREAM_MAX_RETRIES,
        )

    if role not in _shared_openai_clients:
        http_client = _build_http_client()
        _shared_http_clients[role] = http_client
        _shared_openai_clients[role] = _build_openai_client(target, http_client)
    return _shared_openai_clients[role]


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
