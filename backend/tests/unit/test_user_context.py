"""UserContextService 단위 테스트.

핵심 테스트:
- profile=None → none 모드
- goals 매핑과 all 생략
- unknown/legacy/null 값 생략
- goal-only 생성
- goal + exercise 생성
- goal + sleep 생성
- 금지 필드가 summary에 절대 안 들어감
- <=160자 제한
"""

import pytest

from backend.services.user_context import (
    MAX_SUMMARY_CHARS,
    UserContextResult,
    UserContextService,
)

# ──────────────────────────────────────────────
# 테스트 헬퍼: 가짜 HealthProfile
# ──────────────────────────────────────────────


class _FakeProfile:
    """HealthProfile 대용 (DB 의존 없음)."""

    def __init__(
        self,
        goals=None,
        exercise_frequency=None,
        sleep_duration_bucket=None,
        user_group="C",
        # 금지 필드 — 테스트용으로만 설정
        bmi=None,
        has_hypertension=None,
        hba1c_range=None,
        fasting_glucose_range=None,
        initial_findrisc_score=None,
        initial_risk_level=None,
        treatments=None,
        conditions=None,
        family_history=None,
        smoking_status=None,
        alcohol_frequency=None,
    ):
        self.goals = goals or []
        self.exercise_frequency = exercise_frequency
        self.sleep_duration_bucket = sleep_duration_bucket
        self.user_group = user_group
        self.bmi = bmi
        self.has_hypertension = has_hypertension
        self.hba1c_range = hba1c_range
        self.fasting_glucose_range = fasting_glucose_range
        self.initial_findrisc_score = initial_findrisc_score
        self.initial_risk_level = initial_risk_level
        self.treatments = treatments
        self.conditions = conditions
        self.family_history = family_history
        self.smoking_status = smoking_status
        self.alcohol_frequency = alcohol_frequency


@pytest.fixture
def svc():
    return UserContextService()


# ──────────────────────────────────────────────
# 1. profile=None → none
# ──────────────────────────────────────────────


class TestProfileNone:
    def test_none_returns_empty(self, svc):
        result = svc.build_context(None)
        assert result.summary == ""
        assert result.has_context is False
        assert result.mode == "none"

    def test_none_with_topic_hint(self, svc):
        result = svc.build_context(None, topic_hint="sleep")
        assert result.has_context is False


# ──────────────────────────────────────────────
# 2. Goals 매핑
# ──────────────────────────────────────────────


class TestGoalMapping:
    @pytest.mark.parametrize(
        "goal_value,expected_label",
        [
            ("weight_management", "체중관리 목표"),
            ("diet_improvement", "식사개선 목표"),
            ("exercise_habit", "운동습관 목표"),
            ("health_tracking", "건강기록 관심"),
            ("risk_assessment", "건강점검 관심"),
        ],
    )
    def test_known_goals_mapped(self, svc, goal_value, expected_label):
        profile = _FakeProfile(goals=[goal_value])
        result = svc.build_context(profile)
        assert result.has_context is True
        assert expected_label in result.summary

    def test_all_goal_skipped(self, svc):
        profile = _FakeProfile(goals=["all"])
        result = svc.build_context(profile)
        assert result.has_context is False
        assert result.summary == ""

    def test_unknown_goal_skipped(self, svc):
        profile = _FakeProfile(goals=["unknown_legacy_value"])
        result = svc.build_context(profile)
        assert result.has_context is False

    def test_empty_goals(self, svc):
        profile = _FakeProfile(goals=[])
        result = svc.build_context(profile)
        assert result.has_context is False

    def test_multiple_goals_max_3(self, svc):
        profile = _FakeProfile(
            goals=[
                "weight_management",
                "diet_improvement",
                "exercise_habit",
                "health_tracking",
                "risk_assessment",
            ]
        )
        result = svc.build_context(profile)
        assert result.has_context is True
        # 최대 3개만 사용
        assert result.summary.count("·") <= 2


# ──────────────────────────────────────────────
# 3. Topic hint: exercise
# ──────────────────────────────────────────────


class TestExerciseHint:
    @pytest.mark.parametrize(
        "freq,expected_label",
        [
            ("none", "운동 안함"),
            ("1_2_per_week", "운동 주1-2회"),
            ("3_4_per_week", "운동 주3-4회"),
            ("5_plus_per_week", "운동 주5회 이상"),
        ],
    )
    def test_exercise_frequencies(self, svc, freq, expected_label):
        profile = _FakeProfile(
            goals=["exercise_habit"], exercise_frequency=freq
        )
        result = svc.build_context(profile, topic_hint="exercise")
        assert result.has_context is True
        assert expected_label in result.summary

    def test_exercise_hint_without_freq(self, svc):
        """exercise_frequency가 None이면 goals만 나옴."""
        profile = _FakeProfile(goals=["exercise_habit"], exercise_frequency=None)
        result = svc.build_context(profile, topic_hint="exercise")
        assert result.has_context is True
        assert "운동습관 목표" in result.summary
        assert "수준" not in result.summary


# ──────────────────────────────────────────────
# 4. Topic hint: sleep
# ──────────────────────────────────────────────


class TestSleepHint:
    @pytest.mark.parametrize(
        "bucket,expected_label",
        [
            ("under_5", "수면 5시간 미만"),
            ("between_5_6", "수면 5-6시간"),
            ("between_6_7", "수면 6-7시간"),
            ("between_7_8", "수면 7-8시간"),
            ("over_8", "수면 8시간 이상"),
        ],
    )
    def test_sleep_buckets(self, svc, bucket, expected_label):
        profile = _FakeProfile(
            goals=["health_tracking"], sleep_duration_bucket=bucket
        )
        result = svc.build_context(profile, topic_hint="sleep")
        assert result.has_context is True
        assert expected_label in result.summary


# ──────────────────────────────────────────────
# 5. Topic hint: None → goals만
# ──────────────────────────────────────────────


class TestNoTopicHint:
    def test_no_hint_goals_only(self, svc):
        profile = _FakeProfile(
            goals=["weight_management"],
            exercise_frequency="3_4_per_week",
            sleep_duration_bucket="between_7_8",
        )
        result = svc.build_context(profile, topic_hint=None)
        assert result.has_context is True
        assert "체중관리 목표" in result.summary
        # hint=None이면 exercise/sleep 추가 안 됨
        assert "운동" not in result.summary
        assert "수면" not in result.summary


# ──────────────────────────────────────────────
# 6. 160자 제한
# ──────────────────────────────────────────────


class TestCharLimit:
    def test_under_160_chars(self, svc):
        profile = _FakeProfile(
            goals=["weight_management", "diet_improvement", "exercise_habit"],
            exercise_frequency="5_plus_per_week",
        )
        result = svc.build_context(profile, topic_hint="exercise")
        assert len(result.summary) <= MAX_SUMMARY_CHARS

    def test_max_content_under_160(self, svc):
        """모든 필드 채워도 160자 이내."""
        profile = _FakeProfile(
            goals=[
                "weight_management",
                "diet_improvement",
                "exercise_habit",
                "health_tracking",
                "risk_assessment",
            ],
            exercise_frequency="5_plus_per_week",
            sleep_duration_bucket="over_8",
        )
        # exercise hint
        r1 = svc.build_context(profile, topic_hint="exercise")
        assert len(r1.summary) <= MAX_SUMMARY_CHARS
        # sleep hint
        r2 = svc.build_context(profile, topic_hint="sleep")
        assert len(r2.summary) <= MAX_SUMMARY_CHARS


# ──────────────────────────────────────────────
# 7. 금지 필드가 summary에 절대 안 들어감
# ──────────────────────────────────────────────


class TestForbiddenFields:
    """v1 제외 필드가 summary에 등장하면 안 됨."""

    def test_forbidden_values_never_in_summary(self, svc):
        profile = _FakeProfile(
            goals=["weight_management"],
            bmi=28.5,
            has_hypertension=True,
            hba1c_range="6.5_7.0",
            fasting_glucose_range="126_plus",
            initial_findrisc_score=18,
            initial_risk_level="high",
            treatments=["insulin", "metformin"],
            conditions=["diabetes"],
            family_history="parents",
            smoking_status="current",
            alcohol_frequency="daily",
        )
        result = svc.build_context(profile, topic_hint=None)
        summary = result.summary

        # 금지 필드 값이 summary에 없어야 함
        forbidden_strings = [
            "28.5", "bmi", "BMI",
            "hypertension", "고혈압",
            "hba1c", "HbA1c",
            "glucose", "혈당",
            "findrisc", "FINDRISC",
            "high", "low",
            "insulin", "인슐린",
            "metformin",
            "diabetes", "당뇨",
            "진단", "환자", "처방", "치료", "투약",
            "parents", "siblings",  # family_history
            "current", "former",  # smoking_status
            "daily", "often",  # alcohol_frequency
        ]
        for term in forbidden_strings:
            assert term.lower() not in summary.lower(), (
                f"금지 문자열 '{term}'이 summary에 포함됨: {summary}"
            )


# ──────────────────────────────────────────────
# 8. 결과 타입 검증
# ──────────────────────────────────────────────


class TestResultType:
    def test_result_is_frozen_dataclass(self, svc):
        result = svc.build_context(None)
        assert isinstance(result, UserContextResult)
        with pytest.raises(AttributeError):
            result.summary = "수정 불가"

    def test_mode_values(self, svc):
        none_result = svc.build_context(None)
        assert none_result.mode == "none"

        profile = _FakeProfile(goals=["weight_management"])
        ok_result = svc.build_context(profile)
        assert ok_result.mode == "profile_only"
