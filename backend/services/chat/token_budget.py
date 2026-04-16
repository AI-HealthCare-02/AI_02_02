"""Best-effort token budget helpers for chat benchmarking and telemetry."""

from __future__ import annotations

from collections import OrderedDict
from collections.abc import Sequence
from typing import Any

from backend.services.chat.openai_client import get_active_llm_model

_BENCH_BUDGET_MAX_ENTRIES = 512
_bench_budget_snapshots: OrderedDict[str, dict[str, Any]] = OrderedDict()

# tiktoken encoding 은 모델 고정(gpt-4o-mini) 상태에서 항상 동일한 객체를 반환하므로
# 매 요청마다 재초기화 할 필요 없이 모듈 레벨에서 한 번만 resolve 한다.
_ENCODING_RESOLVED: bool = False
_ENCODING_CACHED: Any = None


def _get_encoding():
    global _ENCODING_RESOLVED, _ENCODING_CACHED  # noqa: PLW0603
    if _ENCODING_RESOLVED:
        return _ENCODING_CACHED
    try:
        import tiktoken  # type: ignore
    except Exception:
        _ENCODING_RESOLVED = True
        return None

    try:
        _ENCODING_CACHED = tiktoken.encoding_for_model(get_active_llm_model())
    except Exception:
        try:
            _ENCODING_CACHED = tiktoken.get_encoding("o200k_base")
        except Exception:
            try:
                _ENCODING_CACHED = tiktoken.get_encoding("cl100k_base")
            except Exception:
                pass
    _ENCODING_RESOLVED = True
    return _ENCODING_CACHED


def estimate_text_tokens(text: str) -> int | None:
    encoding = _get_encoding()
    if encoding is None:
        return None
    return len(encoding.encode(text))


def estimate_message_tokens(messages: Sequence[dict[str, str]]) -> int | None:
    encoding = _get_encoding()
    if encoding is None:
        return None

    # Chat-completions framing differs slightly by model, so keep this explicitly
    # as an estimate. It is still stable enough for before/after comparisons.
    total = 0
    for message in messages:
        total += 4
        total += len(encoding.encode(message.get("role", "")))
        total += len(encoding.encode(message.get("content", "")))
    total += 2
    return total


def record_bench_budget_snapshot(chat_req_id: str | None, **payload: Any) -> None:
    if not chat_req_id:
        return
    if chat_req_id in _bench_budget_snapshots:
        _bench_budget_snapshots.move_to_end(chat_req_id)
        _bench_budget_snapshots[chat_req_id].update(payload)
    else:
        _bench_budget_snapshots[chat_req_id] = dict(payload)
        if len(_bench_budget_snapshots) > _BENCH_BUDGET_MAX_ENTRIES:
            _bench_budget_snapshots.popitem(last=False)


def pop_bench_budget_snapshot(chat_req_id: str | None) -> dict[str, Any] | None:
    if not chat_req_id:
        return None
    return _bench_budget_snapshots.pop(chat_req_id, None)
