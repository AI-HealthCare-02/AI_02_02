from datetime import date

from tortoise.contrib.test import TestCase

from backend.models.chat import ChatMessage, ChatSession, MessageRole
from backend.models.users import Gender, User
from backend.services.chat import ChatService


class TestChatSessionsList(TestCase):
    async def _make_user(self, email: str) -> User:
        return await User.create(
            email=email,
            hashed_password="hashed-password",
            name="세션 테스트",
            gender=Gender.MALE,
            birthday=date(1990, 1, 1),
            phone_number=f"010{abs(hash(email)) % 100000000:08d}",
        )

    async def test_get_sessions_returns_only_current_user_sessions(self):
        user = await self._make_user("sessions_owner@test.com")
        other_user = await self._make_user("sessions_other@test.com")

        older_session = await ChatSession.create(user_id=user.id, title="첫 대화")
        await ChatMessage.create(session=older_session, role=MessageRole.USER, content="첫 질문")
        await ChatMessage.create(session=older_session, role=MessageRole.ASSISTANT, content="첫 답변")

        newer_session = await ChatSession.create(user_id=user.id, title="둘째 대화")
        await ChatMessage.create(session=newer_session, role=MessageRole.USER, content="둘째 질문")

        foreign_session = await ChatSession.create(user_id=other_user.id, title="남의 대화")
        await ChatMessage.create(session=foreign_session, role=MessageRole.USER, content="남의 질문")

        service = ChatService()
        result = await service.get_sessions(user_id=user.id, limit=10)

        assert [session.id for session in result.sessions] == [newer_session.id, older_session.id]
        assert [session.title for session in result.sessions] == ["둘째 대화", "첫 대화"]
        assert [session.message_count for session in result.sessions] == [1, 2]
