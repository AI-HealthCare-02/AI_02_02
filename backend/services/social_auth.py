from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import HTTPException, status

from backend.core import config


class SocialAuthService:
    KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize"
    KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
    KAKAO_USER_INFO_URL = "https://kapi.kakao.com/v2/user/me"
    NAVER_AUTHORIZE_URL = "https://nid.naver.com/oauth2.0/authorize"
    NAVER_TOKEN_URL = "https://nid.naver.com/oauth2.0/token"
    NAVER_USER_INFO_URL = "https://openapi.naver.com/v1/nid/me"
    GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
    GOOGLE_USER_INFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

    def build_kakao_authorize_url(self, state: str) -> str:
        params = {
            "client_id": config.KAKAO_REST_API_KEY,
            "redirect_uri": config.KAKAO_REDIRECT_URI,
            "response_type": "code",
            "state": state,
        }
        return f"{self.KAKAO_AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_kakao_code(self, code: str) -> str:
        payload = {
            "grant_type": "authorization_code",
            "client_id": config.KAKAO_REST_API_KEY,
            "redirect_uri": config.KAKAO_REDIRECT_URI,
            "code": code,
        }
        if config.KAKAO_CLIENT_SECRET:
            payload["client_secret"] = config.KAKAO_CLIENT_SECRET

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(self.KAKAO_TOKEN_URL, data=payload)

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kakao token exchange failed: {response.text}",
            )

        data = response.json()
        access_token = data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kakao access token is missing.")
        return access_token

    async def fetch_kakao_profile(self, access_token: str) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(self.KAKAO_USER_INFO_URL, headers=headers)

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Kakao profile lookup failed: {response.text}",
            )

        data = response.json()
        kakao_account = data.get("kakao_account") or {}
        profile = kakao_account.get("profile") or {}
        properties = data.get("properties") or {}
        provider_user_id = str(data.get("id") or "")
        if not provider_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kakao provider user id is missing.")

        return {
            "provider": "kakao",
            "provider_user_id": provider_user_id,
            "nickname": profile.get("nickname") or properties.get("nickname") or "",
            "picture": profile.get("thumbnail_image_url") or properties.get("profile_image") or "",
            "email": kakao_account.get("email") or "",
        }

    def issue_pending_signup_token(self, profile: dict[str, Any]) -> str:
        now = datetime.now(tz=config.TIMEZONE)
        payload = {
            "iss": "danaa-social-auth",
            "sub": profile.get("provider_user_id", ""),
            "provider": profile.get("provider", "kakao"),
            "provider_user_id": profile.get("provider_user_id", ""),
            "nickname": profile.get("nickname", ""),
            "picture": profile.get("picture", ""),
            "email": profile.get("email", ""),
            "iat": now,
            "exp": now + timedelta(minutes=config.SOCIAL_PENDING_TOKEN_EXPIRE_MINUTES),
        }
        return jwt.encode(payload, config.SECRET_KEY, algorithm=config.JWT_ALGORITHM)

    def decode_pending_signup_token(self, token: str) -> dict[str, Any]:
        try:
            payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.JWT_ALGORITHM])
        except jwt.PyJWTError as err:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid social signup token.") from err
        return payload

    def build_naver_authorize_url(self, state: str) -> str:
        params = {
            "response_type": "code",
            "client_id": config.NAVER_CLIENT_ID,
            "redirect_uri": config.NAVER_REDIRECT_URI,
            "state": state,
        }
        return f"{self.NAVER_AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_naver_code(self, code: str, state: str) -> str:
        payload = {
            "grant_type": "authorization_code",
            "client_id": config.NAVER_CLIENT_ID,
            "client_secret": config.NAVER_CLIENT_SECRET,
            "code": code,
            "state": state,
            "redirect_uri": config.NAVER_REDIRECT_URI,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(self.NAVER_TOKEN_URL, data=payload)

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Naver token exchange failed: {response.text}",
            )

        data = response.json()
        access_token = data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Naver access token is missing.")
        return access_token

    async def fetch_naver_profile(self, access_token: str) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(self.NAVER_USER_INFO_URL, headers=headers)

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Naver profile lookup failed: {response.text}",
            )

        data = response.json()
        profile = data.get("response") or {}
        provider_user_id = str(profile.get("id") or "")
        if not provider_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Naver provider user id is missing.")

        return {
            "provider": "naver",
            "provider_user_id": provider_user_id,
            "nickname": profile.get("nickname") or "",
            "picture": profile.get("profile_image") or "",
            "email": profile.get("email") or "",
        }

    def build_google_authorize_url(self, state: str) -> str:
        params = {
            "client_id": config.GOOGLE_CLIENT_ID,
            "redirect_uri": config.GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        return f"{self.GOOGLE_AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_google_code(self, code: str) -> str:
        payload = {
            "grant_type": "authorization_code",
            "client_id": config.GOOGLE_CLIENT_ID,
            "client_secret": config.GOOGLE_CLIENT_SECRET,
            "code": code,
            "redirect_uri": config.GOOGLE_REDIRECT_URI,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(self.GOOGLE_TOKEN_URL, data=payload)

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Google token exchange failed: {response.text}",
            )

        data = response.json()
        access_token = data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google access token is missing.")
        return access_token

    async def fetch_google_profile(self, access_token: str) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(self.GOOGLE_USER_INFO_URL, headers=headers)

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Google profile lookup failed: {response.text}",
            )

        data = response.json()
        provider_user_id = str(data.get("sub") or "")
        if not provider_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google provider user id is missing.")

        return {
            "provider": "google",
            "provider_user_id": provider_user_id,
            "nickname": data.get("name") or data.get("given_name") or "",
            "picture": data.get("picture") or "",
            "email": data.get("email") or "",
        }
