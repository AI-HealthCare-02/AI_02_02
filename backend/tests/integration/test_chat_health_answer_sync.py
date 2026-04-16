from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from backend.main import app

PASSWORD = "Test1234!@"


class TestChatHealthAnswerSync(TestCase):
    async def _signup_and_login(self, client: AsyncClient, email: str) -> dict:
        await client.post(
            "/api/v1/auth/signup",
            json={
                "email": email,
                "password": PASSWORD,
                "name": "테스트",
                "gender": "MALE",
                "birth_date": "1990-01-01",
                "phone_number": f"010-8888-{hash(email) % 10000:04d}",
            },
        )
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": PASSWORD},
        )
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_health_answer_returns_latest_daily_snapshot_for_mood(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = await self._signup_and_login(client, "chat_health_mood@test.com")

            response = await client.post(
                "/api/v1/chat/health-answer",
                json={
                    "bundle_key": "bundle_7",
                    "answers": {"mood_level": "stressed"},
                },
                headers=headers,
            )

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["saved_fields"] == ["mood_level"]
        assert body["daily_log"]["mood_level"] == "stressed"
        assert body["pending_questions"] is not None
        bundle_7 = next(
            bundle for bundle in body["pending_questions"]["bundles"] if bundle["bundle_key"] == "bundle_7"
        )
        assert bundle_7["unanswered_fields"] == ["alcohol_today"]
        assert body["card_availability"] is not None

    async def test_health_answer_keeps_alcohol_pending_until_amount_is_saved(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = await self._signup_and_login(client, "chat_health_alcohol@test.com")

            await client.post(
                "/api/v1/chat/health-answer",
                json={
                    "bundle_key": "bundle_7",
                    "answers": {"mood_level": "good"},
                },
                headers=headers,
            )

            response = await client.post(
                "/api/v1/chat/health-answer",
                json={
                    "bundle_key": "bundle_7",
                    "answers": {"alcohol_today": True},
                },
                headers=headers,
            )

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["saved_fields"] == ["alcohol_today"]
        assert body["daily_log"]["mood_level"] == "good"
        assert body["daily_log"]["alcohol_today"] is True
        assert body["daily_log"]["alcohol_amount_level"] is None
        bundle_7 = next(
            bundle for bundle in body["pending_questions"]["bundles"] if bundle["bundle_key"] == "bundle_7"
        )
        assert bundle_7["unanswered_fields"] == ["alcohol_amount_level"]
