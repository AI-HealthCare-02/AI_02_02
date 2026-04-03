"""FINDRISC 점수 계산 단위 테스트.

순수 함수 테스트 — DB 불필요.
8변수 개별 점수 + 경계값 + Null 보수적 처리 검증.
"""

from tortoise.contrib.test import TestCase

from app.models.enums import RiskLevel
from app.services.prediction import (
    FindriscResult,
    calculate_findrisc,
    calculate_initial_findrisc,
)


class TestFindrisc(TestCase):
    """FINDRISC 계산 함수 테스트."""

    # ── 전체 점수 범위 ──

    async def test_all_zero_inputs(self):
        """모든 입력이 최소값일 때 → LOW."""
        result = calculate_findrisc(
            age=30, bmi=22.0, waist_cm=None, is_male=True,
            is_physically_active=True, eats_vegetables_daily=True,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="none",
        )
        assert result.total_score == 0
        assert result.risk_level == RiskLevel.LOW

    async def test_maximum_score(self):
        """모든 입력이 최대값일 때 → 26점 VERY_HIGH."""
        result = calculate_findrisc(
            age=70, bmi=35.0, waist_cm=110.0, is_male=True,
            is_physically_active=False, eats_vegetables_daily=False,
            has_hypertension=True, has_high_glucose_history=True,
            family_history="parents",
        )
        # age=4 + bmi=3 + waist=4 + activity=2 + veg=1 + hyp=2 + glucose=5 + family=5 = 26
        assert result.total_score == 26
        assert result.risk_level == RiskLevel.VERY_HIGH

    # ── 경계값 테스트 ──

    async def test_boundary_low_slight(self):
        """3점→LOW, 4점→SLIGHT 경계."""
        r3 = calculate_findrisc(
            age=30, bmi=22.0, waist_cm=None, is_male=True,
            is_physically_active=False, eats_vegetables_daily=False,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="none",
        )
        # activity=2 + veg=1 = 3
        assert r3.total_score == 3
        assert r3.risk_level == RiskLevel.LOW

        r4 = calculate_findrisc(
            age=45, bmi=22.0, waist_cm=None, is_male=True,
            is_physically_active=False, eats_vegetables_daily=False,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="none",
        )
        # age=2 + activity=2 + veg=1 = 5 (slight)
        assert r4.total_score == 5
        assert r4.risk_level == RiskLevel.SLIGHT

    async def test_boundary_slight_moderate(self):
        """8점→SLIGHT, 9점→MODERATE 경계."""
        r8 = calculate_findrisc(
            age=55, bmi=26.0, waist_cm=None, is_male=True,
            is_physically_active=False, eats_vegetables_daily=False,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="none",
        )
        # age=3 + bmi=1 + activity=2 + veg=1 = 7 → SLIGHT
        assert r8.risk_level == RiskLevel.SLIGHT

    async def test_boundary_moderate_high(self):
        """12점→MODERATE, 13점→HIGH 경계."""
        r12 = calculate_findrisc(
            age=55, bmi=26.0, waist_cm=None, is_male=True,
            is_physically_active=False, eats_vegetables_daily=False,
            has_hypertension=False, has_high_glucose_history=True,
            family_history="none",
        )
        # age=3 + bmi=1 + activity=2 + veg=1 + glucose=5 = 12
        assert r12.total_score == 12
        assert r12.risk_level == RiskLevel.MODERATE

    async def test_boundary_high_very_high(self):
        """20점→HIGH, 21점→VERY_HIGH 경계."""
        r21 = calculate_findrisc(
            age=65, bmi=35.0, waist_cm=None, is_male=True,
            is_physically_active=False, eats_vegetables_daily=False,
            has_hypertension=True, has_high_glucose_history=True,
            family_history="none",
        )
        # age=4 + bmi=3 + activity=2 + veg=1 + hyp=2 + glucose=5 = 17 → HIGH
        assert r21.risk_level == RiskLevel.HIGH

    # ── Null 보수적 처리 ──

    async def test_null_activity_conservative(self):
        """activity=None → 2점 (보수적)."""
        result = calculate_findrisc(
            age=30, bmi=22.0, waist_cm=None, is_male=True,
            is_physically_active=None, eats_vegetables_daily=True,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="none",
        )
        assert result.score_breakdown["activity"] == 2

    async def test_null_vegetable_conservative(self):
        """vegetable=None → 1점 (보수적)."""
        result = calculate_findrisc(
            age=30, bmi=22.0, waist_cm=None, is_male=True,
            is_physically_active=True, eats_vegetables_daily=None,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="none",
        )
        assert result.score_breakdown["vegetable"] == 1

    async def test_null_hypertension_zero(self):
        """hypertension=None → 0점 (절대 가정 안 함)."""
        result = calculate_findrisc(
            age=30, bmi=22.0, waist_cm=None, is_male=True,
            is_physically_active=True, eats_vegetables_daily=True,
            has_hypertension=None, has_high_glucose_history=False,
            family_history="none",
        )
        assert result.score_breakdown["hypertension"] == 0

    # ── 가족력 ──

    async def test_family_parents(self):
        result = calculate_findrisc(
            age=30, bmi=22.0, waist_cm=None, is_male=True,
            is_physically_active=True, eats_vegetables_daily=True,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="parents",
        )
        assert result.score_breakdown["family"] == 5

    async def test_family_unknown_zero(self):
        result = calculate_findrisc(
            age=30, bmi=22.0, waist_cm=None, is_male=True,
            is_physically_active=True, eats_vegetables_daily=True,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="unknown",
        )
        assert result.score_breakdown["family"] == 0

    # ── 허리둘레 성별 차이 ──

    async def test_waist_male_thresholds(self):
        r_low = calculate_findrisc(
            age=30, bmi=22.0, waist_cm=90.0, is_male=True,
            is_physically_active=True, eats_vegetables_daily=True,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="none",
        )
        assert r_low.score_breakdown["waist"] == 0

        r_mid = calculate_findrisc(
            age=30, bmi=22.0, waist_cm=98.0, is_male=True,
            is_physically_active=True, eats_vegetables_daily=True,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="none",
        )
        assert r_mid.score_breakdown["waist"] == 3

        r_high = calculate_findrisc(
            age=30, bmi=22.0, waist_cm=110.0, is_male=True,
            is_physically_active=True, eats_vegetables_daily=True,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="none",
        )
        assert r_high.score_breakdown["waist"] == 4

    # ── 온보딩 초기 FINDRISC ──

    async def test_initial_findrisc_exercise_mapping(self):
        """exercise_frequency 매핑 테스트."""
        active = calculate_initial_findrisc(
            age=50, bmi=28.0, is_male=True,
            exercise_frequency="5_plus_per_week",
            eats_vegetables_daily=True,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="none",
        )
        assert active.score_breakdown["activity"] == 0

        inactive = calculate_initial_findrisc(
            age=50, bmi=28.0, is_male=True,
            exercise_frequency="1_2_per_week",
            eats_vegetables_daily=True,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="none",
        )
        assert inactive.score_breakdown["activity"] == 2

    async def test_initial_findrisc_no_waist(self):
        """온보딩에서는 waist=0점."""
        result = calculate_initial_findrisc(
            age=50, bmi=28.0, is_male=True,
            exercise_frequency="3_4_per_week",
            eats_vegetables_daily=True,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="none",
        )
        assert result.score_breakdown["waist"] == 0

    async def test_result_is_findrisc_result(self):
        """반환 타입 확인."""
        result = calculate_findrisc(
            age=30, bmi=22.0, waist_cm=None, is_male=True,
            is_physically_active=True, eats_vegetables_daily=True,
            has_hypertension=False, has_high_glucose_history=False,
            family_history="none",
        )
        assert isinstance(result, FindriscResult)
        assert isinstance(result.score_breakdown, dict)
        assert len(result.score_breakdown) == 8
