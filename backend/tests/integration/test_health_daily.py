"""건강 데이터 직접입력 API 테스트.

PATCH /health/daily/{log_date} 엔드포인트:
- 날짜 검증 (미래, 4일전 → 422)
- First Answer Wins
- 제약조건 (exercise_done=false → type/minutes null)
"""

from datetime import date, timedelta

from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from backend.main import app

PASSWORD = "Test1234!@"


class TestHealthDaily(TestCase):
    """건강 데이터 CRUD 테스트."""

    async def _signup_and_login(self, client: AsyncClient, email: str) -> dict:
        """회원가입 + 로그인 → 인증 헤더 반환."""
        await client.post("/api/v1/auth/signup", json={
            "email": email, "password": PASSWORD, "name": "테스트",
            "gender": "MALE", "birth_date": "1990-01-01",
            "phone_number": f"010-1234-{hash(email) % 10000:04d}",
        })
        r = await client.post("/api/v1/auth/login", json={
            "email": email, "password": PASSWORD,
        })
        token = r.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_patch_today_success(self):
        """오늘 날짜 건강 기록 저장 → 200."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            h = await self._signup_and_login(c, "health_today@test.com")
            today = date.today().isoformat()
            r = await c.patch(f"/api/v1/health/daily/{today}", json={
                "source": "direct",
                "sleep_quality": "good",
            }, headers=h)
        assert r.status_code == status.HTTP_200_OK
        assert r.json()["field_results"]["sleep_quality"] == "accepted"

    async def test_patch_future_date_422(self):
        """미래 날짜 → 422."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            h = await self._signup_and_login(c, "health_future@test.com")
            tomorrow = (date.today() + timedelta(days=1)).isoformat()
            r = await c.patch(f"/api/v1/health/daily/{tomorrow}", json={
                "source": "direct",
                "sleep_quality": "good",
            }, headers=h)
        assert r.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_patch_3days_ago_success(self):
        """3일전 → 200 성공."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            h = await self._signup_and_login(c, "health_3days@test.com")
            three_days_ago = (date.today() - timedelta(days=3)).isoformat()
            r = await c.patch(f"/api/v1/health/daily/{three_days_ago}", json={
                "source": "direct",
                "sleep_quality": "good",
            }, headers=h)
        assert r.status_code == status.HTTP_200_OK

    async def test_patch_4days_ago_422(self):
        """4일전 → 422 에러."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            h = await self._signup_and_login(c, "health_4days@test.com")
            four_days_ago = (date.today() - timedelta(days=4)).isoformat()
            r = await c.patch(f"/api/v1/health/daily/{four_days_ago}", json={
                "source": "direct",
                "sleep_quality": "good",
            }, headers=h)
        assert r.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_first_answer_wins(self):
        """동일 필드 2번 입력 → 두 번째는 skipped."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            h = await self._signup_and_login(c, "health_faw@test.com")
            today = date.today().isoformat()

            # 1차 입력
            await c.patch(f"/api/v1/health/daily/{today}", json={
                "source": "direct",
                "sleep_quality": "good",
            }, headers=h)

            # 2차 입력 (동일 필드)
            r = await c.patch(f"/api/v1/health/daily/{today}", json={
                "source": "direct",
                "sleep_quality": "bad",
            }, headers=h)

        assert r.status_code == status.HTTP_200_OK
        assert r.json()["field_results"]["sleep_quality"] == "skipped(already_answered)"

    async def test_exercise_false_nullifies_type_minutes(self):
        """exercise_done=false → exercise_type, exercise_minutes 저장 안 됨."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            h = await self._signup_and_login(c, "health_exer@test.com")
            today = date.today().isoformat()
            r = await c.patch(f"/api/v1/health/daily/{today}", json={
                "source": "direct",
                "exercise_done": False,
                "exercise_type": "walking",
                "exercise_minutes": 30,
            }, headers=h)

        assert r.status_code == status.HTTP_200_OK
        results = r.json()["field_results"]
        assert "exercise_done" in results
        # exercise_type, exercise_minutes는 제약조건에 의해 무시됨
        assert "exercise_type" not in results
        assert "exercise_minutes" not in results
