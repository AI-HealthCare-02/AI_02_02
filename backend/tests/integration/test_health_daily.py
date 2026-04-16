"""건강 데이터 direct 입력 API 통합 테스트."""

from datetime import datetime, timedelta

from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from backend.core import config
from backend.main import app


def _today():
    """서버와 동일한 KST 기준 오늘 — 컨테이너 date.today()는 UTC라 엇갈림."""
    return datetime.now(tz=config.TIMEZONE).date()

PASSWORD = "Test1234!@"


class TestHealthDaily(TestCase):
    """건강 데이터 CRUD 테스트."""

    async def _signup_and_login(self, client: AsyncClient, email: str) -> dict:
        """회원가입 후 로그인 헤더 반환."""
        await client.post(
            "/api/v1/auth/signup",
            json={
                "email": email,
                "password": PASSWORD,
                "name": "테스트",
                "gender": "MALE",
                "birth_date": "1990-01-01",
                "phone_number": f"010-1234-{hash(email) % 10000:04d}",
            },
        )
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": PASSWORD},
        )
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    async def test_patch_today_success(self):
        """오늘 날짜 건강 기록 저장은 성공해야 한다."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = await self._signup_and_login(client, "health_today@test.com")
            today = _today().isoformat()
            response = await client.patch(
                f"/api/v1/health/daily/{today}",
                json={"source": "direct", "sleep_quality": "good"},
                headers=headers,
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["field_results"]["sleep_quality"] == "accepted"

    async def test_get_today_includes_missing_summary(self):
        """오늘 조회 응답에는 missing/pending/card availability가 같이 내려와야 한다."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = await self._signup_and_login(client, "health_today_summary@test.com")
            today = _today().isoformat()

            await client.patch(
                f"/api/v1/health/daily/{today}",
                json={"source": "direct", "sleep_quality": "good"},
                headers=headers,
            )

            response = await client.get(f"/api/v1/health/daily/{today}", headers=headers)

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["missing_summary"] is not None
        assert isinstance(body["missing_summary"]["count"], int)
        assert isinstance(body["missing_summary"]["labels"], list)
        assert isinstance(body["missing_summary"]["truncated_count"], int)
        assert body["pending_questions"] is not None
        assert isinstance(body["pending_questions"]["count"], int)
        assert isinstance(body["pending_questions"]["bundles"], list)
        assert body["card_availability"] is not None
        assert body["card_availability"]["mode"] == "auto_sequential"

    async def test_get_past_day_does_not_include_missing_summary(self):
        """과거 날짜 조회에는 오늘 전용 필드가 붙지 않아야 한다."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = await self._signup_and_login(client, "health_past_summary@test.com")
            three_days_ago = (_today() - timedelta(days=3)).isoformat()

            await client.patch(
                f"/api/v1/health/daily/{three_days_ago}",
                json={"source": "direct", "sleep_quality": "good"},
                headers=headers,
            )

            response = await client.get(f"/api/v1/health/daily/{three_days_ago}", headers=headers)

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert body["missing_summary"] is None
        assert body["pending_questions"] is None
        assert body["card_availability"] is None

    async def test_patch_future_date_422(self):
        """미래 날짜 입력은 막혀야 한다."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = await self._signup_and_login(client, "health_future@test.com")
            tomorrow = (_today() + timedelta(days=1)).isoformat()
            response = await client.patch(
                f"/api/v1/health/daily/{tomorrow}",
                json={"source": "direct", "sleep_quality": "good"},
                headers=headers,
            )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_patch_3days_ago_success(self):
        """3일 전까지는 backfill direct 입력이 허용돼야 한다."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = await self._signup_and_login(client, "health_3days@test.com")
            three_days_ago = (_today() - timedelta(days=3)).isoformat()
            response = await client.patch(
                f"/api/v1/health/daily/{three_days_ago}",
                json={"source": "direct", "sleep_quality": "good"},
                headers=headers,
            )

        assert response.status_code == status.HTTP_200_OK

    async def test_patch_4days_ago_422(self):
        """4일 전 날짜는 direct 입력이 막혀야 한다."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = await self._signup_and_login(client, "health_4days@test.com")
            four_days_ago = (_today() - timedelta(days=4)).isoformat()
            response = await client.patch(
                f"/api/v1/health/daily/{four_days_ago}",
                json={"source": "direct", "sleep_quality": "good"},
                headers=headers,
            )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_today_direct_patch_allows_same_day_replace(self):
        """오늘 direct 입력은 같은 필드를 다시 바꿔도 최신값이 반영돼야 한다."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = await self._signup_and_login(client, "health_faw@test.com")
            today = _today().isoformat()

            await client.patch(
                f"/api/v1/health/daily/{today}",
                json={"source": "direct", "sleep_quality": "good"},
                headers=headers,
            )

            response = await client.patch(
                f"/api/v1/health/daily/{today}",
                json={"source": "direct", "sleep_quality": "bad"},
                headers=headers,
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["field_results"]["sleep_quality"] == "accepted"
        assert response.json()["daily_log"]["sleep_quality"] == "bad"

    async def test_past_day_direct_patch_keeps_first_answer_wins(self):
        """오늘이 아닌 날짜 direct 입력은 기존 First Answer Wins를 유지해야 한다."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = await self._signup_and_login(client, "health_past_faw@test.com")
            three_days_ago = (_today() - timedelta(days=3)).isoformat()

            await client.patch(
                f"/api/v1/health/daily/{three_days_ago}",
                json={"source": "direct", "sleep_quality": "good"},
                headers=headers,
            )

            response = await client.patch(
                f"/api/v1/health/daily/{three_days_ago}",
                json={"source": "direct", "sleep_quality": "bad"},
                headers=headers,
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["field_results"]["sleep_quality"] == "skipped(already_answered)"

    async def test_exercise_false_nullifies_type_minutes(self):
        """exercise_done=false면 운동 종류/시간은 같이 비워져야 한다."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = await self._signup_and_login(client, "health_exer@test.com")
            today = _today().isoformat()
            response = await client.patch(
                f"/api/v1/health/daily/{today}",
                json={
                    "source": "direct",
                    "exercise_done": False,
                    "exercise_type": "walking",
                    "exercise_minutes": 30,
                },
                headers=headers,
            )

        assert response.status_code == status.HTTP_200_OK
        results = response.json()["field_results"]
        assert "exercise_done" in results
        assert "exercise_type" not in results
        assert "exercise_minutes" not in results

    async def test_today_direct_patch_allows_same_day_replace_for_mood(self):
        """기분 direct 입력은 같은 날 최신값으로 다시 저장돼야 한다."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = await self._signup_and_login(client, "health_mood_replace@test.com")
            today = _today().isoformat()

            await client.patch(
                f"/api/v1/health/daily/{today}",
                json={"source": "direct", "mood_level": "stressed"},
                headers=headers,
            )

            response = await client.patch(
                f"/api/v1/health/daily/{today}",
                json={"source": "direct", "mood_level": "good"},
                headers=headers,
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["field_results"]["mood_level"] == "accepted"
        assert response.json()["daily_log"]["mood_level"] == "good"

    async def test_today_direct_patch_allows_same_day_replace_for_alcohol(self):
        """음주 여부/양 direct 입력은 같은 날 최신값으로 다시 저장돼야 한다."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            headers = await self._signup_and_login(client, "health_alcohol_replace@test.com")
            today = _today().isoformat()

            await client.patch(
                f"/api/v1/health/daily/{today}",
                json={
                    "source": "direct",
                    "alcohol_today": True,
                    "alcohol_amount_level": "light",
                },
                headers=headers,
            )

            response = await client.patch(
                f"/api/v1/health/daily/{today}",
                json={"source": "direct", "alcohol_today": False},
                headers=headers,
            )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["field_results"]["alcohol_today"] == "accepted"
        assert response.json()["daily_log"]["alcohol_today"] is False
        assert response.json()["daily_log"]["alcohol_amount_level"] is None
