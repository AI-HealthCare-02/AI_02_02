import asyncio
from contextlib import asynccontextmanager

import backend.services.auth as auth_module
from backend.core import config
from backend.models.users import Gender, User
from backend.services.auth import AuthService
from backend.services.social_auth import SocialAuthService


class TestSocialAuthService:
    def test_build_kakao_authorize_url(self, monkeypatch):
        monkeypatch.setattr(config, "KAKAO_REST_API_KEY", "test-rest-key")
        monkeypatch.setattr(config, "KAKAO_REDIRECT_URI", "http://localhost:8000/api/v1/auth/social/kakao/callback")

        service = SocialAuthService()
        url = service.build_kakao_authorize_url(state="state-token")

        assert "client_id=test-rest-key" in url
        assert "redirect_uri=http%3A%2F%2Flocalhost%3A8000%2Fapi%2Fv1%2Fauth%2Fsocial%2Fkakao%2Fcallback" in url
        assert "state=state-token" in url
        assert "scope=" not in url

    def test_pending_signup_token_roundtrip(self, monkeypatch):
        monkeypatch.setattr(config, "SECRET_KEY", "unit-test-secret")
        monkeypatch.setattr(config, "JWT_ALGORITHM", "HS256")
        monkeypatch.setattr(config, "SOCIAL_PENDING_TOKEN_EXPIRE_MINUTES", 30)

        service = SocialAuthService()
        token = service.issue_pending_signup_token(
            {
                "provider": "kakao",
                "provider_user_id": "123456789",
                "nickname": "홍길동",
                "picture": "https://example.com/profile.jpg",
                "email": "user@example.com",
            }
        )

        payload = service.decode_pending_signup_token(token)

        assert payload["provider"] == "kakao"
        assert payload["provider_user_id"] == "123456789"
        assert payload["nickname"] == "홍길동"
        assert payload["email"] == "user@example.com"

    def test_get_or_create_social_user_creates_new_user(self, monkeypatch):
        service = AuthService()

        @asynccontextmanager
        async def noop_transaction():
            yield

        async def fake_get_user_by_provider(provider, provider_user_id):
            return None

        async def fake_get_user_by_email(email):
            return None

        created = {}

        async def fake_create_user(**kwargs):
            created.update(kwargs)
            return User(
                id=1,
                provider=kwargs["provider"],
                provider_user_id=kwargs["provider_user_id"],
                email=kwargs["email"],
                hashed_password=kwargs["hashed_password"],
                name=kwargs["name"],
                gender=kwargs["gender"],
                birthday=kwargs["birthday"],
                phone_number=kwargs["phone_number"],
                is_active=True,
                is_admin=False,
            )

        monkeypatch.setattr(service.user_repo, "get_user_by_provider", fake_get_user_by_provider)
        monkeypatch.setattr(service.user_repo, "get_user_by_email", fake_get_user_by_email)
        monkeypatch.setattr(service.user_repo, "create_user", fake_create_user)
        monkeypatch.setattr(auth_module, "in_transaction", noop_transaction)

        user = asyncio.run(
            service.get_or_create_social_user(
                provider="kakao",
                provider_user_id="provider-id",
                email=None,
                name="Kakao User",
            )
        )

        assert user.provider == "kakao"
        assert created["provider_user_id"] == "provider-id"
        assert created["hashed_password"] is None
        assert created["name"] == "Kakao User"

    def test_get_or_create_social_user_links_existing_email_user(self, monkeypatch):
        service = AuthService()

        @asynccontextmanager
        async def noop_transaction():
            yield

        existing_user = User(
            id=2,
            provider=None,
            provider_user_id=None,
            email="user@example.com",
            hashed_password="hashed",
            name="Existing",
            gender=Gender.FEMALE,
            birthday=None,
            phone_number=None,
            is_active=True,
            is_admin=False,
        )

        async def fake_get_user_by_provider(provider, provider_user_id):
            return None

        async def fake_get_user_by_email(email):
            return existing_user if email == "user@example.com" else None

        async def fake_update_instance(user, data):
            for key, value in data.items():
                setattr(user, key, value)

        monkeypatch.setattr(service.user_repo, "get_user_by_provider", fake_get_user_by_provider)
        monkeypatch.setattr(service.user_repo, "get_user_by_email", fake_get_user_by_email)
        monkeypatch.setattr(service.user_repo, "update_instance", fake_update_instance)
        monkeypatch.setattr(auth_module, "in_transaction", noop_transaction)

        user = asyncio.run(
            service.get_or_create_social_user(
                provider="kakao",
                provider_user_id="provider-id",
                email="user@example.com",
                name="Kakao User",
            )
        )

        assert user.id == 2
        assert user.provider == "kakao"
        assert user.provider_user_id == "provider-id"
