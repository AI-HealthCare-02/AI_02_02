from __future__ import annotations

from datetime import date

from tortoise.contrib.test import TestCase

from backend.models.assessments import UserEngagement
from backend.models.chat import ChatMessage, ChatSession, MessageRole
from backend.models.enums import DataSource
from backend.models.health import DailyHealthLog
from backend.models.users import Gender, User
from backend.services.chat import ChatService
from backend.services.health_question import HealthQuestionService


class TestChatPhase1Guards(TestCase):
    async def _make_user(self, email: str) -> User:
        return await User.create(
            email=email,
            hashed_password="hashed-password",
            name="phase1-test",
            gender=Gender.MALE,
            birthday=date(1990, 1, 1),
            phone_number=f"010{abs(hash(email)) % 100000000:08d}",
        )

    async def test_prompt_history_uses_latest_ten_in_chronological_order(self):
        user = await self._make_user("phase1-history@test.com")
        session = await ChatSession.create(user_id=user.id, title="history")
        for index in range(1, 13):
            await ChatMessage.create(
                session=session,
                role=MessageRole.USER if index % 2 else MessageRole.ASSISTANT,
                content=f"message-{index}",
            )

        history = await ChatService()._get_prompt_history(session)

        assert [turn.content for turn in history] == [f"message-{index}" for index in range(3, 13)]

    async def test_duplicate_health_answer_does_not_extend_engagement(self):
        user = await self._make_user("phase1-health@test.com")
        service = HealthQuestionService()

        first = await service.save_health_answers(
            user_id=user.id,
            bundle_key="bundle_1",
            answers={"sleep_quality": "good"},
        )

        engagement_after_first = await UserEngagement.get(user_id=user.id)
        first_cooldown = engagement_after_first.cooldown_until

        second = await service.save_health_answers(
            user_id=user.id,
            bundle_key="bundle_1",
            answers={"sleep_quality": "bad"},
        )

        engagement_after_second = await UserEngagement.get(user_id=user.id)
        log = await DailyHealthLog.get(user_id=user.id)

        assert first["saved_fields"] == ["sleep_quality"]
        assert first["cooldown_until"] is not None
        assert second["saved_fields"] == []
        assert second["skipped_fields"] == ["sleep_quality"]
        assert second["cooldown_until"] is None
        assert engagement_after_first.today_bundle_count == 1
        assert engagement_after_second.today_bundle_count == 1
        assert engagement_after_second.total_responses == 1
        assert engagement_after_second.cooldown_until == first_cooldown
        assert log.sleep_quality == "good"
        assert log.sleep_quality_source == DataSource.CHAT

    async def test_mixed_new_and_existing_fields_still_update_engagement(self):
        user = await self._make_user("phase1-health-mixed@test.com")
        service = HealthQuestionService()

        await service.save_health_answers(
            user_id=user.id,
            bundle_key="bundle_1",
            answers={"sleep_quality": "good"},
        )
        first_engagement = await UserEngagement.get(user_id=user.id)

        result = await service.save_health_answers(
            user_id=user.id,
            bundle_key="bundle_1",
            answers={
                "sleep_quality": "bad",
                "sleep_duration_bucket": "between_6_7",
            },
        )

        second_engagement = await UserEngagement.get(user_id=user.id)
        log = await DailyHealthLog.get(user_id=user.id)

        assert result["saved_fields"] == ["sleep_duration_bucket"]
        assert result["skipped_fields"] == ["sleep_quality"]
        assert result["cooldown_until"] is not None
        assert second_engagement.today_bundle_count == 2
        assert second_engagement.total_responses == 2
        assert second_engagement.cooldown_until >= first_engagement.cooldown_until
        assert log.sleep_duration_bucket == "between_6_7"
