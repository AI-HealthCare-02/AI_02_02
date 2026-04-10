"""Probe OpenAI /v1/models endpoint latency.

Purpose:
    Measure the pure network round-trip time to https://api.openai.com to
    decide whether OpenAI region/base_url is a TTFT bottleneck. This script
    does not touch the DB, ORM, or service code paths — only openai + httpx.

Design:
    A single AsyncOpenAI instance is reused across iterations. The first call
    includes DNS + TCP + TLS handshake ("cold"); subsequent calls reuse the
    existing connection over keepalive ("warm"). This mirrors how the shared
    client behaves in production.

Interpretation (warm median):
    >= 150 ms  — region/base_url is a likely bottleneck
    80-150 ms  — partial bottleneck, investigate further
    <  80 ms   — region is NOT the bottleneck, focus elsewhere

Usage:
    uv run python scripts/probe_openai_region.py --iterations 5

Notes:
    - Does NOT require DB_HOST override or docker postgres.
    - Reads OPENAI_API_KEY from env var first, then from backend.core.config
      (which loads .env via pydantic-settings).
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

ROOT = pathlib.Path(__file__).resolve().parents[1]


def _load_api_key() -> str | None:
    """Return OPENAI_API_KEY from env, falling back to backend.core.config."""
    key = os.environ.get("OPENAI_API_KEY")
    if key:
        return key

    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    try:
        from backend.core import config as backend_config  # noqa: PLC0415
    except Exception as exc:  # pragma: no cover - defensive
        print(f"WARN: backend.core.config import failed: {exc}", file=sys.stderr)
        return None

    key = getattr(backend_config, "OPENAI_API_KEY", None)
    return key or None


async def probe(iterations: int) -> None:
    api_key = _load_api_key()
    if not api_key:
        print("ERROR: OPENAI_API_KEY not set (env or .env)", file=sys.stderr)
        sys.exit(1)

    # Lazy imports: keep script startup fast and avoid import side effects
    from openai import AsyncOpenAI  # noqa: PLC0415

    client = AsyncOpenAI(api_key=api_key)
    timings_ms: list[float] = []
    rows: list[dict] = []

    print(f"Probing https://api.openai.com/v1/models x{iterations}")
    print("(single reused AsyncOpenAI instance; first = cold incl. TLS)")
    print("-" * 52)
    try:
        for i in range(iterations):
            t0 = time.perf_counter()
            try:
                await client.models.list()
            except Exception as exc:
                print(f"  [{i + 1}] ERROR: {exc}", file=sys.stderr)
                sys.exit(2)
            dt_ms = (time.perf_counter() - t0) * 1000
            timings_ms.append(dt_ms)
            label = "cold" if i == 0 else "warm"
            rows.append(
                {
                    "iteration": i + 1,
                    "cold": i == 0,
                    "latency_sec": round(dt_ms / 1000, 4),
                }
            )
            print(f"  [{i + 1}] {label:4s}: {dt_ms:9.2f} ms")
    finally:
        await client.close()

    print("-" * 52)
    print(f"  cold (1st)  : {timings_ms[0]:9.2f} ms")
    if len(timings_ms) > 1:
        warm = timings_ms[1:]
        print(f"  warm median : {statistics.median(warm):9.2f} ms  (n={len(warm)})")
        print(f"  warm min/max: {min(warm):9.2f} / {max(warm):9.2f} ms")
    if len(timings_ms) >= 5:
        sorted_t = sorted(timings_ms)
        p95_idx = max(0, int(round(0.95 * len(sorted_t))) - 1)
        print(f"  overall p95 : {sorted_t[p95_idx]:9.2f} ms")

    print()
    print("Interpretation:")
    print("  warm median >= 150 ms : region/base_url is a likely bottleneck")
    print("  warm median 80-150 ms : partial bottleneck, check further")
    print("  warm median <  80 ms  : region is NOT the bottleneck")

    warm_ms = timings_ms[1:]
    summary = {
        "created_at_utc": datetime.now(UTC).isoformat(),
        "endpoint": "https://api.openai.com/v1/models",
        "iterations": iterations,
        "cold_sec": round(timings_ms[0] / 1000, 4),
        "warm_median_sec": round(statistics.median(warm_ms) / 1000, 4) if warm_ms else None,
        "warm_min_sec": round(min(warm_ms) / 1000, 4) if warm_ms else None,
        "warm_max_sec": round(max(warm_ms) / 1000, 4) if warm_ms else None,
        "interpretation": {
            "gte_0_15_sec": "Network/base_url is a likely meaningful part of TTFT.",
            "lt_0_08_sec": "Network RTT is probably not the main bottleneck.",
        },
    }
    print("JSON_OPENAI_REGION_RTT:", json.dumps({"summary": summary, "rows": rows}, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe OpenAI /v1/models latency")
    parser.add_argument(
        "--iterations",
        type=int,
        default=5,
        help="Number of requests (default: 5)",
    )
    args = parser.parse_args()
    asyncio.run(probe(args.iterations))


if __name__ == "__main__":
    main()
