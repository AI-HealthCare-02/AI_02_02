"""사주 해석 통합 (interpret.build_today_card) 단위 테스트 (P3)."""

from datetime import date, time

import pytest

from backend.services.saju.engine.chart import ENGINE_VERSION, compute_natal_chart
from backend.services.saju.interpret import build_today_card

# ──────────────────────────────────────────────
# 의료/법률/투자 단정 표현 금지 (CRITICAL)
# ──────────────────────────────────────────────
_FORBIDDEN_TERMS = [
    "진단", "처방", "치료", "완치", "사망", "병이 생", "병원에 가",
    "반드시 합격", "반드시 헤어", "큰돈을", "암 ", "수술",
]


def _natal(birth_date: date = date(1990, 5, 15), birth_time: time | None = time(14, 30)) -> dict:
    chart = compute_natal_chart(birth_date=birth_date, birth_time=birth_time)
    return chart["natal"]


class TestBuildTodayCard:
    def test_returns_required_fields(self) -> None:
        card = build_today_card(
            natal=_natal(),
            engine_version=ENGINE_VERSION,
            today=date(2026, 4, 24),
        )
        assert "card_date" in card
        assert "summary" in card and card["summary"]
        assert "keywords" in card and len(card["keywords"]) >= 3
        assert "sections" in card and len(card["sections"]) == 5
        assert "safety_notice" in card and card["safety_notice"]
        assert "engine_version" in card
        assert "template_version" in card

    def test_section_keys_exact_5(self) -> None:
        card = build_today_card(natal=_natal(), engine_version=ENGINE_VERSION)
        keys = [s["key"] for s in card["sections"]]
        assert keys == ["total", "money", "health", "work", "one_thing"]

    def test_each_section_has_body_and_reason(self) -> None:
        card = build_today_card(natal=_natal(), engine_version=ENGINE_VERSION)
        for s in card["sections"]:
            assert s["body"], f"section {s['key']} body empty"
            assert s["reason"], f"section {s['key']} reason empty"

    def test_no_forbidden_medical_or_definitive_terms(self) -> None:
        """모든 relation kind × tone × focus 조합에서 금지어 0건."""
        natal_dict = _natal()
        for kind_date in [date(2026, 4, 24), date(2026, 4, 25), date(2026, 4, 26), date(2026, 4, 27), date(2026, 4, 28)]:
            for focus in ["total", "money", "health", "work", "relation"]:
                for tone in ["soft", "real", "short"]:
                    card = build_today_card(
                        natal=natal_dict,
                        engine_version=ENGINE_VERSION,
                        today=kind_date,
                        focus=focus,
                        tone=tone,
                    )
                    blob = " ".join(s["body"] + " " + s["reason"] for s in card["sections"])
                    blob += " " + card["summary"]
                    for term in _FORBIDDEN_TERMS:
                        assert term not in blob, f"forbidden term '{term}' in {kind_date}/{focus}/{tone}: {blob[:200]}"

    def test_focus_money_adds_boost_line(self) -> None:
        card = build_today_card(
            natal=_natal(),
            engine_version=ENGINE_VERSION,
            focus="money",
            tone="soft",
        )
        money_section = next(s for s in card["sections"] if s["key"] == "money")
        # focus 매칭 시 추가 한 줄
        assert "재물 흐름" in money_section["body"]

    def test_tone_short_is_briefer(self) -> None:
        soft = build_today_card(natal=_natal(), engine_version=ENGINE_VERSION, tone="soft")
        short = build_today_card(natal=_natal(), engine_version=ENGINE_VERSION, tone="short")
        soft_total = next(s for s in soft["sections"] if s["key"] == "total")["body"]
        short_total = next(s for s in short["sections"] if s["key"] == "total")["body"]
        assert len(short_total) < len(soft_total), "short tone should be shorter"

    def test_summary_mentions_day_master(self) -> None:
        card = build_today_card(natal=_natal(), engine_version=ENGINE_VERSION)
        day_master = _natal()["day_master"]
        assert day_master in card["summary"]

    def test_reason_mentions_today_pillar(self) -> None:
        card = build_today_card(
            natal=_natal(),
            engine_version=ENGINE_VERSION,
            today=date(2026, 4, 24),
        )
        # 적어도 total reason 에 today pillar 포함
        total_reason = next(s["reason"] for s in card["sections"] if s["key"] == "total")
        # today pillar 는 한자 2글자 — natal 의 today_gan + today_ji
        from backend.services.saju.engine.today import today_pillar as _tp
        today_info = _tp(date(2026, 4, 24))
        assert today_info["pillar"] in total_reason or today_info["gan"] in total_reason

    def test_deterministic(self) -> None:
        natal_dict = _natal()
        a = build_today_card(natal=natal_dict, engine_version=ENGINE_VERSION, today=date(2026, 4, 24))
        b = build_today_card(natal=natal_dict, engine_version=ENGINE_VERSION, today=date(2026, 4, 24))
        assert a == b

    @pytest.mark.parametrize("focus", ["total", "money", "health", "work", "relation"])
    @pytest.mark.parametrize("tone", ["soft", "real", "short"])
    def test_all_combinations_produce_valid_output(self, focus: str, tone: str) -> None:
        card = build_today_card(
            natal=_natal(),
            engine_version=ENGINE_VERSION,
            focus=focus,
            tone=tone,
        )
        assert len(card["sections"]) == 5
