"""Sentry 에러 추적 — 건강 민감정보 자동 필터링.

before_send 훅으로 건강 데이터 필드를 제거하여
Sentry 대시보드에 민감정보가 전송되지 않도록 한다.
"""

from __future__ import annotations

from typing import Any

import sentry_sdk

from backend.core.config import Config, Env

# 건강 데이터 민감 필드 — Sentry breadcrumb/request body에서 제거
HEALTH_SENSITIVE_FIELDS: frozenset[str] = frozenset({
    "numeric_value", "answers", "bundle_keys",
    "hba1c_range", "treatments", "conditions",
    "sleep_quality", "breakfast_status", "mood_level",
    "exercise_done", "exercise_type", "exercise_minutes",
    "vegetable_intake_level", "meal_balance_level",
    "sweetdrink_level", "alcohol_today", "alcohol_amount_level",
    "took_medication", "water_cups", "walk_done",
    "nightsnack_level", "blood_pressure", "blood_sugar",
    "message_text", "base_system_prompt", "user_context_text",
    "rag_context_text", "openai_messages", "final_system_prompt",
})

# 건강 관련 엔드포인트 — request body 전체를 제거
HEALTH_ENDPOINTS: frozenset[str] = frozenset({
    "/api/v1/health", "/api/v1/daily", "/api/v1/measurements",
    "/api/v1/onboarding/survey",
})


def _strip_sensitive(data: dict[str, Any]) -> dict[str, Any]:
    """딕셔너리에서 민감 필드를 '[Filtered]'로 치환."""
    return {
        k: "[Filtered]" if k in HEALTH_SENSITIVE_FIELDS else v
        for k, v in data.items()
    }


def _before_send(event: dict[str, Any], hint: dict[str, Any]) -> dict[str, Any] | None:
    """Sentry 전송 전 건강 민감정보를 제거한다."""
    # request body 필터링
    request = event.get("request", {})
    url = request.get("url", "")

    if any(ep in url for ep in HEALTH_ENDPOINTS):
        request.pop("data", None)

    # breadcrumb 필터링
    for breadcrumb in event.get("breadcrumbs", {}).get("values", []):
        if isinstance(breadcrumb.get("data"), dict):
            breadcrumb["data"] = _strip_sensitive(breadcrumb["data"])

    return event


def init_sentry() -> None:
    """Sentry SDK 초기화 — DSN이 비어있으면 아무것도 하지 않는다."""
    config = Config()

    if not config.SENTRY_DSN:
        return

    sentry_sdk.init(
        dsn=config.SENTRY_DSN,
        environment=config.ENV.value,
        traces_sample_rate=0.1 if config.ENV == Env.PROD else 1.0,
        send_default_pii=False,
        before_send=_before_send,
    )
