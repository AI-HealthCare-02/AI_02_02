from httpx import ASGITransport, AsyncClient
from starlette import status
from tortoise.contrib.test import TestCase

from backend.main import app


class TestLoginAPI(TestCase):
    async def test_login_success(self):
        # 먼저 사용자 등록
        signup_data = {
            "email": "login_test@example.com",
            "password": "Password123!",
            "name": "로그인테스터",
            "gender": "FEMALE",
            "birth_date": "1995-05-05",
            "phone_number": "01011112222",
        }
        login_data = {"email": "login_test@example.com", "password": "Password123!"}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/auth/signup", json=signup_data)

            # 로그인 시도
            response = await client.post("/api/v1/auth/login", json=login_data)
        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.json()
        # 쿠키 검증 대신 응답 헤더 확인
        assert any("refresh_token" in header for header in response.headers.get_list("set-cookie"))

    async def test_login_invalid_credentials(self):
        login_data = {"email": "nonexistent@example.com", "password": "WrongPassword123!"}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/auth/login", json=login_data)

        # AuthService.authenticate 에서 실패 시 HTTP_400_BAD_REQUEST 발생
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    async def test_find_email_returns_masked_account(self):
        signup_data = {
            "email": "find_email_test@example.com",
            "password": "Password123!",
            "name": "아이디테스터",
            "gender": "FEMALE",
            "birth_date": "1995-05-05",
            "phone_number": "01022223333",
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/auth/signup", json=signup_data)
            response = await client.post(
                "/api/v1/auth/account/find-email",
                json={"name": "아이디테스터", "birth_date": "1995-05-05"},
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["accounts"]
        assert data["accounts"][0]["masked_email"] == "fi*************@example.com"
        assert data["accounts"][0]["account_type"] == "일반 이메일 계정"

    async def test_password_reset_changes_password(self):
        signup_data = {
            "email": "reset_password_test@example.com",
            "password": "Password123!",
            "name": "비밀번호테스터",
            "gender": "FEMALE",
            "birth_date": "1995-05-05",
            "phone_number": "01033334444",
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            await client.post("/api/v1/auth/signup", json=signup_data)
            request_response = await client.post(
                "/api/v1/auth/password/reset/request",
                json={"email": "reset_password_test@example.com"},
            )
            request_data = request_response.json()

            confirm_response = await client.post(
                "/api/v1/auth/password/reset/confirm",
                json={
                    "email": "reset_password_test@example.com",
                    "code": request_data["dev_verification_code"],
                    "reset_token": request_data["reset_token"],
                    "new_password": "NewPassword123!",
                },
            )
            old_login_response = await client.post(
                "/api/v1/auth/login",
                json={"email": "reset_password_test@example.com", "password": "Password123!"},
            )
            new_login_response = await client.post(
                "/api/v1/auth/login",
                json={"email": "reset_password_test@example.com", "password": "NewPassword123!"},
            )

        assert request_response.status_code == status.HTTP_201_CREATED
        assert request_data["reset_token"]
        assert request_data["dev_verification_code"]
        assert confirm_response.status_code == status.HTTP_200_OK
        assert old_login_response.status_code == status.HTTP_400_BAD_REQUEST
        assert new_login_response.status_code == status.HTTP_200_OK
