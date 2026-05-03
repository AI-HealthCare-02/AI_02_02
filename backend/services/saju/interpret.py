"""사주 해석 통합 함수 (v2.7 P3).

build_today_card(natal, calibration) → Card payload (DB 저장 가능 + DTO 직렬화 가능)

분리 이유:
- engine (chart/today): 순수 계산 — 테스트 용이
- templates (today): 자연어 변환 — 톤/문구만 변경
- interpret (이 파일): 두 레이어 결합 — service 레이어가 호출
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from backend.services.saju.engine import (
    build_yongshin_guidance,
    derive_day_relation,
    today_pillar,
)
from backend.services.saju.templates import (
    DEFAULT_SAFETY_NOTICE,
    TEMPLATE_VERSION,
    build_sections,
    compute_daily_score,
)

ToneLiteral = Literal["soft", "real", "short"]
FocusLiteral = Literal["total", "money", "health", "work", "relation"]


def build_today_card(
    *,
    natal: dict,
    engine_version: str,
    today: date | None = None,
    focus: FocusLiteral = "total",
    tone: ToneLiteral = "soft",
) -> dict:
    """오늘의 운세 카드 페이로드 생성.

    반환:
    {
        "card_date": date,
        "summary": "...",
        "keywords": ["...", "...", "..."],
        "sections": [{key, title, body, reason}, ...],
        "safety_notice": "...",
        "engine_version": "danaa-deterministic-v0.1",
        "template_version": "v1.0",
    }
    """
    today_info = today_pillar(today)
    day_master = natal.get("day_master", "")

    relation = derive_day_relation(
        day_master=day_master,
        today_gan=today_info["gan"],
    )

    sections, summary, keywords = build_sections(
        relation=relation,
        natal=natal,
        today=today_info,
        focus=focus,
        tone=tone,
    )

    kind_kr_map = {
        "harmony": "합",
        "clash": "충",
        "support": "생",
        "pressure": "극",
        "same": "비화",
    }

    yongshin_dict = dict(natal.get("yongshin") or {})
    if yongshin_dict and not yongshin_dict.get("guidance"):
        yongshin_dict["guidance"] = build_yongshin_guidance(
            yongshin=yongshin_dict,
            natal=natal,
        )
    daily_score = compute_daily_score(
        relation_kind=relation["kind"],
        element_distribution=dict(natal.get("element_distribution") or {}),
        yongshin_element=yongshin_dict.get("yongshin_element", ""),
    )

    return {
        "card_date": today_info["date"],
        "summary": summary,
        "keywords": keywords,
        "sections": sections,
        "safety_notice": DEFAULT_SAFETY_NOTICE,
        "engine_version": engine_version,
        "template_version": TEMPLATE_VERSION,
        "daily_score": daily_score,
        # UI 노출 신규 필드 (P2.2)
        "natal_chart": natal,
        "today_pillar": today_info["pillar"],
        "today_gan": today_info["gan"],
        "today_ji": today_info["ji"],
        "today_element": today_info["gan_element"],
        "day_master": day_master,
        "day_master_element": relation.get("day_master_element", ""),
        "day_relation": {
            "kind": relation["kind"],
            "kind_kr": kind_kr_map.get(relation["kind"], ""),
        },
        "element_distribution": dict(natal.get("element_distribution") or {}),
        "limitations": list(natal.get("limitations") or []),
        # 용신 (P3, 억부 한국 현대 기준). natal 안에 저장된 dict 그대로 전달.
        "yongshin": yongshin_dict,
    }
