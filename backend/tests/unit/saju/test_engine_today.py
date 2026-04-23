"""오늘 일진 + 합/충/생/극 관계 단위 테스트 (P3)."""

from datetime import date

from backend.services.saju.engine.today import (
    derive_day_relation,
    today_pillar,
)


class TestTodayPillar:
    def test_returns_required_fields(self) -> None:
        info = today_pillar(date(2026, 4, 24))
        assert "gan" in info and "ji" in info and "pillar" in info
        assert info["pillar"] == info["gan"] + info["ji"]
        assert info["gan_element"] in ("목", "화", "토", "금", "수")

    def test_default_to_today_when_no_arg(self) -> None:
        info = today_pillar()
        assert info["date"] == date.today()


class TestDeriveDayRelation:
    def test_same_element_returns_same(self) -> None:
        # 갑/을 둘 다 목 → same
        result = derive_day_relation(day_master="甲", today_gan="乙")
        # 갑·을 같은 오행이지만 합/충 관계 아님 → same
        assert result["kind"] == "same"

    def test_harmony_pair(self) -> None:
        # 갑己 천간합
        result = derive_day_relation(day_master="甲", today_gan="己")
        assert result["kind"] == "harmony"
        assert result["intensity"] == "strong"

    def test_clash_pair(self) -> None:
        # 갑庚 천간충
        result = derive_day_relation(day_master="甲", today_gan="庚")
        assert result["kind"] == "clash"

    def test_support_when_today_generates_dm(self) -> None:
        # 본인 갑(목), 오늘 임(수) → 수생목 → support
        result = derive_day_relation(day_master="甲", today_gan="壬")
        # 단 갑壬 은 합도 충도 아님. 수→목 생.
        assert result["kind"] == "support"

    def test_pressure_when_ke_relation(self) -> None:
        # 본인 무(토), 오늘 갑(목) — 무·갑 충도 합도 아님(둘 다 양). 목→토 극.
        # 단 갑·기는 합. 갑·무는 충. 무·갑 충 (합 아님)
        # 무己 합. 갑庚 충. 무·갑 충 = 戊·甲 충? 戊甲 충은 천간충에 포함.
        # → kind = clash, not pressure.
        # 다른 pressure 케이스: 본인 임(수), 오늘 戊(토) → 토→수 극, 임戊 충 (포함됨) → clash.
        # 더 단순: 본인 甲(목), 오늘 戊(토) → 목→토 극. 갑戊 합·충 표에 없음 → pressure.
        result = derive_day_relation(day_master="甲", today_gan="戊")
        assert result["kind"] == "pressure"

    def test_unknown_gan_falls_back_to_same(self) -> None:
        result = derive_day_relation(day_master="X", today_gan="Y")
        assert result["kind"] == "same"

    def test_returns_focus_hint(self) -> None:
        result = derive_day_relation(day_master="甲", today_gan="己")
        assert result["focus_hint"] in ("total", "money", "health", "work", "oneThing")
