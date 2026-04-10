"""Feature-flagged adapter for LangGraph-backed chat preparation."""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
from collections.abc import Awaitable

import backend.services.chat_graph.nodes as graph_nodes
from backend.core import config
from backend.core.config import ChatLangGraphMode
from backend.core.logger import setup_logger
from backend.models.enums import FilterMedicalAction
from backend.services.chat.enrich import (
    _select_topic_hint,
    _should_build_user_context_from_projection,
    _should_run_rag_from_projection,
)
from backend.services.chat.prompting import (
    _build_openai_messages_from_base_prompt,
    _prompt_policy_from_filter_result,
)
from backend.services.chat_graph.graph import get_chat_prep_graph
from backend.services.chat_graph.state import (
    ChatPrepInputs,
    ChatPrepOutput,
    ChatPrepState,
    HistoryTurnSnapshot,
    PrepFlags,
    ProfileContextSnapshot,
)
from backend.services.content_filter import FilterResult

logger = setup_logger(__name__)

_GRAPH_VERSION = "chat_prep_graph_v1"
_AUDIT_QUEUE_MAXSIZE = 100
_audit_queue: asyncio.Queue[Awaitable[None] | None] | None = None
_audit_worker: asyncio.Task[None] | None = None


def _stable_bucket(user_id: int, salt: str, modulo: int) -> int:
    digest = hashlib.sha256(f"{salt}:{user_id}".encode()).hexdigest()
    return int(digest[:12], 16) % modulo


def _sampled(user_id: int, salt: str, rate: float) -> bool:
    if rate <= 0:
        return False
    if rate >= 1:
        return True
    return _stable_bucket(user_id, salt, 10_000) < int(rate * 10_000)


def _percent_enabled(user_id: int, percent: int) -> bool:
    if percent <= 0:
        return False
    if percent >= 100:
        return True
    return _stable_bucket(user_id, "chat-langgraph-partial", 100) < percent


def _sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _sha256_messages(messages: tuple[dict[str, str], ...]) -> str:
    payload = json.dumps(list(messages), ensure_ascii=False, sort_keys=True)
    return _sha256_text(payload)


def _profile_context_snapshot(profile) -> ProfileContextSnapshot | None:
    if profile is None:
        return None
    return ProfileContextSnapshot(
        goals=tuple(str(goal) for goal in (profile.goals or [])),
        exercise_frequency=str(profile.exercise_frequency) if profile.exercise_frequency else None,
        sleep_duration_bucket=str(profile.sleep_duration_bucket) if profile.sleep_duration_bucket else None,
    )


def _history_snapshots(history: list) -> tuple[HistoryTurnSnapshot, ...]:
    return tuple(
        HistoryTurnSnapshot(role=str(message.role), content=message.content)
        for message in history
    )


def _flags() -> PrepFlags:
    return PrepFlags(
        rag_enabled=config.RAG_ENABLED,
        rag_apply_enabled=config.RAG_APPLY_ENABLED,
        user_context_enabled=config.USER_CONTEXT_ENABLED,
        user_context_apply_enabled=config.USER_CONTEXT_APPLY_ENABLED,
        routing_apply_enabled=config.CONTENT_FILTER_ROUTING_APPLY_ENABLED,
        rag_top_k=config.RAG_TOP_K,
    )


def _build_inputs(
    *,
    user_id: int,
    message_text: str,
    base_system_prompt: str,
    history: list,
    filter_result: FilterResult,
    profile,
) -> ChatPrepInputs:
    return ChatPrepInputs(
        user_id=user_id,
        message_text=message_text,
        base_system_prompt=base_system_prompt,
        history_turns=_history_snapshots(history),
        route=filter_result.message_route,
        emotional_priority=filter_result.emotional_priority,
        prompt_policy=_prompt_policy_from_filter_result(filter_result),
        flags=_flags(),
        profile_context=_profile_context_snapshot(profile),
    )


async def _run_legacy_prep(inputs: ChatPrepInputs) -> ChatPrepOutput:
    should_run_rag = _should_run_rag_from_projection(
        inputs.message_text,
        inputs.route,
        inputs.emotional_priority,
        inputs.prompt_policy,
        flags=inputs.flags,
    )
    topic_hint = _select_topic_hint(inputs.message_text)

    rag_context_text: str | None = None
    rag_hit_count = 0
    rag_has_context = False
    if should_run_rag:
        rag_service = graph_nodes._get_rag_service()
        if rag_service is not None:
            rag_result = rag_service.search(
                query=inputs.message_text,
                top_k=1 if inputs.emotional_priority else inputs.flags.rag_top_k,
            )
            if rag_result and rag_result.has_context:
                rag_context_text = rag_result.prompt_context
                rag_hit_count = rag_result.hit_count
                rag_has_context = True

    should_build_user_context = _should_build_user_context_from_projection(
        inputs.route,
        inputs.emotional_priority,
        inputs.prompt_policy,
        has_profile=inputs.profile_context is not None,
        flags=inputs.flags,
    )

    user_context_text: str | None = None
    user_context_has_context = False
    if should_build_user_context and inputs.profile_context is not None:
        user_context_service = graph_nodes._get_user_context_service()
        if user_context_service is not None:
            from types import SimpleNamespace

            result = user_context_service.build_context(
                SimpleNamespace(
                    goals=list(inputs.profile_context.goals),
                    exercise_frequency=inputs.profile_context.exercise_frequency,
                    sleep_duration_bucket=inputs.profile_context.sleep_duration_bucket,
                ),
                topic_hint=topic_hint,
            )
            if result and result.has_context:
                user_context_text = result.summary
                user_context_has_context = True

    build_result = _build_openai_messages_from_base_prompt(
        base_system_prompt=inputs.base_system_prompt,
        history=list(inputs.history_turns),
        route=inputs.route,
        emotional_priority=inputs.emotional_priority,
        prompt_policy=inputs.prompt_policy,
        rag_context_text=rag_context_text,
        user_context_text=user_context_text,
        flags=inputs.flags,
    )
    return ChatPrepOutput(
        openai_messages=build_result.openai_messages,
        should_run_rag=should_run_rag,
        should_build_user_context=should_build_user_context,
        topic_hint=topic_hint,
        rag_hit_count=rag_hit_count,
        rag_has_context=rag_has_context,
        user_context_has_context=user_context_has_context,
        user_context_layer=build_result.user_context_layer,
        route_layer=build_result.route_layer,
        rag_layer=build_result.rag_layer,
        filter_instruction_layer=build_result.filter_instruction_layer,
        final_system_prompt=build_result.final_system_prompt,
    )


async def _run_graph_prep(inputs: ChatPrepInputs) -> ChatPrepOutput:
    graph = get_chat_prep_graph()
    if graph is None:
        raise RuntimeError("chat_langgraph_unavailable")

    state: ChatPrepState = {
        "user_id": inputs.user_id,
        "message_text": inputs.message_text,
        "base_system_prompt": inputs.base_system_prompt,
        "history_turns": inputs.history_turns,
        "route": inputs.route,
        "emotional_priority": inputs.emotional_priority,
        "prompt_policy": inputs.prompt_policy,
        "flags": inputs.flags,
        "profile_context": inputs.profile_context,
    }
    result = await graph.ainvoke(state)
    return ChatPrepOutput(
        openai_messages=tuple(result["openai_messages"]),
        should_run_rag=result.get("should_run_rag", False),
        should_build_user_context=result.get("should_build_user_context", False),
        topic_hint=result.get("topic_hint"),
        rag_hit_count=result.get("rag_hit_count", 0),
        rag_has_context=result.get("rag_has_context", False),
        user_context_has_context=result.get("user_context_has_context", False),
        user_context_layer=result.get("user_context_layer", ""),
        route_layer=result.get("route_layer", ""),
        rag_layer=result.get("rag_layer", ""),
        filter_instruction_layer=result.get("filter_instruction_layer", ""),
        final_system_prompt=result.get("final_system_prompt", inputs.base_system_prompt),
    )


def _parity_fields(output: ChatPrepOutput, *, route, emotional_priority, prompt_policy) -> dict[str, object]:
    return {
        "should_run_rag": output.should_run_rag,
        "should_build_user_context": output.should_build_user_context,
        "topic_hint": output.topic_hint,
        "rag_hit_count": output.rag_hit_count,
        "rag_has_context": output.rag_has_context,
        "user_context_has_context": output.user_context_has_context,
        "system_prompt_sha256": _sha256_text(output.final_system_prompt),
        "openai_messages_sha256": _sha256_messages(output.openai_messages),
        "openai_message_count": len(output.openai_messages),
        "openai_role_sequence": tuple(message["role"] for message in output.openai_messages),
        "user_context_layer_sha256": _sha256_text(output.user_context_layer),
        "route_layer_sha256": _sha256_text(output.route_layer),
        "rag_layer_sha256": _sha256_text(output.rag_layer),
        "filter_instruction_layer_sha256": _sha256_text(output.filter_instruction_layer),
        "message_route": route.value if route else None,
        "emotional_priority": emotional_priority,
        "filter_instruction_present": prompt_policy.value != "none",
    }


def _compare_parity(
    legacy_output: ChatPrepOutput,
    graph_output: ChatPrepOutput,
    *,
    route,
    emotional_priority,
    prompt_policy,
) -> tuple[bool, list[str], dict[str, object], dict[str, object]]:
    legacy_fields = _parity_fields(
        legacy_output,
        route=route,
        emotional_priority=emotional_priority,
        prompt_policy=prompt_policy,
    )
    graph_fields = _parity_fields(
        graph_output,
        route=route,
        emotional_priority=emotional_priority,
        prompt_policy=prompt_policy,
    )
    mismatches = [
        key
        for key in legacy_fields
        if legacy_fields[key] != graph_fields[key]
    ]
    return not mismatches, mismatches, legacy_fields, graph_fields


async def _audit_worker_loop() -> None:
    global _audit_queue  # noqa: PLW0603
    if _audit_queue is None:
        return

    while True:
        audit_coro = await _audit_queue.get()
        if audit_coro is None:
            _audit_queue.task_done()
            break
        try:
            await audit_coro
        except Exception:
            logger.exception("chat_langgraph_background_audit_failed")
        finally:
            _audit_queue.task_done()


def start_audit_worker() -> None:
    global _audit_queue, _audit_worker  # noqa: PLW0603
    if _audit_worker is not None and not _audit_worker.done():
        return

    _audit_queue = asyncio.Queue(maxsize=_AUDIT_QUEUE_MAXSIZE)
    _audit_worker = asyncio.create_task(_audit_worker_loop())


async def stop_audit_worker() -> None:
    global _audit_queue, _audit_worker  # noqa: PLW0603
    if _audit_queue is None or _audit_worker is None:
        return

    try:
        _audit_queue.put_nowait(None)
    except asyncio.QueueFull:
        await _audit_queue.put(None)

    await _audit_worker
    _audit_queue = None
    _audit_worker = None


def _schedule_background_audit(coro: Awaitable[None]) -> None:
    if _audit_queue is None:
        close = getattr(coro, "close", None)
        if close is not None:
            close()
        logger.warning("chat_langgraph_shadow_audit_worker_missing")
        return

    try:
        _audit_queue.put_nowait(coro)
    except asyncio.QueueFull:
        close = getattr(coro, "close", None)
        if close is not None:
            close()
        logger.warning("chat_langgraph_shadow_audit_dropped")


def _log_mode_selected(mode: str, user_id: int, eligible: bool, skip_reason: str | None = None) -> None:
    logger.info(
        "chat_langgraph_mode_selected",
        graph_version=_GRAPH_VERSION,
        mode=mode,
        user_id_hash=_stable_bucket(user_id, "chat-langgraph-log", 1_000_000),
        eligible=eligible,
        skip_reason=skip_reason,
    )


async def _shadow_compare(inputs: ChatPrepInputs, legacy_output: ChatPrepOutput) -> None:
    start = time.perf_counter()
    try:
        graph_output = await _run_graph_prep(inputs)
        parity_ok, mismatches, legacy_fields, graph_fields = _compare_parity(
            legacy_output,
            graph_output,
            route=inputs.route,
            emotional_priority=inputs.emotional_priority,
            prompt_policy=inputs.prompt_policy,
        )
        logger.info(
            "chat_langgraph_shadow_parity",
            graph_version=_GRAPH_VERSION,
            mode=ChatLangGraphMode.SHADOW.value,
            user_id_hash=_stable_bucket(inputs.user_id, "chat-langgraph-log", 1_000_000),
            parity_ok=parity_ok,
            mismatches=mismatches,
            legacy=legacy_fields,
            graph=graph_fields,
            graph_prep_ms=round((time.perf_counter() - start) * 1000, 2),
        )
    except Exception as exc:
        logger.warning(
            "chat_langgraph_partial_fallback",
            graph_version=_GRAPH_VERSION,
            mode=ChatLangGraphMode.SHADOW.value,
            user_id_hash=_stable_bucket(inputs.user_id, "chat-langgraph-log", 1_000_000),
            reason="shadow_graph_exception",
            error=type(exc).__name__,
        )


def _partial_audit_sample(user_id: int) -> bool:
    return _sampled(user_id, "chat-langgraph-audit", config.CHAT_LANGGRAPH_AUDIT_SAMPLE_RATE)


def _shadow_sample(user_id: int) -> bool:
    return _sampled(user_id, "chat-langgraph-shadow", config.CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE)


def should_enter_langgraph_adapter(user_id: int, filter_result: FilterResult) -> bool:
    """Return True only when the request needs graph/shadow work.

    Shadow mode is intentionally sampled before building ChatPrepInputs so
    non-sampled requests can stay on the same fast path as mode=off.
    """
    if config.CHAT_LANGGRAPH_FORCE_FALLBACK:
        return False
    if filter_result.medical_action == FilterMedicalAction.CRISIS_ESCALATE:
        return False

    mode = config.CHAT_LANGGRAPH_MODE
    if mode == ChatLangGraphMode.OFF:
        return False
    if mode == ChatLangGraphMode.SHADOW:
        return _shadow_sample(user_id)
    if mode == ChatLangGraphMode.PARTIAL:
        return _percent_enabled(user_id, config.CHAT_LANGGRAPH_PARTIAL_PERCENT)
    return False


async def prepare_openai_messages(
    *,
    user_id: int,
    message_text: str,
    base_system_prompt: str,
    history: list,
    filter_result: FilterResult,
    profile,
    chat_req_id: str | None = None,
) -> list[dict[str, str]]:
    inputs = _build_inputs(
        user_id=user_id,
        message_text=message_text,
        base_system_prompt=base_system_prompt,
        history=history,
        filter_result=filter_result,
        profile=profile,
    )

    eligible = filter_result.medical_action != FilterMedicalAction.CRISIS_ESCALATE
    mode = config.CHAT_LANGGRAPH_MODE
    if not eligible or config.CHAT_LANGGRAPH_FORCE_FALLBACK:
        _log_mode_selected(mode.value, user_id, False, "legacy_forced")
        legacy_output = await _run_legacy_prep(inputs)
        return [dict(message) for message in legacy_output.openai_messages]

    if mode == ChatLangGraphMode.OFF:
        _log_mode_selected(mode.value, user_id, True, "mode_off")
        legacy_output = await _run_legacy_prep(inputs)
        return [dict(message) for message in legacy_output.openai_messages]

    if mode == ChatLangGraphMode.SHADOW:
        _log_mode_selected(mode.value, user_id, True)
        legacy_start = time.perf_counter()
        legacy_output = await _run_legacy_prep(inputs)
        logger.info(
            "chat_langgraph_prep_timing",
            graph_version=_GRAPH_VERSION,
            mode=mode.value,
            path="legacy",
            chat_req_id=chat_req_id,
            user_id_hash=_stable_bucket(user_id, "chat-langgraph-log", 1_000_000),
            prep_ms=round((time.perf_counter() - legacy_start) * 1000, 2),
        )
        _schedule_background_audit(_shadow_compare(inputs, legacy_output))
        return [dict(message) for message in legacy_output.openai_messages]

    if mode == ChatLangGraphMode.PARTIAL and _percent_enabled(user_id, config.CHAT_LANGGRAPH_PARTIAL_PERCENT):
        _log_mode_selected(mode.value, user_id, True)
        graph_start = time.perf_counter()
        try:
            graph_output = await asyncio.wait_for(
                _run_graph_prep(inputs),
                timeout=config.CHAT_LANGGRAPH_PREP_TIMEOUT_MS / 1000,
            )
        except Exception as exc:
            legacy_output = await _run_legacy_prep(inputs)
            logger.warning(
                "chat_langgraph_partial_fallback",
                graph_version=_GRAPH_VERSION,
                mode=mode.value,
                user_id_hash=_stable_bucket(user_id, "chat-langgraph-log", 1_000_000),
                reason="graph_exception",
                error=type(exc).__name__,
            )
            return [dict(message) for message in legacy_output.openai_messages]

        logger.info(
            "chat_langgraph_prep_timing",
            graph_version=_GRAPH_VERSION,
            mode=mode.value,
            path="graph",
            chat_req_id=chat_req_id,
            user_id_hash=_stable_bucket(user_id, "chat-langgraph-log", 1_000_000),
            prep_ms=round((time.perf_counter() - graph_start) * 1000, 2),
        )

        if _partial_audit_sample(user_id):
            async def _audit() -> None:
                legacy_output = await _run_legacy_prep(inputs)
                parity_ok, mismatches, legacy_fields, graph_fields = _compare_parity(
                    legacy_output,
                    graph_output,
                    route=inputs.route,
                    emotional_priority=inputs.emotional_priority,
                    prompt_policy=inputs.prompt_policy,
                )
                logger.info(
                    "chat_langgraph_shadow_parity",
                    graph_version=_GRAPH_VERSION,
                    mode=mode.value,
                    user_id_hash=_stable_bucket(inputs.user_id, "chat-langgraph-log", 1_000_000),
                    parity_ok=parity_ok,
                    mismatches=mismatches,
                    legacy=legacy_fields,
                    graph=graph_fields,
                )

            _schedule_background_audit(_audit())

        return [dict(message) for message in graph_output.openai_messages]

    _log_mode_selected(mode.value, user_id, True, "bucket_not_selected")
    legacy_output = await _run_legacy_prep(inputs)
    return [dict(message) for message in legacy_output.openai_messages]
