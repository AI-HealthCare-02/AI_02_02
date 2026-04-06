"""온보딩 전체 흐름 테스트.

가입 → 동의 → 설문 → user_group + FINDRISC + 새 JWT 검증.
"""

from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from backend.main import app

PASSWORD = "Test1234!@"
CONSENT_DATA = {
    "terms_of_service": True,
    "privacy_policy": True,
    "health_data_consent": True,
    "disclaimer_consent": True,
}


def _make_survey(relation: str = "prediabetes") -> dict:
    """테스트용 설문 데이터 생성."""
    return {
        "relation": relation,
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


class TestOnboardingFlow(TestCase):
    """온보딩 전체 흐름 테스트."""

    async def _signup_login_consent(self, client: AsyncClient, email: str) -> dict:
        """회원가입 + 로그인 + 동의 → 인증 헤더 반환."""
        await client.post("/api/v1/auth/signup", json={
            "email": email, "password": PASSWORD, "name": "온보딩테스트",
            "gender": "MALE", "birth_date": "1990-01-01",
            "phone_number": f"010-9876-{hash(email) % 10000:04d}",
        })
        r = await client.post("/api/v1/auth/login", json={
            "email": email, "password": PASSWORD,
        })
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}

        await client.post("/api/v1/auth/consent", json=CONSENT_DATA, headers=h)
        return h

    async def test_group_b_prediabetes(self):
        """relation=prediabetes → user_group="B"."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            h = await self._signup_login_consent(c, "onboard_b@test.com")
            r = await c.post("/api/v1/onboarding/survey", json=_make_survey("prediabetes"), headers=h)

        assert r.status_code == status.HTTP_201_CREATED
        data = r.json()
        assert data["user_group"] == "B"

    async def test_group_a_diagnosed(self):
        """relation=diagnosed → user_group="A"."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            h = await self._signup_login_consent(c, "onboard_a@test.com")
            r = await c.post("/api/v1/onboarding/survey", json=_make_survey("diagnosed"), headers=h)

        assert r.status_code == status.HTTP_201_CREATED
        assert r.json()["user_group"] == "A"

    async def test_group_c_prevention(self):
        """relation=prevention → user_group="C"."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            h = await self._signup_login_consent(c, "onboard_c@test.com")
            r = await c.post("/api/v1/onboarding/survey", json=_make_survey("prevention"), headers=h)

        assert r.status_code == status.HTTP_201_CREATED
        assert r.json()["user_group"] == "C"

    async def test_findrisc_score_in_response(self):
        """설문 응답에 FINDRISC 점수(0-26)와 risk_level 포함."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            h = await self._signup_login_consent(c, "onboard_score@test.com")
            r = await c.post("/api/v1/onboarding/survey", json=_make_survey(), headers=h)

        data = r.json()
        assert 0 <= data["initial_findrisc_score"] <= 26
        assert data["initial_risk_level"] in ("low", "slight", "moderate", "high", "very_high")

    async def test_new_jwt_in_response(self):
        """설문 완료 시 access_token이 응답에 포함."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            h = await self._signup_login_consent(c, "onboard_jwt@test.com")
            r = await c.post("/api/v1/onboarding/survey", json=_make_survey(), headers=h)

        data = r.json()
        assert "access_token" in data
        assert len(data["access_token"]) > 20

    async def test_new_jwt_has_refresh_cookie(self):
        """설문 완료 시 refresh_token 쿠키 갱신."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            h = await self._signup_login_consent(c, "onboard_cookie@test.com")
            r = await c.post("/api/v1/onboarding/survey", json=_make_survey(), headers=h)

        assert any("refresh_token" in header for header in r.headers.get_list("set-cookie"))

    async def test_survey_without_consent_403(self):
        """동의 없이 설문 → 403."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            await c.post("/api/v1/auth/signup", json={
                "email": "no_consent@test.com", "password": PASSWORD,
                "name": "테스트", "gender": "MALE", "birth_date": "1990-01-01",
                "phone_number": "010-5555-6666",
            })
            r = await c.post("/api/v1/auth/login", json={
                "email": "no_consent@test.com", "password": PASSWORD,
            })
            h = {"Authorization": f"Bearer {r.json()['access_token']}"}

            r = await c.post("/api/v1/onboarding/survey", json=_make_survey(), headers=h)

        assert r.status_code == status.HTTP_403_FORBIDDEN

    async def test_bmi_calculation(self):
        """BMI 자동 계산 확인 (175cm, 80kg → ~26.1)."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            h = await self._signup_login_consent(c, "onboard_bmi@test.com")
            r = await c.post("/api/v1/onboarding/survey", json=_make_survey(), headers=h)

        bmi = r.json()["bmi"]
        expected = 80.0 / (1.75 ** 2)
        assert abs(bmi - expected) < 0.5
