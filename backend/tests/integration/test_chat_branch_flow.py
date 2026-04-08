"""ChatService branch parity integration tests for DB side effects."""

import json
from datetime import date
from unittest.mock import AsyncMock, Mock

from tortoise.contrib.test import TestCase

from backend.models.chat import ChatMessage, ChatSession, MessageRole
from backend.models.enums import (
    AgeRange,
    AiConsent,
    AlcoholFrequency,
    ExerciseFrequency,
    FamilyHistory,
    FilterExpressionVerdict,
    FilterMedicalAction,
    MessageRoute,
    Relation,
    RiskLevel,
    SleepDurationBucket,
    SmokingStatus,
    UserGroup,
)
from backend.models.health import HealthProfile
from backend.models.users import Gender, User
from backend.services.chat import ChatService
from backend.services.content_filter import CRISIS_RESPONSE, FilterResult
from backend.services.content_filter_reason_codes import FilterReasonCode


def _parse_sse(payload: str) -> tuple[str, dict]:
    lines = payload.strip().splitlines()
    return lines[0][7:], json.loads(lines[1][6:])


class TestChatBranchFlow(TestCase):
    async def _make_user(self, email: str) -> User:
        return await User.create(
            email=email,
            hashed_password="hashed-password",
            name="채팅테스트",
            gender=Gender.MALE,
            birthday=date(1990, 1, 1),
            phone_number=f"010{abs(hash(email)) % 100000000:08d}",
        )

    async def _make_declined_profile(self, user: User) -> HealthProfile:
        return await HealthProfile.create(
            user=user,
            relation=Relation.PREDIABETES,
            user_group=UserGroup.B,
            gender=Gender.MALE,
            age_range=AgeRange.BETWEEN_45_54,
            height_cm=175.0,
            weight_kg=80.0,
            bmi=26.12,
            family_history=FamilyHistory.PARENTS,
            conditions=["hypertension"],
            has_hypertension=True,
            has_high_glucose_history=False,
            treatments=None,
            hba1c_range=None,
            fasting_glucose_range=None,
            exercise_frequency=ExerciseFrequency.ONE_TO_TWO,
            diet_habits=["irregular_meals"],
            sleep_duration_bucket=SleepDurationBucket.BETWEEN_6_7,
            alcohol_frequency=AlcoholFrequency.SOMETIMES,
            smoking_status=SmokingStatus.NON_SMOKER,
            goals=["weight_management"],
            ai_consent=AiConsent.DECLINED,
            initial_findrisc_score=8,
            initial_risk_level=RiskLevel.SLIGHT,
        )

    async def _collect(
        self,
        service: ChatService,
        user_id: int,
        message: str = "테스트 메시지",
    ) -> list[str]:
        return [
            event
            async for event in service.send_message_stream(
                user_id=user_id,
                message=message,
                session_id=None,
            )
        ]

    async def test_crisis_branch_writes_user_and_assistant_and_updates_cooldown(self):
        user = await self._make_user("chat_crisis@test.com")
        service = ChatService()
        service._validate_request = AsyncMock(return_value=None)
        service.content_filter.check_message = Mock(
            return_value=FilterResult(
                expression_verdict=FilterExpressionVerdict.ALLOW,
                medical_action=FilterMedicalAction.CRISIS_ESCALATE,
                reason_codes=[FilterReasonCode.CRISIS_INTENT],
                user_facing_message=CRISIS_RESPONSE,
            )
        )

        events = await self._collect(service, user.id, "죽고 싶다")

        assert len(events) >= 2
        first_type, first_data = _parse_sse(events[0])
        last_type, last_data = _parse_sse(events[-1])
        assert first_type == "token"
        assert first_data["content"]
        assert last_type == "done"
        assert "session_id" in last_data
        assert "health_questions" not in last_data

        sessions = await ChatSession.filter(user_id=user.id).all()
        assert len(sessions) == 1

        messages = await ChatMessage.filter(session_id=sessions[0].id).order_by("id").all()
        assert len(messages) == 2
        assert messages[0].role == MessageRole.USER
        assert messages[0].content == "죽고 싶다"
        assert messages[1].role == MessageRole.ASSISTANT
        assert messages[1].content == CRISIS_RESPONSE
        assert messages[1].has_health_questions is False
        assert user.id in service._last_crisis_at

    async def test_block_branch_has_no_db_write(self):
        user = await self._make_user("chat_block@test.com")
        service = ChatService()
        service._validate_request = AsyncMock(return_value=None)
        service.content_filter.check_message = Mock(
            return_value=FilterResult(
                expression_verdict=FilterExpressionVerdict.BLOCK,
                medical_action=FilterMedicalAction.NONE,
                user_facing_message="차단 메시지",
            )
        )

        events = await self._collect(service, user.id)

        assert len(events) == 1
        event_type, data = _parse_sse(events[0])
        assert event_type == "error"
        assert data["code"] == "content_blocked"
        assert await ChatSession.filter(user_id=user.id).count() == 0
        assert await ChatMessage.all().count() == 0

    async def test_ai_consent_declined_has_no_db_write(self):
        user = await self._make_user("chat_consent@test.com")
        await self._make_declined_profile(user)
        service = ChatService()
        service._validate_request = AsyncMock(return_value=None)
        service.content_filter.check_message = Mock(
            return_value=FilterResult(
                expression_verdict=FilterExpressionVerdict.ALLOW,
                medical_action=FilterMedicalAction.NONE,
            )
        )

        events = await self._collect(service, user.id)

        assert len(events) == 1
        event_type, data = _parse_sse(events[0])
        assert event_type == "error"
        assert data["code"] == "ai_consent_required"
        assert await ChatSession.filter(user_id=user.id).count() == 0
        assert await ChatMessage.all().count() == 0

    async def test_stream_failure_saves_only_user_message(self):
        user = await self._make_user("chat_stream_fail@test.com")
        service = ChatService()
        service._validate_request = AsyncMock(return_value=None)
        service._validate_chat_access = AsyncMock(return_value=(None, None))
        service.content_filter.check_message = Mock(
            return_value=FilterResult(
                expression_verdict=FilterExpressionVerdict.ALLOW,
                medical_action=FilterMedicalAction.NONE,
                message_route=MessageRoute.LIFESTYLE_CHAT,
            )
        )
        service.health_question_service.get_eligible_bundles = AsyncMock(return_value=[])
        service._build_openai_messages = AsyncMock(return_value=[{"role": "system", "content": "stub"}])

        async def fake_stream(_messages):
            yield None

        service._stream_openai = fake_stream

        events = await self._collect(service, user.id, "일반 메시지")

        assert len(events) == 1
        event_type, _data = _parse_sse(events[0])
        assert event_type == "error"

        sessions = await ChatSession.filter(user_id=user.id).all()
        assert len(sessions) == 1
        messages = await ChatMessage.filter(session_id=sessions[0].id).order_by("id").all()
        assert len(messages) == 1
        assert messages[0].role == MessageRole.USER
        assert messages[0].content == "일반 메시지"

    async def test_normal_flow_saves_user_and_assistant_and_done_payload(self):
        user = await self._make_user("chat_normal@test.com")
        service = ChatService()
        service._validate_request = AsyncMock(return_value=None)
        service._validate_chat_access = AsyncMock(return_value=(None, None))
        service.content_filter.check_message = Mock(
            return_value=FilterResult(
                expression_verdict=FilterExpressionVerdict.ALLOW,
                medical_action=FilterMedicalAction.NONE,
                message_route=MessageRoute.LIFESTYLE_CHAT,
            )
        )
        service.health_question_service.get_eligible_bundles = AsyncMock(return_value=["bundle_1"])
        service._build_openai_messages = AsyncMock(return_value=[{"role": "system", "content": "stub"}])

        async def fake_stream(_messages):
            yield "응답1"
            yield "응답2"

        service._stream_openai = fake_stream

        events = await self._collect(service, user.id, "정상 흐름")

        event_types = [_parse_sse(event)[0] for event in events]
        assert event_types == ["token", "token", "done"]
        done_type, done_data = _parse_sse(events[-1])
        assert done_type == "done"
        assert "session_id" in done_data
        assert "health_questions" in done_data

        sessions = await ChatSession.filter(user_id=user.id).all()
        assert len(sessions) == 1
        messages = await ChatMessage.filter(session_id=sessions[0].id).order_by("id").all()
        assert len(messages) == 2
        assert messages[0].role == MessageRole.USER
        assert messages[0].content == "정상 흐름"
        assert messages[1].role == MessageRole.ASSISTANT
        assert messages[1].content == "응답1응답2"
        assert messages[1].has_health_questions is True
        assert messages[1].bundle_keys == ["bundle_1"]
