"""Warm-path ChatService benchmark for TTFT / done / prompt budget.

This is a manually executed benchmark, not a regression assertion test.
It runs through the real ChatService path with docker postgres test DB and
the real OpenAI API, then prints JSON summary for analysis.

Usage:
    $env:DB_HOST='localhost'
    $env:DB_NAME='test'
    $env:CHAT_LANGGRAPH_MODE='off'
    $env:CHAT_BENCH_BUDGET_ENABLED='true'
    $env:BENCH_LABEL='candidate'
    $env:BENCH_ITERATIONS='20'
    uv run python -m pytest backend/tests/integration/test_bench_service_ttft.py -s -v
"""

from __future__ import annotations

import json
import os
import statistics
import time
from datetime import date

from tortoise.contrib.test import TruncationTestCase

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

BENCH_EMAIL = "bench_ttft_service@test.com"
BENCH_MESSAGES = (
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


class TestBenchServiceTTFT(TruncationTestCase):
    """Decision-grade warm-path benchmark."""

    async def _get_or_create_user(self) -> tuple[User, HealthProfile]:
        existing = await User.get_or_none(email=BENCH_EMAIL)
        if existing:
            profile = await HealthProfile.get(user_id=existing.id)
            return existing, profile

        user = await User.create(
            email=BENCH_EMAIL,
            hashed_password="hashed-password",
            name="bench-user",
            gender=Gender.MALE,
            birthday=date(1990, 1, 1),
            phone_number="01099998888",
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

    async def test_bench_service_ttft(self):  # noqa: C901
        from backend.core import config  # noqa: PLC0415
        from backend.services.chat.openai_client import (  # noqa: PLC0415
            close_shared_openai_client,
            init_shared_openai_client,
            warmup_shared_openai_client,
        )

        label = os.environ.get("BENCH_LABEL", "unknown")
        iterations = int(os.environ.get("BENCH_ITERATIONS", "20"))
        config.CHAT_BENCH_BUDGET_ENABLED = True

        print()
        print("=" * 72)
        print(f"Bench: ChatService.send_message_stream | label={label} n={iterations}")
        print(
            "  env: "
            f"mode={config.CHAT_LANGGRAPH_MODE.value} "
            f"shadow_sample={config.CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE} "
            f"audit_sample={config.CHAT_LANGGRAPH_AUDIT_SAMPLE_RATE}",
        )
        print("=" * 72)

        t_init = time.perf_counter()
        await init_shared_openai_client()
        warmup_ok = await warmup_shared_openai_client()
        init_ms = (time.perf_counter() - t_init) * 1000
        print(f"  shared client init+warmup: {init_ms:.2f} ms  warmup_ok={warmup_ok}")
        print()

        user, _profile = await self._get_or_create_user()
        service = ChatService()

        results: list[dict] = []
        for i in range(iterations):
            category, message_text = BENCH_MESSAGES[i % len(BENCH_MESSAGES)]
            bench_req_id = f"bench-svc-{label}-{i}"

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
                print(f"  [{i + 1:2d}] EXCEPTION: {type(exc).__name__}: {exc}")
                continue

            total_ms = (time.perf_counter() - t0) * 1000
            if done_ms is None:
                done_ms = total_ms
            budget_snapshot = pop_bench_budget_snapshot(bench_req_id) or {}

            row = {
                "iter": i + 1,
                "category": category,
                "route": budget_snapshot.get("route"),
                "emotional_priority": budget_snapshot.get("emotional_priority"),
                "prompt_tokens_estimate": budget_snapshot.get("prompt_tokens_estimate"),
                "ttft_sec": round(first_token_ms / 1000, 4) if first_token_ms is not None else None,
                "done_sec": round(done_ms / 1000, 4),
                "generate_sec": round((done_ms - first_token_ms) / 1000, 4) if first_token_ms is not None else None,
                "ttft_ms": round(first_token_ms, 2) if first_token_ms is not None else None,
                "done_ms": round(done_ms, 2),
                "total_ms": round(total_ms, 2),
                "generate_ms": round(done_ms - first_token_ms, 2) if first_token_ms is not None else None,
                "token_count": token_count,
                "completion_chars": len(full_response),
                "completion_tokens_estimate": budget_snapshot.get("completion_tokens_estimate")
                or estimate_text_tokens(full_response),
                "error": saw_error,
            }
            results.append(row)

            prompt_tokens_estimate = row["prompt_tokens_estimate"]
            prompt_str = f"{prompt_tokens_estimate:4d}" if prompt_tokens_estimate is not None else " N/A"
            print(
                f"  [{i + 1:2d}] {category:14s} route={str(row['route']):16s} "
                f"prompt={prompt_str}  TTFT={row['ttft_sec']} sec  done={row['done_sec']} sec",
            )

        await close_shared_openai_client()

        # Cold split: iteration 0 은 warm-up 영향 가능성 → 별도 리포팅, median 계산에서 제외
        cold_row = results[0] if results else None
        warm_results = results[1:] if len(results) > 1 else results

        total_samples = len(warm_results)
        error_samples = [r for r in warm_results if r["error"]]
        zero_token_samples = [
            r for r in warm_results if not r["error"] and r.get("token_count", 0) == 0
        ]
        error_rate = (len(error_samples) / total_samples) if total_samples else 0.0
        zero_token_terminal_rate = (
            (len(zero_token_samples) / total_samples) if total_samples else 0.0
        )

        ttfts = [r["ttft_ms"] for r in warm_results if r["ttft_ms"] is not None and not r["error"]]
        dones = [r["done_ms"] for r in warm_results if not r["error"]]
        prompt_tokens = [
            r["prompt_tokens_estimate"]
            for r in warm_results
            if r["prompt_tokens_estimate"] is not None
        ]

        # Bootstrap 95% CI on TTFT median (scipy 있으면)
        ttft_ci_sec: tuple[float, float] | None = None
        if len(ttfts) >= 5:
            try:
                from scipy import stats as _scipy_stats  # noqa: PLC0415

                ttfts_sec_array = [value / 1000 for value in ttfts]
                boot = _scipy_stats.bootstrap(
                    (ttfts_sec_array,),
                    statistics.median,
                    n_resamples=1000,
                    confidence_level=0.95,
                    random_state=42,
                )
                ttft_ci_sec = (
                    round(boot.confidence_interval.low, 4),
                    round(boot.confidence_interval.high, 4),
                )
            except Exception:  # pragma: no cover - optional dep
                ttft_ci_sec = None

        print()
        print(
            f"--- {label} summary (n_ttft={len(ttfts)}, n_done={len(dones)}, "
            f"cold_excluded={cold_row is not None}) ---"
        )
        if cold_row is not None:
            cold_ttft_sec = cold_row.get("ttft_sec")
            cold_done_sec = cold_row.get("done_sec")
            print(
                f"  COLD (excluded) : TTFT={cold_ttft_sec} s  done={cold_done_sec} s"
            )
        print(
            f"  error_rate       : {error_rate:6.2%}  "
            f"zero_token_terminal_rate: {zero_token_terminal_rate:6.2%}"
        )
        if prompt_tokens:
            print(f"  prompt median : {statistics.median(prompt_tokens):9.2f} tokens(est)")
            print(f"  prompt min/max: {min(prompt_tokens):9.2f} / {max(prompt_tokens):9.2f}")
        if ttfts:
            sorted_t = sorted(ttfts)
            ttfts_sec = [value / 1000 for value in ttfts]
            print(f"  TTFT median   : {statistics.median(ttfts):9.2f} ms")
            print(f"  TTFT median   : {statistics.median(ttfts_sec):9.4f} sec")
            print(f"  TTFT mean     : {statistics.mean(ttfts):9.2f} ms")
            print(f"  TTFT min/max  : {min(ttfts):9.2f} / {max(ttfts):9.2f} ms")
            if len(ttfts) >= 5:
                p95_idx = max(0, int(round(0.95 * len(sorted_t))) - 1)
                print(f"  TTFT p95      : {sorted_t[p95_idx]:9.2f} ms")
                print(f"  TTFT p95      : {sorted_t[p95_idx] / 1000:9.4f} sec")
            if ttft_ci_sec is not None:
                print(
                    f"  TTFT 95% CI   : [{ttft_ci_sec[0]:.4f}, {ttft_ci_sec[1]:.4f}] sec"
                )
        if dones:
            sorted_d = sorted(dones)
            dones_sec = [value / 1000 for value in dones]
            print(f"  done median   : {statistics.median(dones):9.2f} ms")
            print(f"  done median   : {statistics.median(dones_sec):9.4f} sec")
            print(f"  done mean     : {statistics.mean(dones):9.2f} ms")
            print(f"  done min/max  : {min(dones):9.2f} / {max(dones):9.2f} ms")
            if len(dones) >= 5:
                p95_idx = max(0, int(round(0.95 * len(sorted_d))) - 1)
                print(f"  done p95      : {sorted_d[p95_idx]:9.2f} ms")
                print(f"  done p95      : {sorted_d[p95_idx] / 1000:9.4f} sec")

        summary = {
            "label": label,
            "iterations": iterations,
            "n_ttft": len(ttfts),
            "n_done": len(dones),
            "init_plus_warmup_ms": round(init_ms, 2),
            "langgraph_mode": config.CHAT_LANGGRAPH_MODE.value,
            "shadow_sample_rate": config.CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE,
            "audit_sample_rate": config.CHAT_LANGGRAPH_AUDIT_SAMPLE_RATE,
            "cold_excluded": cold_row is not None,
            "cold_sample": {
                "ttft_sec": cold_row.get("ttft_sec") if cold_row else None,
                "done_sec": cold_row.get("done_sec") if cold_row else None,
                "error": cold_row.get("error") if cold_row else None,
            } if cold_row else None,
            "error_rate": round(error_rate, 4),
            "zero_token_terminal_rate": round(zero_token_terminal_rate, 4),
            "samples": results,
        }
        if prompt_tokens:
            summary["prompt_stats"] = {
                "median_tokens_estimate": round(statistics.median(prompt_tokens), 2),
                "min_tokens_estimate": round(min(prompt_tokens), 2),
                "max_tokens_estimate": round(max(prompt_tokens), 2),
            }
        if ttfts:
            summary["ttft_stats"] = {
                "median_sec": round(statistics.median(ttfts) / 1000, 4),
                "mean_sec": round(statistics.mean(ttfts) / 1000, 4),
                "min_sec": round(min(ttfts) / 1000, 4),
                "max_sec": round(max(ttfts) / 1000, 4),
                "median_ms": round(statistics.median(ttfts), 2),
                "mean_ms": round(statistics.mean(ttfts), 2),
                "min_ms": round(min(ttfts), 2),
                "max_ms": round(max(ttfts), 2),
            }
            if len(ttfts) >= 5:
                sorted_t = sorted(ttfts)
                p95_idx = max(0, int(round(0.95 * len(sorted_t))) - 1)
                summary["ttft_stats"]["p95_sec"] = round(sorted_t[p95_idx] / 1000, 4)
                summary["ttft_stats"]["p95_ms"] = round(sorted_t[p95_idx], 2)
            if ttft_ci_sec is not None:
                summary["ttft_stats"]["ci95_low_sec"] = ttft_ci_sec[0]
                summary["ttft_stats"]["ci95_high_sec"] = ttft_ci_sec[1]
        if dones:
            summary["done_stats"] = {
                "median_sec": round(statistics.median(dones) / 1000, 4),
                "mean_sec": round(statistics.mean(dones) / 1000, 4),
                "min_sec": round(min(dones) / 1000, 4),
                "max_sec": round(max(dones) / 1000, 4),
                "median_ms": round(statistics.median(dones), 2),
                "mean_ms": round(statistics.mean(dones), 2),
                "min_ms": round(min(dones), 2),
                "max_ms": round(max(dones), 2),
            }
            if len(dones) >= 5:
                sorted_d = sorted(dones)
                p95_idx = max(0, int(round(0.95 * len(sorted_d))) - 1)
                summary["done_stats"]["p95_sec"] = round(sorted_d[p95_idx] / 1000, 4)
                summary["done_stats"]["p95_ms"] = round(sorted_d[p95_idx], 2)

        print()
        print("JSON:", json.dumps(summary, ensure_ascii=False))
