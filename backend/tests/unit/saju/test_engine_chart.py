"""사주 60갑자 계산 엔진 단위 테스트 (P2)."""

from datetime import date, time, timedelta

import pytest

from backend.services.saju.engine.chart import (
    ENGINE_VERSION,
    GAN,
    JI,
    compute_natal_chart,
    sexagenary_for_day,
)


# ──────────────────────────────────────────────
# 일주 60갑자 — epoch (1900-01-31 = 갑진) 검증
# ──────────────────────────────────────────────
class TestSexagenaryForDay:
    def test_epoch_is_gapjin(self) -> None:
        """1900-01-31 일주 = 甲辰(갑진) (epoch 정의)."""
        gan, ji = sexagenary_for_day(date(1900, 1, 31))
        assert gan == "甲"
        assert ji == "辰"

    def test_next_day_is_eulsa(self) -> None:
        """1900-02-01 일주 = 乙巳(을사)."""
        gan, ji = sexagenary_for_day(date(1900, 2, 1))
        assert gan == "乙"
        assert ji == "巳"

    def test_60_days_later_returns_to_gapjin(self) -> None:
        """60일 후 같은 일주 (60갑자 cycle, 甲辰 복귀)."""
        gan_a, ji_a = sexagenary_for_day(date(1900, 1, 31))
        gan_b, ji_b = sexagenary_for_day(date(1900, 1, 31) + timedelta(days=60))
        assert (gan_a, ji_a) == (gan_b, ji_b)

    def test_returns_valid_gan_ji(self) -> None:
        for day_offset in [0, 1, 30, 365, 36500]:
            gan, ji = sexagenary_for_day(date(2000, 1, 1) + timedelta(days=day_offset))
            assert gan in GAN
            assert ji in JI


# ──────────────────────────────────────────────
# compute_natal_chart 통합
# ──────────────────────────────────────────────
class TestComputeNatalChart:
    def test_minimum_fields(self) -> None:
        result = compute_natal_chart(birth_date=date(1990, 5, 15))
        assert result["engine_version"] == ENGINE_VERSION
        assert "natal" in result
        assert "strength" in result
        natal = result["natal"]
        assert natal["year"]["pillar"]
        assert natal["month"]["pillar"]
        assert natal["day"]["pillar"]
        assert natal["hour"] is None  # birth_time 없음
        assert natal["day_master"] in GAN

    def test_with_birth_time_includes_hour(self) -> None:
        result = compute_natal_chart(
            birth_date=date(1990, 5, 15),
            birth_time=time(14, 30),
        )
        hour = result["natal"]["hour"]
        assert hour is not None
        assert hour["gan"] in GAN
        assert hour["ji"] in JI

    def test_element_distribution_sums_to_8_with_hour(self) -> None:
        """4주 × 2(천간/지지) = 8글자 → 오행 합이 8."""
        result = compute_natal_chart(
            birth_date=date(1990, 5, 15),
            birth_time=time(14, 30),
        )
        dist = result["strength"]["element_distribution"]
        assert sum(dist.values()) == 8

    def test_element_distribution_sums_to_6_without_hour(self) -> None:
        """birth_time 없으면 3주 × 2 = 6글자."""
        result = compute_natal_chart(birth_date=date(1990, 5, 15))
        dist = result["strength"]["element_distribution"]
        assert sum(dist.values()) == 6

    def test_lunar_input_marked_in_limitations(self) -> None:
        result = compute_natal_chart(birth_date=date(1990, 5, 15), is_lunar=True)
        assert "lunar_input_treated_as_solar" in result["limitations"]

    def test_january_birth_marks_year_correction_limitation(self) -> None:
        """입춘(2월 4일) 보정 없으므로 1월 출생자에 한계 명시."""
        result = compute_natal_chart(birth_date=date(1990, 1, 15))
        assert "year_pillar_no_solar_term_correction" in result["limitations"]

    def test_no_hour_marks_hour_limitation(self) -> None:
        result = compute_natal_chart(birth_date=date(1990, 5, 15))
        assert "hour_pillar_unknown" in result["limitations"]

    def test_deterministic_same_input(self) -> None:
        """같은 입력 → 같은 출력 (engine_version 결정론 보장)."""
        a = compute_natal_chart(birth_date=date(1990, 5, 15), birth_time=time(14, 30))
        b = compute_natal_chart(birth_date=date(1990, 5, 15), birth_time=time(14, 30))
        # natal/strength 비교 (computed_at 같은 timestamp 필드 없음)
        assert a["natal"] == b["natal"]
        assert a["strength"] == b["strength"]

    @pytest.mark.parametrize("year,expected_year_gan", [
        (1984, "甲"),  # epoch
        (1985, "乙"),
        (1994, "甲"),  # 10년 cycle
        (2024, "甲"),  # 40년 후
    ])
    def test_year_gan_cycle(self, year: int, expected_year_gan: str) -> None:
        result = compute_natal_chart(birth_date=date(year, 5, 15))
        assert result["natal"]["year"]["gan"] == expected_year_gan
