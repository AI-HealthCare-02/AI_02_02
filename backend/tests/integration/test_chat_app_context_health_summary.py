from __future__ import annotations

from datetime import date, datetime

from tortoise.contrib.test import TestCase

from backend.core import config
from backend.models.enums import (
    AgeRange,
    AiConsent,
    AlcoholFrequency,
    ExerciseFrequency,
    FamilyHistory,
    MealStatus,
    MoodLevel,
    Relation,
    SleepDurationBucket,
    SleepQuality,
    SmokingStatus,
    UserGroup,
)
from backend.models.health import DailyHealthLog, HealthProfile
from backend.models.users import Gender, User
from backend.services.health_question import HealthQuestionService


class TestChatAppContextHealthSummary(TestCase):
    async def _make_user(self, email: str) -> User:
        return await User.create(
            email=email,
            hashed_password="hashed-password",
            name="summary-test",
            gender=Gender.MALE,
            birthday=date(1990, 1, 1),
            phone_number=f"010{abs(hash(email)) % 100000000:08d}",
            onboarding_completed=True,
            onboarding_completed_at=datetime.now(tz=config.TIMEZONE),
        )

    async def _make_profile(self, user_id: int, user_group: UserGroup) -> None:
        await HealthProfile.create(
            user_id=user_id,
            relation=Relation.CURIOUS if user_group == UserGroup.C else Relation.DIAGNOSED,
            user_group=user_group,
            gender=Gender.MALE,
            age_range=AgeRange.UNDER_45,
            height_cm=175.0,
            weight_kg=70.0,
            bmi=22.9,
            family_history=FamilyHistory.NONE,
            conditions=[],
            has_hypertension=False,
            has_high_glucose_history=False,
            treatments=[] if user_group == UserGroup.A else None,
            hba1c_range=None,
            fasting_glucose_range=None,
            exercise_frequency=ExerciseFrequency.NONE,
            diet_habits=[],
            sleep_duration_bucket=SleepDurationBucket.BETWEEN_6_7,
            alcohol_frequency=AlcoholFrequency.NONE,
            smoking_status=SmokingStatus.NON_SMOKER,
            goals=[],
            ai_consent=AiConsent.AGREED,
        )

    async def test_daily_missing_summary_skips_conditional_fields_and_group_a_only_for_group_c(self):
        user = await self._make_user("summary-c@test.com")
        await self._make_profile(user.id, UserGroup.C)
        await DailyHealthLog.create(
            user_id=user.id,
            log_date=datetime.now(tz=config.TIMEZONE).date(),
            sleep_quality=SleepQuality.GOOD,
            breakfast_status=MealStatus.SIMPLE,
            exercise_done=False,
            alcohol_today=False,
        )

        summary = await HealthQuestionService().get_daily_missing_summary(user.id)

        assert summary["count"] == 6
        assert summary["question_labels"] == [
            "수면 시간",
            "식사 균형",
            "당류 음료나 간식",
            "채소 섭취",
            "걷기 여부",
            "기분 상태",
        ]
        assert "복약 여부" not in summary["question_labels"]
        assert "운동 종류" not in summary["question_labels"]
        assert "운동 시간" not in summary["question_labels"]
        assert "음주량" not in summary["question_labels"]

    async def test_daily_missing_summary_counts_group_a_and_conditional_followups_once(self):
        user = await self._make_user("summary-a@test.com")
        await self._make_profile(user.id, UserGroup.A)
        await DailyHealthLog.create(
            user_id=user.id,
            log_date=datetime.now(tz=config.TIMEZONE).date(),
            sleep_quality=SleepQuality.GOOD,
            sleep_duration_bucket=SleepDurationBucket.BETWEEN_6_7,
            breakfast_status=MealStatus.HEARTY,
            meal_balance_level="balanced",
            sweetdrink_level="none",
            exercise_done=True,
            vegetable_intake_level="enough",
            walk_done=True,
            mood_level=MoodLevel.GOOD,
            alcohol_today=True,
        )

        summary = await HealthQuestionService().get_daily_missing_summary(user.id)

        assert summary["count"] == 4
        assert summary["question_labels"] == [
            "운동 종류",
            "운동 시간",
            "복약 여부",
            "음주량",
        ]
        assert summary["bundle_names"] == ["아침 식사", "운동", "기분과 음주"]

    async def test_sleep_bundle_stays_incomplete_until_quality_and_duration_exist(self):
        user = await self._make_user("summary-sleep-order@test.com")
        await self._make_profile(user.id, UserGroup.C)
        await DailyHealthLog.create(
            user_id=user.id,
            log_date=datetime.now(tz=config.TIMEZONE).date(),
            sleep_quality=SleepQuality.GOOD,
        )

        eligible = HealthQuestionService()._filter_unanswered(
            ["bundle_1"],
            await DailyHealthLog.get(user_id=user.id),
            UserGroup.C,
        )

        assert eligible == ["bundle_1"]

    async def test_group_a_pending_questions_keep_medication_inside_breakfast_bundle(self):
        user = await self._make_user("summary-pending-a@test.com")
        await self._make_profile(user.id, UserGroup.A)
        await DailyHealthLog.create(
            user_id=user.id,
            log_date=datetime.now(tz=config.TIMEZONE).date(),
            sleep_quality=SleepQuality.GOOD,
            sleep_duration_bucket=SleepDurationBucket.BETWEEN_6_7,
            breakfast_status=MealStatus.HEARTY,
        )

        pending = await HealthQuestionService().get_daily_pending_questions(user.id)
        bundle_keys = [bundle["bundle_key"] for bundle in pending["bundles"]]

        assert "bundle_2" in bundle_keys
        assert "bundle_6" not in bundle_keys
        morning_bundle = next(bundle for bundle in pending["bundles"] if bundle["bundle_key"] == "bundle_2")
        assert any(question["field"] == "took_medication" for question in morning_bundle["questions"])
