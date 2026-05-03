"""Do it OS API 통합 테스트."""

from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from backend.main import app

SIGNUP = {
    "email": "doit_test@example.com",
    "password": "Password123!",
    "name": "두잇테스터",
    "gender": "FEMALE",
    "birth_date": "1995-05-05",
    "phone_number": "01055556666",
}

SIGNUP_B = {
    "email": "doit_other@example.com",
    "password": "Password123!",
    "name": "타사용자",
    "gender": "MALE",
    "birth_date": "1990-01-01",
    "phone_number": "01077778888",
}

THOUGHT = {
    "id": "t-1000000000000-1234",
    "text": "병원 예약하기",
    "category": "todo",
    "created_at": "2026-05-03T10:00:00+00:00",
}


async def _signup_and_login(client: AsyncClient, data: dict) -> str:
    await client.post("/api/v1/auth/signup", json=data)
    r = await client.post("/api/v1/auth/login", json={"email": data["email"], "password": data["password"]})
    return r.json()["access_token"]


class TestDoitCRUD(TestCase):

    async def test_create_and_list(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await _signup_and_login(client, SIGNUP)
            headers = {"Authorization": f"Bearer {token}"}

            r = await client.post("/api/v1/doit/thoughts", json=THOUGHT, headers=headers)
            assert r.status_code == status.HTTP_201_CREATED
            data = r.json()
            assert data["id"] == THOUGHT["id"]
            assert data["text"] == THOUGHT["text"]
            assert data["category"] == "todo"

            r = await client.get("/api/v1/doit/thoughts", headers=headers)
            assert r.status_code == status.HTTP_200_OK
            assert len(r.json()) == 1

    async def test_category_filter(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await _signup_and_login(client, SIGNUP)
            headers = {"Authorization": f"Bearer {token}"}

            await client.post("/api/v1/doit/thoughts", json=THOUGHT, headers=headers)
            note = {**THOUGHT, "id": "t-1000000000001-1234", "category": "note", "text": "회의록"}
            await client.post("/api/v1/doit/thoughts", json=note, headers=headers)

            r = await client.get("/api/v1/doit/thoughts?category=todo", headers=headers)
            assert r.status_code == status.HTTP_200_OK
            assert all(t["category"] == "todo" for t in r.json())

            r = await client.get("/api/v1/doit/thoughts?category=note", headers=headers)
            assert len(r.json()) == 1
            assert r.json()[0]["text"] == "회의록"

    async def test_update(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await _signup_and_login(client, SIGNUP)
            headers = {"Authorization": f"Bearer {token}"}

            await client.post("/api/v1/doit/thoughts", json=THOUGHT, headers=headers)
            r = await client.put(
                f"/api/v1/doit/thoughts/{THOUGHT['id']}",
                json={"text": "수정된 내용", "category": "schedule"},
                headers=headers,
            )
            assert r.status_code == status.HTTP_200_OK
            assert r.json()["text"] == "수정된 내용"
            assert r.json()["category"] == "schedule"

    async def test_delete(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await _signup_and_login(client, SIGNUP)
            headers = {"Authorization": f"Bearer {token}"}

            await client.post("/api/v1/doit/thoughts", json=THOUGHT, headers=headers)
            r = await client.delete(f"/api/v1/doit/thoughts/{THOUGHT['id']}", headers=headers)
            assert r.status_code == status.HTTP_204_NO_CONTENT

            r = await client.get("/api/v1/doit/thoughts", headers=headers)
            assert len(r.json()) == 0

    async def test_unauthenticated_returns_401(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.get("/api/v1/doit/thoughts")
            assert r.status_code == status.HTTP_401_UNAUTHORIZED


class TestDoitPermission(TestCase):
    """다른 사용자 데이터 접근 방지."""

    async def test_cannot_update_others_thought(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token_a = await _signup_and_login(client, SIGNUP)
            token_b = await _signup_and_login(client, SIGNUP_B)

            await client.post(
                "/api/v1/doit/thoughts",
                json=THOUGHT,
                headers={"Authorization": f"Bearer {token_a}"},
            )
            r = await client.put(
                f"/api/v1/doit/thoughts/{THOUGHT['id']}",
                json={"text": "악의적 수정"},
                headers={"Authorization": f"Bearer {token_b}"},
            )
            assert r.status_code == status.HTTP_403_FORBIDDEN

    async def test_cannot_delete_others_thought(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token_a = await _signup_and_login(client, SIGNUP)
            token_b = await _signup_and_login(client, SIGNUP_B)

            await client.post(
                "/api/v1/doit/thoughts",
                json=THOUGHT,
                headers={"Authorization": f"Bearer {token_a}"},
            )
            r = await client.delete(
                f"/api/v1/doit/thoughts/{THOUGHT['id']}",
                headers={"Authorization": f"Bearer {token_b}"},
            )
            assert r.status_code == status.HTTP_403_FORBIDDEN

    async def test_list_only_returns_own_thoughts(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token_a = await _signup_and_login(client, SIGNUP)
            token_b = await _signup_and_login(client, SIGNUP_B)

            await client.post(
                "/api/v1/doit/thoughts",
                json=THOUGHT,
                headers={"Authorization": f"Bearer {token_a}"},
            )
            r = await client.get(
                "/api/v1/doit/thoughts",
                headers={"Authorization": f"Bearer {token_b}"},
            )
            assert r.status_code == status.HTTP_200_OK
            assert len(r.json()) == 0


class TestDoitBulkSync(TestCase):

    async def test_bulk_sync_inserts_all(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await _signup_and_login(client, SIGNUP)
            headers = {"Authorization": f"Bearer {token}"}

            thoughts = [
                {**THOUGHT, "id": f"t-100000000000{i}-1234", "text": f"생각 {i}"}
                for i in range(5)
            ]
            r = await client.post(
                "/api/v1/doit/thoughts/bulk-sync",
                json={"thoughts": thoughts},
                headers=headers,
            )
            assert r.status_code == status.HTTP_200_OK
            result = r.json()
            assert result["synced"] == 5
            assert result["skipped"] == 0

    async def test_bulk_sync_skips_older_existing(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await _signup_and_login(client, SIGNUP)
            headers = {"Authorization": f"Bearer {token}"}

            await client.post("/api/v1/doit/thoughts", json=THOUGHT, headers=headers)

            # 동일 ID, 더 오래된 created_at으로 bulk-sync
            old_thought = {**THOUGHT, "created_at": "2020-01-01T00:00:00+00:00"}
            r = await client.post(
                "/api/v1/doit/thoughts/bulk-sync",
                json={"thoughts": [old_thought]},
                headers=headers,
            )
            assert r.status_code == status.HTTP_200_OK
            assert r.json()["skipped"] == 1


class TestDoitAiSummary(TestCase):

    async def test_ai_summary_structure(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = await _signup_and_login(client, SIGNUP)
            headers = {"Authorization": f"Bearer {token}"}

            await client.post("/api/v1/doit/thoughts", json=THOUGHT, headers=headers)
            unclassified = {**THOUGHT, "id": "t-1000000000002-1234", "category": None, "text": "미분류 생각"}
            await client.post("/api/v1/doit/thoughts", json=unclassified, headers=headers)

            r = await client.get("/api/v1/doit/thoughts/ai-summary", headers=headers)
            assert r.status_code == status.HTTP_200_OK
            data = r.json()
            assert "unclassified_count" in data
            assert "today_todos" in data
            assert "active_projects" in data
            assert data["unclassified_count"] == 1
