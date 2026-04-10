"""Run the official interleaved service TTFT benchmark and save artifacts.

This wrapper keeps performance measurement separate from normal pytest output.
It still reuses the existing integration benchmark so we do not duplicate the
ChatService setup logic.

Usage:
    uv run python scripts/bench_ttft_interleaved.py --label pivot-baseline --rounds 50
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import subprocess
import sys
from datetime import datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / "logs"
BENCH_PATH = "backend/tests/integration/test_bench_service_ttft_interleaved.py"


def _safe_label(label: str) -> str:
    return "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in label).strip("-") or "interleaved"


def main() -> int:
    parser = argparse.ArgumentParser(description="Run official interleaved TTFT benchmark")
    parser.add_argument("--label", default="interleaved")
    parser.add_argument("--rounds", type=int, default=50)
    parser.add_argument("--db-host", default=os.environ.get("DB_HOST", "localhost"))
    parser.add_argument("--db-name", default=os.environ.get("DB_NAME", "test"))
    parser.add_argument("--model", default=os.environ.get("OPENAI_MODEL", "gpt-4o-mini"))
    args = parser.parse_args()

    env = os.environ.copy()
    env.update(
        {
            "DB_HOST": args.db_host,
            "DB_NAME": args.db_name,
            "OPENAI_MODEL": args.model,
            "CHAT_BENCH_BUDGET_ENABLED": "true",
            "BENCH_LABEL": args.label,
            "BENCH_ROUNDS_PER_CONDITION": str(args.rounds),
        }
    )

    LOG_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%m%d-%H%M%S")
    safe_label = _safe_label(args.label)
    log_path = LOG_DIR / f"ttft-interleaved-{stamp}-{safe_label}.log"
    json_path = LOG_DIR / f"ttft-interleaved-{stamp}-{safe_label}.json"

    command = [
        sys.executable,
        "-m",
        "pytest",
        BENCH_PATH,
        "-s",
        "-q",
    ]
    result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, check=False)
    combined_output = result.stdout + result.stderr
    log_path.write_text(combined_output, encoding="utf-8")

    marker = "JSON_INTERLEAVED:"
    for line in combined_output.splitlines():
        if line.startswith(marker):
            payload = line[len(marker) :].strip()
            parsed = json.loads(payload)
            json_path.write_text(json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8")
            break
    else:
        print(f"ERROR: {marker} not found. Full log: {log_path}", file=sys.stderr)
        return result.returncode or 2

    print(f"log:  {log_path}")
    print(f"json: {json_path}")
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
