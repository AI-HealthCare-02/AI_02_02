"""Bench fresh-start TTFT to measure warmup_shared_openai_client() effect.

WARNING:
    This script is for fresh-start / warmup-effect exploration only.
    Do NOT use its numbers as the primary product decision metric for
    steady-state TTFT. Use the real ChatService warm-path benchmark instead.

Purpose:
    Measure first_content_ms for "fresh-start" scenarios (init -> first call)
    to quantify the effect of warmup_shared_openai_client(). Run twice:
    once before modifying warmup (baseline), once after (candidate).

Design:
    Each iteration performs:
        init_shared_openai_client()  [calls warmup internally]
            -> _stream_openai(messages)
            -> measure first content chunk time
            -> break (stop streaming early, we only need TTFT)
            -> close_shared_openai_client()
    Between iterations, asyncio.sleep(0.5) for OS/GC settling.

Notes:
    This is NOT a 100% cold restart (Python module cache, OS DNS cache, and
    TLS session resumption tickets may persist). But it IS accurate for
    measuring the delta between "warmup dummy" and "warmup actually calls
    chat.completions". Each iteration forces a fresh AsyncOpenAI +
    httpx.AsyncClient instance, which is exactly what warmup targets.

Usage:
    uv run python scripts/bench_ttft_ab.py --iterations 10 --label baseline
    # (modify warmup_shared_openai_client() in openai_client.py)
    uv run python scripts/bench_ttft_ab.py --iterations 10 --label candidate
"""

from __future__ import annotations

import argparse
import asyncio
import json
import pathlib
import statistics
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

FIXED_MESSAGES = [
    {
        "role": "system",
        "content": (
            "당신은 다나아의 친절한 AI 건강 코치입니다. "
            "사용자의 건강 질문에 공감하며 생활 습관 중심으로 조언해주세요. "
            "의학적 진단이나 처방은 하지 마세요."
        ),
    },
    {
        "role": "user",
        "content": "오늘 공복 혈당 수치가 120mg/dL인데 괜찮을까요?",
    },
]


async def _measure_one_fresh_start() -> tuple[float, bool]:
    """Return (first_content_ms, success)."""
    from backend.services.chat.openai_client import (  # noqa: PLC0415
        close_shared_openai_client,
        init_shared_openai_client,
    )
    from backend.services.chat.streaming import _stream_openai  # noqa: PLC0415

    await init_shared_openai_client()  # warmup is called from lifespan; here we directly init
    try:
        t0 = time.perf_counter()
        first_content_ms: float | None = None
        async for chunk in _stream_openai(FIXED_MESSAGES, chat_req_id="bench-ab"):
            if chunk is None:
                return -1.0, False
            if first_content_ms is None:
                first_content_ms = (time.perf_counter() - t0) * 1000
                break
        if first_content_ms is None:
            return -1.0, False
        return first_content_ms, True
    finally:
        await close_shared_openai_client()


async def _measure_one_fresh_start_with_warmup() -> tuple[float, bool]:
    """Same as above but explicitly calls warmup_shared_openai_client()."""
    from backend.services.chat.openai_client import (  # noqa: PLC0415
        close_shared_openai_client,
        warmup_shared_openai_client,
    )
    from backend.services.chat.streaming import _stream_openai  # noqa: PLC0415

    await warmup_shared_openai_client()  # this is what lifespan does
    try:
        t0 = time.perf_counter()
        first_content_ms: float | None = None
        async for chunk in _stream_openai(FIXED_MESSAGES, chat_req_id="bench-ab"):
            if chunk is None:
                return -1.0, False
            if first_content_ms is None:
                first_content_ms = (time.perf_counter() - t0) * 1000
                break
        if first_content_ms is None:
            return -1.0, False
        return first_content_ms, True
    finally:
        await close_shared_openai_client()


async def main(iterations: int, label: str, use_warmup: bool) -> None:
    mode = "warmup()" if use_warmup else "init()"
    print("=== Fresh-start TTFT bench ===")
    print(f"  label       : {label}")
    print(f"  iterations  : {iterations}")
    print(f"  entry point : {mode}")
    print()

    measure_fn = _measure_one_fresh_start_with_warmup if use_warmup else _measure_one_fresh_start

    samples: list[float] = []
    for i in range(iterations):
        first_ms, ok = await measure_fn()
        if not ok:
            print(f"  [{i + 1:2d}] ERROR")
            continue
        samples.append(first_ms)
        print(f"  [{i + 1:2d}] first_content: {first_ms:9.2f} ms")
        if i < iterations - 1:
            await asyncio.sleep(0.5)

    if not samples:
        print("No successful samples.")
        sys.exit(1)

    print()
    print(f"--- {label} summary (n={len(samples)}) ---")
    sorted_s = sorted(samples)
    p90_idx = max(0, int(round(0.9 * len(sorted_s))) - 1)
    median_ms = statistics.median(samples)
    mean_ms = statistics.mean(samples)
    print(f"  median : {median_ms:9.2f} ms")
    print(f"  mean   : {mean_ms:9.2f} ms")
    print(f"  min    : {min(samples):9.2f} ms")
    print(f"  max    : {max(samples):9.2f} ms")
    if len(samples) >= 5:
        print(f"  p90    : {sorted_s[p90_idx]:9.2f} ms")

    data = {
        "label": label,
        "entry_point": mode,
        "iterations": iterations,
        "n": len(samples),
        "samples_ms": [round(s, 2) for s in samples],
        "median_ms": round(median_ms, 2),
        "mean_ms": round(mean_ms, 2),
        "min_ms": round(min(samples), 2),
        "max_ms": round(max(samples), 2),
    }
    if len(samples) >= 5:
        data["p90_ms"] = round(sorted_s[p90_idx], 2)
    print()
    print("JSON:", json.dumps(data, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bench fresh-start TTFT for warmup effect")
    parser.add_argument("--iterations", type=int, default=10)
    parser.add_argument("--label", type=str, default="baseline")
    parser.add_argument(
        "--use-warmup",
        action="store_true",
        help="Call warmup_shared_openai_client() instead of init_shared_openai_client() (recommended)",
    )
    args = parser.parse_args()
    asyncio.run(main(args.iterations, args.label, args.use_warmup))
