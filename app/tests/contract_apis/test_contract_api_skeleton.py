from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from app.main import app


class TestContractApiSkeleton(TestCase):
    async def _issue_access_token(self) -> str:
        signup_data = {
            "email": "contract_test@example.com",
            "password": "Password123!",
            "name": "계약테스터",
            "gender": "FEMALE",
            "birth_date": "1995-05-05",
            "phone_number": "01033334444",
        }
        login_data = {"email": signup_data["email"], "password": signup_data["password"]}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/auth/signup", json=signup_data)
            response = await client.post("/api/v1/auth/login", json=login_data)

        return response.json()["access_token"]

    async def test_onboarding_survey_reissues_access_token(self):
        access_token = await self._issue_access_token()
        request_body = {
            "user_group": "B",
            "gender": "male",
            "age_range": "45_54",
            "height_cm": 175.0,
            "weight_kg": 80.0,
            "conditions": ["hypertension"],
            "family_history": "parent_or_sibling",
            "exercise_frequency": "less_than_4h",
            "has_daily_vegetables": False,
            "smoking_status": "non_smoker",
            "diet_habits": ["irregular_meals"],
            "goals": ["weight_management"],
            "notification_preference": "morning",
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/onboarding/survey",
                json=request_body,
                headers={"Authorization": f"Bearer {access_token}"},
            )

        assert response.status_code == status.HTTP_201_CREATED
        payload = response.json()
        assert payload["user_group"] == "B"
        assert "access_token" in payload
        assert payload["bmi"] == 26.1

    async def test_health_patch_uses_explicit_schema(self):
        access_token = await self._issue_access_token()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.patch(
                "/api/v1/health/daily/2026-04-01",
                json={
                    "source": "chat",
                    "sleep": "good",
                    "sleep_hours": 7.5,
                    "breakfast": "hearty",
                    "unexpected_field": "boom",
                },
                headers={"Authorization": f"Bearer {access_token}"},
            )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_challenge_overview_matches_contract_route(self):
        access_token = await self._issue_access_token()

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get(
                "/api/v1/challenges/overview",
                headers={"Authorization": f"Bearer {access_token}"},
            )

        assert response.status_code == status.HTTP_200_OK
        payload = response.json()
        assert "active" in payload
        assert "recommended" in payload
        assert "badges" in payload
