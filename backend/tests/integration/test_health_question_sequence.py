from __future__ import annotations

from datetime import date, datetime

from tortoise.contrib.test import TestCase

from backend.core import config
from backend.models.chat import ChatMessage, ChatSession, MessageRole
from backend.models.enums import (
    AgeRange,
    AiConsent,
    AlcoholFrequency,
    ExerciseFrequency,
    FamilyHistory,
    Relation,
    SleepDurationBucket,
    SmokingStatus,
    UserGroup,
)
from backend.models.health import DailyHealthLog, HealthProfile
from backend.models.settings import UserSettings
from backend.models.users import Gender, User
from backend.services.health_question import HealthQuestionService


class TestHealthQuestionSequence(TestCase):
    async def _make_user(self, email: str) -> User:
        return await User.create(
            email=email,
            hashed_password="hashed-password",
            name="sequence-test",
            gender=Gender.MALE,
            birthday=date(1990, 1, 1),
            phone_number=f"010{abs(hash(email)) % 100000000:08d}",
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

    async def _ensure_notification_on(self, user_id: int) -> None:
        settings, _ = await UserSettings.get_or_create(user_id=user_id)
        settings.chat_notification = True
        await settings.save()

    async def test_first_question_at_11_starts_bundle_1_for_group_a(self):
        user = await self._make_user("sequence-11-a@test.com")
        await self._make_profile(user.id, UserGroup.A)
        await self._ensure_notification_on(user.id)

        now = datetime(2026, 4, 15, 11, 0, tzinfo=config.TIMEZONE)
        bundles = await HealthQuestionService().get_eligible_bundles(
            user.id,
            now=now,
            include_current_message_anchor=True,
        )

        assert bundles == ["bundle_1"]

    async def test_first_question_at_15_starts_bundle_1_for_group_c(self):
        user = await self._make_user("sequence-15-c@test.com")
        await self._make_profile(user.id, UserGroup.C)
        await self._ensure_notification_on(user.id)

        now = datetime(2026, 4, 15, 15, 0, tzinfo=config.TIMEZONE)
        bundles = await HealthQuestionService().get_eligible_bundles(
            user.id,
            now=now,
            include_current_message_anchor=True,
        )

        assert bundles == ["bundle_1"]

    async def test_next_bundle_advances_after_bundle_1_is_complete(self):
        user = await self._make_user("sequence-next@test.com")
        await self._make_profile(user.id, UserGroup.B)
        await self._ensure_notification_on(user.id)
        now = datetime(2026, 4, 15, 15, 30, tzinfo=config.TIMEZONE)

        await DailyHealthLog.create(
            user_id=user.id,
            log_date=now.date(),
            sleep_quality="good",
            sleep_duration_bucket="between_6_7",
        )

        bundles = await HealthQuestionService().get_eligible_bundles(
            user.id,
            now=now,
            include_current_message_anchor=True,
        )

        assert bundles == ["bundle_2"]

    async def test_midnight_to_four_blocks_new_day_sequence(self):
        user = await self._make_user("sequence-midnight@test.com")
        await self._make_profile(user.id, UserGroup.C)
        await self._ensure_notification_on(user.id)
        now = datetime(2026, 4, 16, 0, 5, tzinfo=config.TIMEZONE)

        availability = await HealthQuestionService().get_card_availability(
            user.id,
            now=now,
            include_current_message_anchor=True,
        )

        assert availability["is_available"] is False
        assert availability["blocked_reason"] == "daily_reset_wait"
        assert availability["available_after"] == datetime(2026, 4, 16, 4, 0, tzinfo=config.TIMEZONE)

    async def test_after_four_starts_bundle_1_for_new_day(self):
        user = await self._make_user("sequence-after-four@test.com")
        await self._make_profile(user.id, UserGroup.C)
        await self._ensure_notification_on(user.id)
        now = datetime(2026, 4, 16, 4, 5, tzinfo=config.TIMEZONE)

        bundles = await HealthQuestionService().get_eligible_bundles(
            user.id,
            now=now,
            include_current_message_anchor=True,
        )

        assert bundles == ["bundle_1"]

    async def test_a_group_keeps_medication_inside_bundle_2(self):
        user = await self._make_user("sequence-group-a@test.com")
        await self._make_profile(user.id, UserGroup.A)
        await self._ensure_notification_on(user.id)
        now = datetime(2026, 4, 15, 16, 0, tzinfo=config.TIMEZONE)

        await DailyHealthLog.create(
            user_id=user.id,
            log_date=now.date(),
            sleep_quality="good",
            sleep_duration_bucket="between_6_7",
        )

        pending = await HealthQuestionService().get_daily_pending_questions(user.id)
        bundle_keys = [bundle["bundle_key"] for bundle in pending["bundles"]]

        bundles = await HealthQuestionService().get_eligible_bundles(
            user.id,
            now=now,
            include_current_message_anchor=True,
        )
        assert bundles == ["bundle_2"]
        assert "bundle_2" in bundle_keys
        assert "bundle_6" not in bundle_keys

    async def test_first_user_message_after_four_is_used_as_sequence_anchor(self):
        user = await self._make_user("sequence-anchor@test.com")
        await self._make_profile(user.id, UserGroup.C)
        await self._ensure_notification_on(user.id)
        session = await ChatSession.create(user_id=user.id, title="anchor")
        anchor_time = datetime(2026, 4, 15, 9, 10, tzinfo=config.TIMEZONE)
        now = datetime(2026, 4, 15, 18, 0, tzinfo=config.TIMEZONE)

        await ChatMessage.create(
            session=session,
            role=MessageRole.USER,
            content="첫 질문",
            created_at=anchor_time,
        )

        availability = await HealthQuestionService().get_card_availability(
            user.id,
            now=now,
        )

        assert availability["sequence_started_at"] == anchor_time
        assert availability["next_bundle_key"] == "bundle_1"
