from datetime import date, timedelta

from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from backend.main import app
from backend.models.email_signup_sessions import EmailSignupSession
from backend.models.health import DailyHealthLog
from backend.models.users import User
from backend.utils.security import verify_password

PASSWORD = "Test1234!@"
CONSENT_DATA = {
    "terms_of_service": True,
    "privacy_policy": True,
    "health_data_consent": True,
    "disclaimer_consent": True,
}
SURVEY_DATA = {
    "relation": "prediabetes",
    "gender": "MALE",
    "age_range": "45_54",
    "height_cm": 175.0,
    "weight_kg": 80.0,
    "family_history": "parents",
    "conditions": ["hypertension"],
    "exercise_frequency": "1_2_per_week",
    "diet_habits": ["irregular_meals"],
    "sleep_duration_bucket": "between_6_7",
    "alcohol_frequency": "sometimes",
    "smoking_status": "non_smoker",
    "goals": ["weight_management"],
    "ai_consent": "agreed",
}


class TestSettingsAndReports(TestCase):
    async def _signup_login_consent_survey(self, client: AsyncClient, email: str) -> dict:
        await client.post("/api/v1/auth/signup", json={
            "email": email,
            "password": PASSWORD,
            "name": "설정테스트",
            "gender": "MALE",
            "birth_date": "1990-01-01",
            "phone_number": f"010-3333-{hash(email) % 10000:04d}",
        })
        login = await client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        await client.post("/api/v1/auth/consent", json=CONSENT_DATA, headers=headers)
        await client.post("/api/v1/onboarding/survey", json=SURVEY_DATA, headers=headers)
        return headers

    async def test_settings_get_and_patch(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            headers = await self._signup_login_consent_survey(c, "settings_get@test.com")

            r = await c.get("/api/v1/settings", headers=headers)
            assert r.status_code == status.HTTP_200_OK
            assert r.json()["chat_notification"] is True
            assert r.json()["max_bundles_per_day"] == 5

            r = await c.patch("/api/v1/settings", json={
                "chat_notification": False,
                "challenge_reminder": False,
                "max_bundles_per_day": 3,
                "preferred_times": ["evening"],
            }, headers=headers)

        assert r.status_code == status.HTTP_200_OK
        data = r.json()
        assert data["chat_notification"] is False
        assert data["challenge_reminder"] is False
        assert data["max_bundles_per_day"] == 3
        assert data["preferred_times"] == ["evening"]

    async def test_settings_export_csv(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            headers = await self._signup_login_consent_survey(c, "settings_export@test.com")
            r = await c.post("/api/v1/settings/export", headers=headers)

        assert r.status_code == status.HTTP_200_OK
        assert "text/csv" in r.headers["content-type"]
        assert "section,field,value" in r.text
        assert "settings,chat_notification,True" in r.text

    async def test_patch_consent_updates_health_data(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            headers = await self._signup_login_consent_survey(c, "consent_patch@test.com")
            r = await c.patch("/api/v1/auth/consent", json={
                "health_data_consent": False,
            }, headers=headers)

        assert r.status_code == status.HTTP_200_OK
        assert r.json()["health_data_consent"] is False

    async def test_account_email_verification_updates_user_email(self):
        email = "social-missing-email@test.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            await User.create(
                provider="kakao",
                provider_user_id="kakao-user-1",
                email=None,
                hashed_password=None,
                name="Social User",
            )
            login_user = await User.get(provider_user_id="kakao-user-1")
            login = await c.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
            assert login.status_code != status.HTTP_200_OK

            from backend.services.jwt import JwtService

            token = JwtService().issue_jwt_pair(login_user)["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            request_res = await c.post(
                "/api/v1/auth/email/account/request",
                json={"email": email},
                headers=headers,
            )
            assert request_res.status_code == status.HTTP_201_CREATED

            session = await EmailSignupSession.filter(user_id=login_user.id, email=email).order_by("-created_at").first()
            assert session is not None

            confirm_res = await c.post(
                "/api/v1/auth/email/account/confirm",
                json={"email": email, "code": request_res.json()["dev_verification_code"]},
                headers=headers,
            )

        assert confirm_res.status_code == status.HTTP_200_OK
        updated = await User.get(id=login_user.id)
        assert updated.email == email
        assert updated.email_verified is True

    async def test_password_change_updates_hashed_password(self):
        email = "password_change@test.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            await c.post("/api/v1/auth/signup", json={
                "email": email,
                "password": PASSWORD,
                "name": "Password User",
                "gender": "MALE",
                "birth_date": "1990-01-01",
                "phone_number": "010-4444-5555",
            })
            login = await c.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
            headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

            change_res = await c.post(
                "/api/v1/auth/password/change",
                json={
                    "current_password": PASSWORD,
                    "new_password": "NewPassword123!",
                },
                headers=headers,
            )

        assert change_res.status_code == status.HTTP_200_OK
        user = await User.get(email=email)
        assert user.hashed_password != PASSWORD
        assert verify_password("NewPassword123!", user.hashed_password)

    async def test_onboarding_status_includes_profile_summary(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            headers = await self._signup_login_consent_survey(c, "onboarding_status@test.com")
            r = await c.get("/api/v1/onboarding/status", headers=headers)

        assert r.status_code == status.HTTP_200_OK
        data = r.json()
        assert data["is_completed"] is True
        assert data["user_group"] == "B"
        assert data["gender"] == "MALE"
        assert data["age_range"] == "45_54"
        assert data["bmi"] > 0

        user = await User.get(email="onboarding_status@test.com")
        assert user.onboarding_completed is True
        assert user.onboarding_completed_at is not None

    async def test_risk_history_returns_weekly_records(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            headers = await self._signup_login_consent_survey(c, "risk_history@test.com")
            recalc = await c.post("/api/v1/risk/recalculate", headers=headers)
            assert recalc.status_code == status.HTTP_200_OK
            r = await c.get("/api/v1/risk/history", headers=headers)

        assert r.status_code == status.HTTP_200_OK
        assert len(r.json()["history"]) >= 1

    async def test_health_weekly_returns_category_summary(self):
        email = "health_weekly@test.com"
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            headers = await self._signup_login_consent_survey(c, email)
            user = await User.get(email=email)
            today = date.today()

            await c.patch(f"/api/v1/health/daily/{today.isoformat()}", json={
                "source": "direct",
                "sleep_quality": "good",
                "sleep_duration_bucket": "between_7_8",
                "vegetable_intake_level": "enough",
                "meal_balance_level": "balanced",
                "exercise_done": True,
                "exercise_minutes": 30,
                "walk_done": True,
                "water_cups": 7,
            }, headers=headers)

            await DailyHealthLog.create(
                user_id=user.id,
                log_date=today - timedelta(days=7),
                sleep_quality="normal",
                sleep_duration_bucket="between_6_7",
                vegetable_intake_level="little",
                meal_balance_level="carb_heavy",
                exercise_done=False,
                walk_done=False,
                water_cups=3,
            )

            r = await c.get("/api/v1/health/weekly", headers=headers)

        assert r.status_code == status.HTTP_200_OK
        data = r.json()
        assert set(data["categories"].keys()) == {"sleep", "diet", "exercise", "hydration"}
        assert len(data["categories"]["sleep"]["series"]) == 7
