"""Measure the minimum OpenAI streaming first-token floor.

This script intentionally bypasses DB, ChatService, LangGraph, prompt building,
and SSE formatting. It answers one narrow question:

    "How fast can gpt-4o-mini produce the first streamed content token
    when only OpenAI is involved?"

Usage:
    uv run python scripts/probe_openai_minimal_chat_ttft.py --iterations 20
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import pathlib
import statistics
import sys
import time
from datetime import UTC, datetime
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[1]


def _load_openai_settings() -> tuple[str | None, str]:
    api_key = os.environ.get("OPENAI_API_KEY")
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    if api_key:
        return api_key, model

    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    try:
        from backend.core import config as backend_config  # noqa: PLC0415
    except Exception as exc:  # pragma: no cover - defensive script path
        print(f"WARN: backend.core.config import failed: {exc}", file=sys.stderr)
        return None, model

    return getattr(backend_config, "OPENAI_API_KEY", None) or None, getattr(
        backend_config,
        "OPENAI_MODEL",
        model,
    )


async def _close_stream(stream: Any) -> None:
    close = getattr(stream, "close", None)
    if close is not None:
        maybe = close()
        if hasattr(maybe, "__await__"):
            await maybe
        return
    aclose = getattr(stream, "aclose", None)
    if aclose is not None:
        await aclose()


def _percentile(values: list[float], percentile: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    idx = max(0, min(len(sorted_values) - 1, int(round(percentile * len(sorted_values))) - 1))
    return sorted_values[idx]


async def probe(iterations: int, message: str) -> None:
    api_key, model = _load_openai_settings()
    if not api_key:
        print("ERROR: OPENAI_API_KEY not set (env or .env)", file=sys.stderr)
        sys.exit(1)

    from openai import AsyncOpenAI  # noqa: PLC0415

    client = AsyncOpenAI(api_key=api_key, max_retries=0)
    rows: list[dict[str, Any]] = []

    print(f"Minimal chat streaming TTFT probe | model={model} x{iterations}")
    print("Measures OpenAI-only first content token; no DB/ChatService/LangGraph.")
    print("-" * 72)
    try:
        for index in range(iterations):
            t0 = time.perf_counter()
            stream = None
            first_content_sec: float | None = None
            create_return_sec: float | None = None
            total_sec: float | None = None
            error: str | None = None
            try:
                stream = await client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": message}],
                    temperature=0,
                    max_tokens=1,
                    stream=True,
                    user="minimal-chat-ttft-probe",
                )
                create_return_sec = time.perf_counter() - t0
                async for chunk in stream:
                    if chunk.choices and chunk.choices[0].delta.content:
                        first_content_sec = time.perf_counter() - t0
                        break
                total_sec = time.perf_counter() - t0
            except Exception as exc:  # pragma: no cover - live probe
                error = f"{type(exc).__name__}: {exc}"
            finally:
                if stream is not None:
                    await _close_stream(stream)

            row = {
                "iteration": index + 1,
                "cold": index == 0,
                "create_return_sec": round(create_return_sec, 4) if create_return_sec is not None else None,
                "first_content_sec": round(first_content_sec, 4) if first_content_sec is not None else None,
                "total_sec": round(total_sec, 4) if total_sec is not None else None,
                "error": error,
            }
            rows.append(row)
            label = "cold" if index == 0 else "warm"
            print(
                f"  [{index + 1:02d}] {label:4s} "
                f"create={row['create_return_sec']} s  first={row['first_content_sec']} s  "
                f"total={row['total_sec']} s  error={error or '-'}"
            )
    finally:
        await client.close()

    warm_first = [r["first_content_sec"] for r in rows[1:] if r["first_content_sec"] is not None]
    warm_create = [r["create_return_sec"] for r in rows[1:] if r["create_return_sec"] is not None]
    summary = {
        "created_at_utc": datetime.now(UTC).isoformat(),
        "model": model,
        "iterations": iterations,
        "message_chars": len(message),
        "error_rate": round(sum(1 for r in rows if r["error"]) / len(rows), 4) if rows else 0.0,
        "cold_first_content_sec": rows[0]["first_content_sec"] if rows else None,
        "warm_first_content_median_sec": round(statistics.median(warm_first), 4) if warm_first else None,
        "warm_first_content_p95_sec": round(_percentile(warm_first, 0.95), 4) if warm_first else None,
        "warm_create_return_median_sec": round(statistics.median(warm_create), 4) if warm_create else None,
        "interpretation": {
            "gte_0_85_sec": "OpenAI-only floor is high; service-level 0.7s is unlikely from code changes alone.",
            "lt_0_60_sec": "OpenAI-only floor is low; investigate service prep/server overhead.",
        },
    }

    print("-" * 72)
    print("JSON_MINIMAL_CHAT_TTFT:", json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe minimal OpenAI streaming first-token latency")
    parser.add_argument("--iterations", type=int, default=20)
    parser.add_argument("--message", default="짧게 한 문장으로 인사해줘.")
    args = parser.parse_args()
    asyncio.run(probe(args.iterations, args.message))


if __name__ == "__main__":
    main()
