"""십성 엔진 (engine.sisung) 단위 테스트 (P2.1).

일간 기준 10 십성 매트릭스 — 음양 × 오행 관계 조합 전수 검증.
"""

from datetime import date, time

import pytest

from backend.services.saju.engine.chart import compute_natal_chart
from backend.services.saju.engine.sisung import (
    GAN_YINYANG,
    JI_YINYANG,
    SISUNG_KOR,
    compute_sisung,
)


# ──────────────────────────────────────────────
# 음양·오행 상수 sanity check
# ──────────────────────────────────────────────
class TestYinYangConstants:
    def test_gan_yinyang_has_10_entries(self) -> None:
        assert len(GAN_YINYANG) == 10
        assert sum(1 for v in GAN_YINYANG.values() if v == "양") == 5
        assert sum(1 for v in GAN_YINYANG.values() if v == "음") == 5

    def test_ji_yinyang_has_12_entries(self) -> None:
        assert len(JI_YINYANG) == 12
        assert sum(1 for v in JI_YINYANG.values() if v == "양") == 6
        assert sum(1 for v in JI_YINYANG.values() if v == "음") == 6

    def test_sisung_kor_has_10_entries(self) -> None:
        assert len(SISUNG_KOR) == 10
        for entry in SISUNG_KOR.values():
            assert "short" in entry and entry["short"]
            assert "long" in entry and entry["long"]


# ──────────────────────────────────────────────
# compute_sisung — 甲(갑, 양목) 일간 기준 10 타겟 매트릭스
# ──────────────────────────────────────────────
class TestSisungForGapDayMaster:
    """甲 일간 = 양·목. 각 오행 관계 × 음양 일치/불일치 전수."""

    @pytest.mark.parametrize("target_gan,expected", [
        ("甲", "비견"),  # same + 양양
        ("乙", "겁재"),  # same + 양음
        ("丙", "식신"),  # 목생화, 양양
        ("丁", "상관"),  # 목생화, 양음
        ("戊", "편재"),  # 목극토, 양양
        ("己", "정재"),  # 목극토, 양음
        ("庚", "편관"),  # 금극목, 양양
        ("辛", "정관"),  # 금극목, 양음
        ("壬", "편인"),  # 수생목, 양양
        ("癸", "정인"),  # 수생목, 양음
    ])
    def test_all_10_gan_targets(self, target_gan: str, expected: str) -> None:
        assert compute_sisung(day_master_gan="甲", target=target_gan, is_ji=False) == expected


# ──────────────────────────────────────────────
# compute_sisung — 癸(계, 음수) 일간 기준 10 타겟 매트릭스
# ──────────────────────────────────────────────
class TestSisungForGyeDayMaster:
    """癸 일간 = 음·수."""

    @pytest.mark.parametrize("target_gan,expected", [
        ("癸", "비견"),  # same + 음음
        ("壬", "겁재"),  # same + 음양
        ("乙", "식신"),  # 수생목, 음음
        ("甲", "상관"),  # 수생목, 음양
        ("丁", "편재"),  # 수극화, 음음
        ("丙", "정재"),  # 수극화, 음양
        ("己", "편관"),  # 토극수, 음음
        ("戊", "정관"),  # 토극수, 음양
        ("辛", "편인"),  # 금생수, 음음
        ("庚", "정인"),  # 금생수, 음양
    ])
    def test_all_10_gan_targets(self, target_gan: str, expected: str) -> None:
        assert compute_sisung(day_master_gan="癸", target=target_gan, is_ji=False) == expected


# ──────────────────────────────────────────────
# compute_sisung — 지지 본기 기대값 (파라미터화)
# ──────────────────────────────────────────────
class TestJiExactExpected:
    def test_gap_plus_oh(self) -> None:
        """甲(목·양) + 午(화·양) → 목생화 same yy → 식신."""
        assert compute_sisung(day_master_gan="甲", target="午", is_ji=True) == "식신"

    def test_gap_plus_sa(self) -> None:
        """甲(목·양) + 巳(화·음) → 목생화 diff yy → 상관."""
        assert compute_sisung(day_master_gan="甲", target="巳", is_ji=True) == "상관"

    def test_gye_plus_ja(self) -> None:
        """癸(수·음) + 子(수·양) → same diff → 겁재."""
        assert compute_sisung(day_master_gan="癸", target="子", is_ji=True) == "겁재"

    def test_gye_plus_hae(self) -> None:
        """癸(수·음) + 亥(수·음) → same same → 비견."""
        assert compute_sisung(day_master_gan="癸", target="亥", is_ji=True) == "비견"

    def test_gyeong_plus_jin(self) -> None:
        """庚(금·양) + 辰(토·양) → 토생금 same yy → 편인."""
        assert compute_sisung(day_master_gan="庚", target="辰", is_ji=True) == "편인"


# ──────────────────────────────────────────────
# attach_sisung_to_natal 통합
# ──────────────────────────────────────────────
class TestAttachSisungToNatal:
    def test_attach_day_master_marker(self) -> None:
        """day 기둥의 sisung_gan 은 '日主'."""
        result = compute_natal_chart(birth_date=date(1990, 5, 15), birth_time=time(14, 30))
        natal = result["natal"]
        assert natal["day"]["sisung_gan"] == "日主"

    def test_attach_all_pillars_have_sisung(self) -> None:
        """year/month/hour 기둥에 sisung_gan/sisung_ji 존재."""
        result = compute_natal_chart(birth_date=date(1990, 5, 15), birth_time=time(14, 30))
        natal = result["natal"]
        for key in ("year", "month", "hour"):
            assert "sisung_gan" in natal[key], f"{key} missing sisung_gan"
            assert "sisung_ji" in natal[key], f"{key} missing sisung_ji"
            assert natal[key]["sisung_gan"] in SISUNG_KOR
            assert natal[key]["sisung_ji"] in SISUNG_KOR

    def test_attach_no_hour_skips_hour(self) -> None:
        """birth_time 없으면 hour 키는 None — 예외 없이 동작."""
        result = compute_natal_chart(birth_date=date(1990, 5, 15))
        natal = result["natal"]
        assert natal["hour"] is None
        assert natal["year"]["sisung_gan"] in SISUNG_KOR

    def test_idempotent(self) -> None:
        """같은 natal 을 두 번 attach 해도 결과 동일."""
        result_a = compute_natal_chart(birth_date=date(1990, 5, 15), birth_time=time(14, 30))
        result_b = compute_natal_chart(birth_date=date(1990, 5, 15), birth_time=time(14, 30))
        assert result_a["natal"] == result_b["natal"]

    def test_gyeong_day_master_year_sisung(self) -> None:
        """1990-05-15 → 일간 庚. year 기둥 庚午 → sisung_gan=비견, sisung_ji=편관."""
        result = compute_natal_chart(birth_date=date(1990, 5, 15), birth_time=time(14, 30))
        year = result["natal"]["year"]
        assert year["gan"] == "庚"
        assert year["sisung_gan"] == "비견"
        assert year["sisung_ji"] == "편관"
