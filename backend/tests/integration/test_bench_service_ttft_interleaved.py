"""공식 Interleaved TTFT 벤치 (가이드 5장, 10장).

4 조건 (off / shadow0 / shadow5 / shadow100) 을 라운드별로 돌아가면서 실행해
OpenAI 시간대 편향을 제거한다. 조건별 N 회 측정 후 조건별 집계만 리포팅한다.

Usage (Windows bash):
    export DB_HOST=localhost
    export DB_NAME=test
    export OPENAI_MODEL=gpt-4o-mini
    export CHAT_BENCH_BUDGET_ENABLED=true
    export BENCH_ROUNDS_PER_CONDITION=50   # default 50
    export BENCH_LABEL=interleaved_before
    uv run python -m pytest backend/tests/integration/test_bench_service_ttft_interleaved.py -s -q

Notes:
- config.CHAT_LANGGRAPH_* 는 매 iter 마다 runtime 에서 동적으로 할당된다.
- adapter.py 는 매 요청마다 `config.CHAT_LANGGRAPH_MODE` 를 읽으므로 동적 override 가 반영된다.
- 첫 rotation (round 1) 은 warmup 으로 간주하고 median 집계에서 제외된다.
- 에러율 ≥ 5% 인 조건은 명시적으로 WARN 표시되며 "세트 무효" 로 간주해야 한다.
"""

from __future__ import annotations

import json
import os
import platform
import statistics
import subprocess
import sys
import time
from datetime import UTC, date, datetime
from importlib import metadata

from tortoise.contrib.test import TruncationTestCase

import backend.services.chat.service as _chat_service_module
from backend.core import config
from backend.core.config import ChatLangGraphMode
from backend.models.enums import (
    AgeRange,
    AiConsent,
    AlcoholFrequency,
    ExerciseFrequency,
    FamilyHistory,
    Relation,
    RiskLevel,
    SleepDurationBucket,
    SmokingStatus,
    UserGroup,
)
from backend.models.health import HealthProfile
from backend.models.users import Gender, User
from backend.services.chat import ChatService
from backend.services.chat.token_budget import estimate_text_tokens, pop_bench_budget_snapshot

BENCH_EMAIL = "bench_ttft_interleaved@test.com"

BENCH_MESSAGES: tuple[tuple[str, str], ...] = (
    ("general", "오늘 컨디션이 좀 떨어지는데 생활 루틴을 어떻게 정리하면 좋을까?"),
    ("general", "하루 물 섭취를 조금 더 꾸준히 챙기려면 쉬운 방법이 있을까?"),
    ("general", "야식이 잦은 편인데 가장 먼저 고칠 한 가지만 추천해줘."),
    ("health_specific", "오늘 공복 혈당이 118mg/dL였는데 생활습관으로 뭘 먼저 조정하면 좋을까?"),
    ("health_specific", "식후 2시간 혈당이 168mg/dL였어. 오늘 저녁에는 어떻게 조절하는 게 좋을까?"),
    ("health_specific", "혈압이 138/88 정도로 나왔어. 생활습관에서 제일 먼저 볼 건 뭐야?"),
    ("rag_candidate", "당뇨 전단계에서 걷기 운동 빈도를 보통 어떻게 잡는 게 좋아?"),
    ("rag_candidate", "수면 부족이 혈당 관리에 어떤 영향을 주는지 쉽게 설명해줘."),
    ("emotional", "최근 건강관리 생각만 하면 좀 불안하고 지쳐."),
    ("emotional", "요즘 의욕이 떨어져서 식단 관리도 자꾸 미뤄져."),
)

CONDITIONS: tuple[tuple[str, ChatLangGraphMode, float, float], ...] = (
    ("off",        ChatLangGraphMode.OFF,    0.0,  0.0),
    ("shadow0",    ChatLangGraphMode.SHADOW, 0.0,  0.0),
    ("shadow5",    ChatLangGraphMode.SHADOW, 0.05, 0.0),
    ("shadow100", ChatLangGraphMode.SHADOW, 1.0,  0.0),
)


def _set_condition(name: str, mode: ChatLangGraphMode, shadow_rate: float, audit_rate: float) -> None:
    """매 iter 마다 config 싱글턴에 런타임 값을 override."""
    config.CHAT_LANGGRAPH_MODE = mode
    config.CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE = shadow_rate
    config.CHAT_LANGGRAPH_AUDIT_SAMPLE_RATE = audit_rate
    del name  # 로깅은 상위에서


def _bootstrap_ci95_median_sec(ttfts_ms: list[float]) -> tuple[float, float] | None:
    if len(ttfts_ms) < 5:
        return None
    from scipy import stats as _scipy_stats  # noqa: PLC0415

    ttfts_sec_array = [value / 1000 for value in ttfts_ms]
    boot = _scipy_stats.bootstrap(
        (ttfts_sec_array,),
        statistics.median,
        n_resamples=1000,
        confidence_level=0.95,
        random_state=42,
    )
    return (
        round(boot.confidence_interval.low, 4),
        round(boot.confidence_interval.high, 4),
    )


def _run_git_command(args: list[str]) -> str | None:
    try:
        result = subprocess.run(
            ["git", *args],
            capture_output=True,
            check=False,
            encoding="utf-8",
            errors="replace",
            text=True,
            timeout=5,
        )
    except Exception:
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def _package_version(name: str) -> str | None:
    try:
        return metadata.version(name)
    except metadata.PackageNotFoundError:
        return None


def _bench_metadata(label: str, rounds: int, init_ms: float, warmup_ok: bool) -> dict:
    dirty_status = _run_git_command(["status", "--porcelain"]) or ""
    env_keys = (
        "DB_HOST",
        "DB_NAME",
        "OPENAI_MODEL",
        "OPENAI_BASE_URL",
        "CHAT_BENCH_BUDGET_ENABLED",
        "CHAT_OPENAI_MAX_TOKENS",
        "CHAT_OPENAI_SHORT_RESPONSE_ENABLED",
        "CHAT_OPENAI_SHORT_RESPONSE_MAX_TOKENS",
    )
    return {
        "label": label,
        "started_at_utc": datetime.now(UTC).isoformat(),
        "rounds_per_condition": rounds,
        "warmup_round_excluded": True,
        "init_plus_warmup_ms": round(init_ms, 2),
        "warmup_ok": warmup_ok,
        "git_sha": _run_git_command(["rev-parse", "HEAD"]),
        "git_dirty": bool(dirty_status),
        "git_dirty_file_count": len(dirty_status.splitlines()) if dirty_status else 0,
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "packages": {
            "openai": _package_version("openai"),
            "httpx": _package_version("httpx"),
            "scipy": _package_version("scipy"),
        },
        "config_snapshot": {
            "openai_model": config.OPENAI_MODEL,
            "openai_base_url": os.environ.get("OPENAI_BASE_URL"),
            "chat_openai_max_tokens": config.CHAT_OPENAI_MAX_TOKENS,
            "chat_openai_short_response_enabled": config.CHAT_OPENAI_SHORT_RESPONSE_ENABLED,
            "chat_openai_short_response_max_tokens": config.CHAT_OPENAI_SHORT_RESPONSE_MAX_TOKENS,
        },
        "env_snapshot": {key: os.environ.get(key) for key in env_keys},
    }


class TestBenchServiceTtftInterleaved(TruncationTestCase):
    """가이드 5장: interleaved 조건별 벤치."""

    async def _get_or_create_user(self) -> tuple[User, HealthProfile]:
        existing = await User.get_or_none(email=BENCH_EMAIL)
        if existing:
            profile = await HealthProfile.get(user_id=existing.id)
            return existing, profile

        user = await User.create(
            email=BENCH_EMAIL,
            hashed_password="hashed-password",
            name="bench-interleaved",
            gender=Gender.MALE,
            birthday=date(1990, 1, 1),
            phone_number="01099998889",
        )
        profile = await HealthProfile.create(
            user=user,
            relation=Relation.PREDIABETES,
            user_group=UserGroup.B,
            gender=Gender.MALE,
            age_range=AgeRange.BETWEEN_45_54,
            height_cm=175.0,
            weight_kg=80.0,
            bmi=26.12,
            family_history=FamilyHistory.PARENTS,
            conditions=["hypertension"],
            has_hypertension=True,
            has_high_glucose_history=False,
            treatments=None,
            hba1c_range=None,
            fasting_glucose_range=None,
            exercise_frequency=ExerciseFrequency.ONE_TO_TWO,
            diet_habits=["irregular_meals"],
            sleep_duration_bucket=SleepDurationBucket.BETWEEN_6_7,
            alcohol_frequency=AlcoholFrequency.SOMETIMES,
            smoking_status=SmokingStatus.NON_SMOKER,
            goals=["weight_management"],
            ai_consent=AiConsent.AGREED,
            initial_findrisc_score=8,
            initial_risk_level=RiskLevel.SLIGHT,
        )
        return user, profile

    async def test_bench_interleaved_ttft(self):  # noqa: C901, PLR0912, PLR0915
        from backend.services.chat.openai_client import (  # noqa: PLC0415
            close_shared_openai_client,
            init_shared_openai_client,
            warmup_shared_openai_client,
        )

        label = os.environ.get("BENCH_LABEL", "interleaved")
        rounds = int(os.environ.get("BENCH_ROUNDS_PER_CONDITION", "50"))

        print()
        print("=" * 80)
        print(
            f"Interleaved Bench: ChatService.send_message_stream | label={label} "
            f"rounds={rounds}  (warmup round 1 excluded)"
        )
        print(
            f"Conditions: {', '.join(name for name, *_ in CONDITIONS)}  "
            f"total_iters={rounds * len(CONDITIONS)}"
        )
        print("=" * 80)

        t_init = time.perf_counter()
        await init_shared_openai_client()
        warmup_ok = await warmup_shared_openai_client()
        init_ms = (time.perf_counter() - t_init) * 1000
        print(f"  shared client init+warmup: {init_ms:.2f} ms  warmup_ok={warmup_ok}")
        print()

        user, _profile = await self._get_or_create_user()
        service = ChatService()

        # 원래 설정 백업 (teardown 에서 복구)
        original_mode = config.CHAT_LANGGRAPH_MODE
        original_shadow = config.CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE
        original_audit = config.CHAT_LANGGRAPH_AUDIT_SAMPLE_RATE
        # MAX_DAILY_CHATS 기본값 50 → bench 는 200+ 요청 보내므로 일시적 상향.
        # service.py 는 `from .health_question import MAX_DAILY_CHATS` 로 가져오는 local alias
        # 이므로 해당 모듈의 name 을 직접 override 한다.
        original_max_daily = _chat_service_module.MAX_DAILY_CHATS
        _chat_service_module.MAX_DAILY_CHATS = 10_000

        per_condition_results: dict[str, list[dict]] = {
            name: [] for name, *_ in CONDITIONS
        }

        try:
            for round_index in range(rounds):
                for cond_idx, (cond_name, mode, shadow_rate, audit_rate) in enumerate(CONDITIONS):
                    _set_condition(cond_name, mode, shadow_rate, audit_rate)

                    category, message_text = BENCH_MESSAGES[
                        (round_index * len(CONDITIONS) + cond_idx) % len(BENCH_MESSAGES)
                    ]
                    bench_req_id = f"bench-interleaved-{label}-{cond_name}-r{round_index + 1}"

                    t0 = time.perf_counter()
                    first_token_ms: float | None = None
                    done_ms: float | None = None
                    token_count = 0
                    saw_error = False
                    full_response = ""

                    try:
                        async for event in service.send_message_stream(
                            user_id=user.id,
                            message=message_text,
                            session_id=None,
                            chat_req_id=bench_req_id,
                        ):
                            if event.startswith("event: token"):
                                if first_token_ms is None:
                                    first_token_ms = (time.perf_counter() - t0) * 1000
                                token_count += 1
                                payload = event.split("data: ", 1)[1]
                                full_response += json.loads(payload)["content"]
                            elif event.startswith("event: error"):
                                saw_error = True
                            elif event.startswith("event: done"):
                                done_ms = (time.perf_counter() - t0) * 1000
                    except Exception as exc:  # pragma: no cover - defensive
                        print(
                            f"  [round {round_index + 1:3d} {cond_name:9s}] "
                            f"EXCEPTION: {type(exc).__name__}: {exc}"
                        )
                        per_condition_results[cond_name].append({
                            "round": round_index + 1,
                            "category": category,
                            "ttft_ms": None,
                            "done_ms": None,
                            "token_count": 0,
                            "error": True,
                        })
                        continue

                    total_ms = (time.perf_counter() - t0) * 1000
                    if done_ms is None:
                        done_ms = total_ms
                    budget_snapshot = pop_bench_budget_snapshot(bench_req_id) or {}

                    row = {
                        "round": round_index + 1,
                        "condition": cond_name,
                        "category": category,
                        "route": budget_snapshot.get("route"),
                        "emotional_priority": budget_snapshot.get("emotional_priority"),
                        "prompt_tokens_estimate": budget_snapshot.get("prompt_tokens_estimate"),
                        "chat_server_ttft_ms": round(first_token_ms, 2) if first_token_ms is not None else None,
                        "openai_first_content_ms": budget_snapshot.get("openai_first_content_ms"),
                        "openai_max_tokens": budget_snapshot.get("openai_max_tokens"),
                        "short_response_enabled": budget_snapshot.get("short_response_enabled"),
                        "ttft_sec": round(first_token_ms / 1000, 4) if first_token_ms is not None else None,
                        "done_sec": round(done_ms / 1000, 4),
                        "generate_sec": round((done_ms - first_token_ms) / 1000, 4)
                        if first_token_ms is not None
                        else None,
                        "ttft_ms": round(first_token_ms, 2) if first_token_ms is not None else None,
                        "done_ms": round(done_ms, 2),
                        "token_count": token_count,
                        "completion_chars": len(full_response),
                        "completion_tokens_estimate": budget_snapshot.get("completion_tokens_estimate")
                        or estimate_text_tokens(full_response),
                        "error": saw_error,
                        "zero_token_terminal": (not saw_error) and token_count == 0,
                    }
                    per_condition_results[cond_name].append(row)

                    ttft_str = f"{row['ttft_sec']}" if row["ttft_sec"] is not None else "  N/A"
                    print(
                        f"  [round {round_index + 1:3d} {cond_name:9s}] "
                        f"{category:15s}  TTFT={ttft_str} s  done={row['done_sec']} s"
                    )

        finally:
            # 원래 config 복구
            config.CHAT_LANGGRAPH_MODE = original_mode
            config.CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE = original_shadow
            config.CHAT_LANGGRAPH_AUDIT_SAMPLE_RATE = original_audit
            _chat_service_module.MAX_DAILY_CHATS = original_max_daily
            await close_shared_openai_client()

        # ─── 조건별 집계 ───
        condition_summaries: dict[str, dict] = {}
        print()
        print("=" * 80)
        print(f"{label} - condition summary (warmup round 1 excluded)")
        print("=" * 80)

        for cond_name, *_ in CONDITIONS:
            rows = per_condition_results[cond_name]
            warm_rows = rows[1:] if len(rows) > 1 else rows
            cold_row = rows[0] if rows else None

            total_samples = len(warm_rows)
            error_rows = [r for r in warm_rows if r.get("error")]
            zero_token_rows = [r for r in warm_rows if r.get("zero_token_terminal")]
            error_rate = len(error_rows) / total_samples if total_samples else 0.0
            zero_token_rate = len(zero_token_rows) / total_samples if total_samples else 0.0

            ttfts_ms = [
                r["ttft_ms"] for r in warm_rows if r.get("ttft_ms") is not None and not r.get("error")
            ]
            dones_ms = [r["done_ms"] for r in warm_rows if not r.get("error")]
            prompt_tokens = [
                r["prompt_tokens_estimate"]
                for r in warm_rows
                if r.get("prompt_tokens_estimate") is not None
            ]
            completion_tokens = [
                r["completion_tokens_estimate"]
                for r in warm_rows
                if r.get("completion_tokens_estimate") is not None
            ]
            openai_firsts = [
                r["openai_first_content_ms"]
                for r in warm_rows
                if r.get("openai_first_content_ms") is not None
            ]

            ci95 = _bootstrap_ci95_median_sec(ttfts_ms)

            condition_summary: dict = {
                "condition": cond_name,
                "n_warm": total_samples,
                "n_ttft": len(ttfts_ms),
                "n_done": len(dones_ms),
                "cold_ttft_sec": cold_row.get("ttft_sec") if cold_row else None,
                "cold_done_sec": cold_row.get("done_sec") if cold_row else None,
                "error_rate": round(error_rate, 4),
                "zero_token_terminal_rate": round(zero_token_rate, 4),
                "set_invalid": error_rate >= 0.05,
            }
            if ttfts_ms:
                sorted_t = sorted(ttfts_ms)
                p95_idx = max(0, int(round(0.95 * len(sorted_t))) - 1)
                condition_summary["ttft_stats"] = {
                    "median_sec": round(statistics.median(ttfts_ms) / 1000, 4),
                    "mean_sec": round(statistics.mean(ttfts_ms) / 1000, 4),
                    "min_sec": round(min(ttfts_ms) / 1000, 4),
                    "max_sec": round(max(ttfts_ms) / 1000, 4),
                    "p95_sec": round(sorted_t[p95_idx] / 1000, 4),
                }
                if ci95 is not None:
                    condition_summary["ttft_stats"]["ci95_low_sec"] = ci95[0]
                    condition_summary["ttft_stats"]["ci95_high_sec"] = ci95[1]
            if dones_ms:
                sorted_d = sorted(dones_ms)
                p95_idx = max(0, int(round(0.95 * len(sorted_d))) - 1)
                condition_summary["done_stats"] = {
                    "median_sec": round(statistics.median(dones_ms) / 1000, 4),
                    "mean_sec": round(statistics.mean(dones_ms) / 1000, 4),
                    "min_sec": round(min(dones_ms) / 1000, 4),
                    "max_sec": round(max(dones_ms) / 1000, 4),
                    "p95_sec": round(sorted_d[p95_idx] / 1000, 4),
                }
            if prompt_tokens:
                condition_summary["prompt_tokens_median"] = round(
                    statistics.median(prompt_tokens), 2
                )
            if completion_tokens:
                condition_summary["completion_tokens_median"] = round(
                    statistics.median(completion_tokens), 2
                )
            if openai_firsts:
                condition_summary["openai_first_content_median_sec"] = round(
                    statistics.median(openai_firsts) / 1000,
                    4,
                )

            condition_summaries[cond_name] = condition_summary

            # print
            print()
            print(f"[{cond_name}] n_warm={total_samples}  cold_ttft={condition_summary['cold_ttft_sec']}")
            if "ttft_stats" in condition_summary:
                ts = condition_summary["ttft_stats"]
                ci_str = ""
                if "ci95_low_sec" in ts:
                    ci_str = f"  95%CI=[{ts['ci95_low_sec']}, {ts['ci95_high_sec']}]"
                print(
                    f"  TTFT  median={ts['median_sec']} s  mean={ts['mean_sec']} s  "
                    f"p95={ts['p95_sec']} s{ci_str}"
                )
            if "done_stats" in condition_summary:
                ds = condition_summary["done_stats"]
                print(
                    f"  done  median={ds['median_sec']} s  mean={ds['mean_sec']} s  "
                    f"p95={ds['p95_sec']} s"
                )
            print(
                f"  error_rate={error_rate:6.2%}  zero_token={zero_token_rate:6.2%}"
            )
            if condition_summary["set_invalid"]:
                print(
                    "  *** WARN: error_rate >= 5% - invalid condition set; rerun required ***"
                )

        # ─── 전체 JSON 덤프 ───
        out = {
            "metadata": _bench_metadata(label, rounds, init_ms, warmup_ok),
            "conditions": condition_summaries,
            "raw_samples": per_condition_results,
        }
        print()
        print("JSON_INTERLEAVED:", json.dumps(out, ensure_ascii=False))
