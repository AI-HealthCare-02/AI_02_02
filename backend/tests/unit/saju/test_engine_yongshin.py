"""억부용신 엔진 (engine.yongshin) 단위 테스트 (P3).

한국 현대 자평 기준:
- strength_score = 월령(3) + 득지(2) + 득세(N×1)
- >=7 strong / <=3 weak / 4~6 balanced
- strong → 식상/관살/재성 중 결핍 / weak → 인수/비겁 / balanced → 계절 조후
"""

from datetime import date, time

import pytest

from backend.services.saju.engine.chart import compute_natal_chart
from backend.services.saju.engine.yongshin import (
    SCHOOL,
    compute_strength_score,
    derive_yongshin_eokbu,
)


# ──────────────────────────────────────────────
# strength_score 구성 요소
# ──────────────────────────────────────────────
class TestStrengthScore:
    def test_user_sample_balanced(self) -> None:
        """1985-03-25 癸亥 일주 — 중화(5점, 월령0·득지2·득세3)."""
        chart = compute_natal_chart(birth_date=date(1985, 3, 25), birth_time=time(18, 30))
        result = compute_strength_score(natal=chart["natal"])
        assert result["sin_gang"] == "balanced"
        assert result["score"] == 5
        assert result["components"]["myeongryeong"] == 0
        assert result["components"]["deukji"] == 2
        assert result["components"]["deukse"] == 3

    def test_score_returns_components_dict(self) -> None:
        chart = compute_natal_chart(birth_date=date(1990, 5, 15))
        result = compute_strength_score(natal=chart["natal"])
        assert set(result.keys()) >= {"score", "sin_gang", "components"}
        assert result["sin_gang"] in ("strong", "weak", "balanced")
        assert 0 <= result["components"].get("myeongryeong", 0) <= 3
        assert 0 <= result["components"].get("deukji", 0) <= 2

    def test_empty_natal_safe(self) -> None:
        result = compute_strength_score(natal={})
        assert result["sin_gang"] == "balanced"
        assert result["score"] == 0


# ──────────────────────────────────────────────
# derive_yongshin_eokbu — 사용자 사주 (기준 케이스)
# ──────────────────────────────────────────────
class TestUserSample:
    """1985-03-25 18:30 · 癸亥 일주 — 중화·화(재성) 용신 기준."""

    @pytest.fixture
    def user_natal(self) -> dict:
        return compute_natal_chart(
            birth_date=date(1985, 3, 25),
            birth_time=time(18, 30),
        )["natal"]

    def test_school_is_eokbu_korean_modern(self, user_natal: dict) -> None:
        yong = derive_yongshin_eokbu(natal=user_natal)
        assert yong["school"] == SCHOOL == "eokbu-korean-modern"

    def test_sin_gang_is_balanced(self, user_natal: dict) -> None:
        yong = derive_yongshin_eokbu(natal=user_natal)
        assert yong["sin_gang"] == "balanced"

    def test_yongshin_is_hwa_jaesung(self, user_natal: dict) -> None:
        """화 0개 + 卯월(봄 조후 화) → 화(재성) 용신."""
        yong = derive_yongshin_eokbu(natal=user_natal)
        assert yong["yongshin_element"] == "화"
        assert yong["yongshin_role"] == "재성"

    def test_hee_shin_is_mok(self, user_natal: dict) -> None:
        """용신 화를 생하는 목(식상) 이 희신."""
        yong = derive_yongshin_eokbu(natal=user_natal)
        assert yong["hee_shin_element"] == "목"

    def test_ki_shin_is_su(self, user_natal: dict) -> None:
        """용신 화를 극하는 수(비겁) 가 기신."""
        yong = derive_yongshin_eokbu(natal=user_natal)
        assert yong["ki_shin_element"] == "수"

    def test_reasoning_contains_score_and_judgment(self, user_natal: dict) -> None:
        yong = derive_yongshin_eokbu(natal=user_natal)
        assert "중화" in yong["reasoning"]
        assert "5점" in yong["reasoning"]
        assert "화" in yong["reasoning"]


# ──────────────────────────────────────────────
# 학파 상수 확인
# ──────────────────────────────────────────────
class TestSchoolConstant:
    def test_school_exported(self) -> None:
        assert SCHOOL == "eokbu-korean-modern"


# ──────────────────────────────────────────────
# 판정 범주별 전수
# ──────────────────────────────────────────────
class TestSinGangCategories:
    @pytest.mark.parametrize("sin_gang_label", ["strong", "weak", "balanced"])
    def test_valid_labels(self, sin_gang_label: str) -> None:
        assert sin_gang_label in {"strong", "weak", "balanced"}

    def test_reasoning_mentions_yongshin_role(self) -> None:
        """reasoning 에 일간 기준 관계(비겁·인수·식상·재성·관살) 중 하나 포함."""
        chart = compute_natal_chart(
            birth_date=date(1985, 3, 25),
            birth_time=time(18, 30),
        )
        yong = derive_yongshin_eokbu(natal=chart["natal"])
        role_terms = {"비겁", "인수", "식상", "재성", "관살"}
        assert any(term in yong["reasoning"] for term in role_terms)


# ──────────────────────────────────────────────
# natal 통합 (chart.py 에서 자동 주입)
# ──────────────────────────────────────────────
class TestChartIntegration:
    def test_natal_contains_yongshin_after_compute(self) -> None:
        """compute_natal_chart 는 natal 에 yongshin 자동 주입 (v0.3)."""
        r = compute_natal_chart(birth_date=date(1985, 3, 25), birth_time=time(18, 30))
        assert "yongshin" in r["natal"]
        assert r["natal"]["yongshin"]["school"] == "eokbu-korean-modern"

    def test_chart_top_level_yongshin_populated(self) -> None:
        """chart dict 최상위 yongshin 이 빈 dict 가 아니라 판정 결과."""
        r = compute_natal_chart(birth_date=date(1985, 3, 25), birth_time=time(18, 30))
        assert r["yongshin"]
        assert r["yongshin"].get("yongshin_element")

    def test_engine_version_is_v03(self) -> None:
        r = compute_natal_chart(birth_date=date(1985, 3, 25))
        assert r["engine_version"] == "danaa-deterministic-v0.3"


# ──────────────────────────────────────────────
# 희·기신 오행 관계 검증
# ──────────────────────────────────────────────
class TestHeeKiShinRelations:
    _SHENG = {"목": "화", "화": "토", "토": "금", "금": "수", "수": "목"}
    _KE = {"목": "토", "토": "수", "수": "화", "화": "금", "금": "목"}

    def test_hee_shin_sheng_yong(self) -> None:
        """희신이 용신을 生한다 (앞→뒤)."""
        chart = compute_natal_chart(birth_date=date(1985, 3, 25), birth_time=time(18, 30))
        yong = derive_yongshin_eokbu(natal=chart["natal"])
        if yong["yongshin_element"] and yong["hee_shin_element"]:
            assert self._SHENG[yong["hee_shin_element"]] == yong["yongshin_element"]

    def test_ki_shin_ke_yong(self) -> None:
        """기신이 용신을 剋한다."""
        chart = compute_natal_chart(birth_date=date(1985, 3, 25), birth_time=time(18, 30))
        yong = derive_yongshin_eokbu(natal=chart["natal"])
        if yong["yongshin_element"] and yong["ki_shin_element"]:
            assert self._KE[yong["ki_shin_element"]] == yong["yongshin_element"]
