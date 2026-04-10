import secrets
from typing import Annotated
from urllib.parse import urlencode

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse as Response
from fastapi.responses import RedirectResponse

from backend.core import config
from backend.core.config import Env
from backend.dependencies.security import get_request_user
from backend.dtos.auth import (
    EmailLinkConfirmResponse,
    EmailLinkConfirmRequest,
    EmailLinkPreviewListResponse,
    EmailLinkVerificationRequest,
    EmailLinkVerificationResponse,
    EmailSignupConfirmRequest,
    EmailSignupVerificationRequest,
    EmailSignupVerificationResponse,
    LoginRequest,
    LoginResponse,
    SignUpRequest,
    TokenRefreshResponse,
)
from backend.dtos.onboarding import ConsentRequest, ConsentUpdateRequest
from backend.dtos.users import UserInfoResponse
from backend.middleware.rate_limit import limiter
from backend.models.users import User
from backend.services.auth import AuthService
from backend.services.jwt import JwtService
from backend.services.onboarding import OnboardingService
from backend.services.social_auth import SocialAuthService

auth_router = APIRouter(prefix="/auth", tags=["auth"])

KAKAO_OAUTH_STATE_COOKIE = "kakao_oauth_state"
NAVER_OAUTH_STATE_COOKIE = "naver_oauth_state"
GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state"

@auth_router.post("/signup", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def signup(
    request: Request,
    body: SignUpRequest,
    auth_service: Annotated[AuthService, Depends(AuthService)],
) -> Response:
    await auth_service.signup(body)
    return Response(content={"detail": "Signup completed successfully."}, status_code=status.HTTP_201_CREATED)


@auth_router.post("/email/signup/request", response_model=EmailSignupVerificationResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def email_signup_request(
    request: Request,
    body: EmailSignupVerificationRequest,
    auth_service: Annotated[AuthService, Depends(AuthService)],
) -> Response:
    result = await auth_service.request_email_signup_verification(body)
    return Response(content=result, status_code=status.HTTP_201_CREATED)


@auth_router.post("/email-verify/send", response_model=EmailSignupVerificationResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def email_signup_request_legacy(
    request: Request,
    body: EmailSignupVerificationRequest,
    auth_service: Annotated[AuthService, Depends(AuthService)],
) -> Response:
    return await email_signup_request(request=request, body=body, auth_service=auth_service)


@auth_router.post("/email/signup/confirm", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def email_signup_confirm(
    request: Request,
    body: EmailSignupConfirmRequest,
    auth_service: Annotated[AuthService, Depends(AuthService)],
) -> Response:
    await auth_service.confirm_email_signup_verification(body)
    return Response(content={"detail": "Email verified and account created."}, status_code=status.HTTP_201_CREATED)


@auth_router.post("/email-verify/confirm", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def email_signup_confirm_legacy(
    request: Request,
    body: EmailSignupConfirmRequest,
    auth_service: Annotated[AuthService, Depends(AuthService)],
) -> Response:
    return await email_signup_confirm(request=request, body=body, auth_service=auth_service)


@auth_router.post("/email/link/request", response_model=EmailLinkVerificationResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def email_link_request(
    request: Request,
    body: EmailLinkVerificationRequest,
    user: Annotated[User, Depends(get_request_user)],
    auth_service: Annotated[AuthService, Depends(AuthService)],
) -> Response:
    if body.keep_user_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected account is missing.")
    result = await auth_service.request_email_link_verification(
        user=user,
        email=str(body.email),
        keep_user_id=body.keep_user_id,
    )
    return Response(content=result, status_code=status.HTTP_201_CREATED)


@auth_router.post("/email/link/preview", response_model=EmailLinkPreviewListResponse, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def email_link_preview(
    request: Request,
    body: EmailLinkVerificationRequest,
    user: Annotated[User, Depends(get_request_user)],
    auth_service: Annotated[AuthService, Depends(AuthService)],
) -> Response:
    result = await auth_service.preview_email_link(user=user, email=str(body.email))
    return Response(
        content=EmailLinkPreviewListResponse.model_validate(result).model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )


@auth_router.post("/email/link/confirm", response_model=EmailLinkConfirmResponse, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def email_link_confirm(
    request: Request,
    body: EmailLinkConfirmRequest,
    user: Annotated[User, Depends(get_request_user)],
    auth_service: Annotated[AuthService, Depends(AuthService)],
) -> Response:
    updated_user, tokens = await auth_service.confirm_email_link_verification(
        user=user,
        email=str(body.email),
        code=body.code,
        link_token=body.link_token,
        keep_user_id=body.keep_user_id,
    )
    response = Response(
        content=EmailLinkConfirmResponse(
            detail="Email link completed.",
            access_token=tokens["access_token"],
            user=UserInfoResponse.model_validate(updated_user),
        ).model_dump(mode="json"),
        status_code=status.HTTP_200_OK,
    )
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=True if config.ENV == Env.PROD else False,
        samesite="Lax",
        domain=config.COOKIE_DOMAIN or None,
    )
    return response


@auth_router.get("/social/kakao/start")
@auth_router.get("/kakao/start")
async def kakao_start(
    social_auth_service: Annotated[SocialAuthService, Depends(SocialAuthService)],
) -> RedirectResponse:
    state = secrets.token_urlsafe(24)
    redirect_url = social_auth_service.build_kakao_authorize_url(state=state)
    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key=KAKAO_OAUTH_STATE_COOKIE,
        value=state,
        httponly=True,
        secure=True if config.ENV == Env.PROD else False,
        samesite="lax",
        domain=config.COOKIE_DOMAIN or None,
        max_age=300,
    )
    return response


@auth_router.get("/social/callback/kakao")
@auth_router.get("/social/kakao/callback")
async def kakao_callback(
    request: Request,
    auth_service: Annotated[AuthService, Depends(AuthService)],
    social_auth_service: Annotated[SocialAuthService, Depends(SocialAuthService)],
    onboarding_service: Annotated[OnboardingService, Depends(OnboardingService)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
) -> RedirectResponse:
    frontend_base = config.FRONTEND_BASE_URL.rstrip("/")
    if error:
        query = urlencode({"social_error": error_description or error})
        return RedirectResponse(url=f"{frontend_base}/login?{query}", status_code=status.HTTP_302_FOUND)

    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Authorization code is missing.")

    expected_state = request.cookies.get(KAKAO_OAUTH_STATE_COOKIE)
    if not expected_state or not state or state != expected_state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Kakao state.")

    access_token = await social_auth_service.exchange_kakao_code(code=code)
    profile = await social_auth_service.fetch_kakao_profile(access_token=access_token)
    user = await auth_service.get_or_create_social_user(
        provider="kakao",
        provider_user_id=profile["provider_user_id"],
        email=profile.get("email") or None,
        name=profile.get("nickname") or None,
    )
    tokens = await auth_service.login(user)
    onboarding_status = await onboarding_service.get_status(user.id)
    next_path = "/app/chat" if onboarding_status.is_completed else "/onboarding/diabetes"
    query = urlencode(
        {
            "access_token": str(tokens["access_token"]),
            "next": next_path,
        }
    )
    response = RedirectResponse(url=f"{frontend_base}/social-auth?{query}", status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key="refresh_token",
        value=str(tokens["refresh_token"]),
        httponly=True,
        secure=True if config.ENV == Env.PROD else False,
        samesite="Lax",
        domain=config.COOKIE_DOMAIN or None,
        expires=tokens["refresh_token"].payload["exp"],
    )
    response.delete_cookie(KAKAO_OAUTH_STATE_COOKIE, domain=config.COOKIE_DOMAIN or None)
    return response


@auth_router.get("/social/naver/start")
@auth_router.get("/naver/start")
async def naver_start(
    social_auth_service: Annotated[SocialAuthService, Depends(SocialAuthService)],
) -> RedirectResponse:
    state = secrets.token_urlsafe(24)
    redirect_url = social_auth_service.build_naver_authorize_url(state=state)
    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key=NAVER_OAUTH_STATE_COOKIE,
        value=state,
        httponly=True,
        secure=True if config.ENV == Env.PROD else False,
        samesite="lax",
        domain=config.COOKIE_DOMAIN or None,
        max_age=300,
    )
    return response


@auth_router.get("/social/callback/naver")
@auth_router.get("/social/naver/callback")
async def naver_callback(
    request: Request,
    auth_service: Annotated[AuthService, Depends(AuthService)],
    social_auth_service: Annotated[SocialAuthService, Depends(SocialAuthService)],
    onboarding_service: Annotated[OnboardingService, Depends(OnboardingService)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
) -> RedirectResponse:
    frontend_base = config.FRONTEND_BASE_URL.rstrip("/")
    if error:
        query = urlencode({"social_error": error_description or error})
        return RedirectResponse(url=f"{frontend_base}/login?{query}", status_code=status.HTTP_302_FOUND)

    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Authorization code is missing.")

    expected_state = request.cookies.get(NAVER_OAUTH_STATE_COOKIE)
    if not expected_state or not state or state != expected_state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Naver state.")

    access_token = await social_auth_service.exchange_naver_code(code=code, state=state)
    profile = await social_auth_service.fetch_naver_profile(access_token=access_token)
    user = await auth_service.get_or_create_social_user(
        provider="naver",
        provider_user_id=profile["provider_user_id"],
        email=profile.get("email") or None,
        name=profile.get("nickname") or None,
    )
    tokens = await auth_service.login(user)
    onboarding_status = await onboarding_service.get_status(user.id)
    next_path = "/app/chat" if onboarding_status.is_completed else "/onboarding/diabetes"
    query = urlencode(
        {
            "access_token": str(tokens["access_token"]),
            "next": next_path,
        }
    )
    response = RedirectResponse(url=f"{frontend_base}/social-auth?{query}", status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key="refresh_token",
        value=str(tokens["refresh_token"]),
        httponly=True,
        secure=True if config.ENV == Env.PROD else False,
        samesite="Lax",
        domain=config.COOKIE_DOMAIN or None,
        expires=tokens["refresh_token"].payload["exp"],
    )
    response.delete_cookie(NAVER_OAUTH_STATE_COOKIE, domain=config.COOKIE_DOMAIN or None)
    return response


@auth_router.get("/social/google/start")
@auth_router.get("/google/start")
async def google_start(
    social_auth_service: Annotated[SocialAuthService, Depends(SocialAuthService)],
) -> RedirectResponse:
    state = secrets.token_urlsafe(24)
    redirect_url = social_auth_service.build_google_authorize_url(state=state)
    response = RedirectResponse(url=redirect_url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key=GOOGLE_OAUTH_STATE_COOKIE,
        value=state,
        httponly=True,
        secure=True if config.ENV == Env.PROD else False,
        samesite="lax",
        domain=config.COOKIE_DOMAIN or None,
        max_age=300,
    )
    return response


@auth_router.get("/social/callback/google")
@auth_router.get("/social/google/callback")
async def google_callback(
    request: Request,
    auth_service: Annotated[AuthService, Depends(AuthService)],
    social_auth_service: Annotated[SocialAuthService, Depends(SocialAuthService)],
    onboarding_service: Annotated[OnboardingService, Depends(OnboardingService)],
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
) -> RedirectResponse:
    frontend_base = config.FRONTEND_BASE_URL.rstrip("/")
    if error:
        query = urlencode({"social_error": error_description or error})
        return RedirectResponse(url=f"{frontend_base}/login?{query}", status_code=status.HTTP_302_FOUND)

    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Authorization code is missing.")

    expected_state = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)
    if not expected_state or not state or state != expected_state:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Google state.")

    access_token = await social_auth_service.exchange_google_code(code=code)
    profile = await social_auth_service.fetch_google_profile(access_token=access_token)
    user = await auth_service.get_or_create_social_user(
        provider="google",
        provider_user_id=profile["provider_user_id"],
        email=profile.get("email") or None,
        name=profile.get("nickname") or None,
    )
    tokens = await auth_service.login(user)
    onboarding_status = await onboarding_service.get_status(user.id)
    next_path = "/app/chat" if onboarding_status.is_completed else "/onboarding/diabetes"
    query = urlencode(
        {
            "access_token": str(tokens["access_token"]),
            "next": next_path,
        }
    )
    response = RedirectResponse(url=f"{frontend_base}/social-auth?{query}", status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key="refresh_token",
        value=str(tokens["refresh_token"]),
        httponly=True,
        secure=True if config.ENV == Env.PROD else False,
        samesite="Lax",
        domain=config.COOKIE_DOMAIN or None,
        expires=tokens["refresh_token"].payload["exp"],
    )
    response.delete_cookie(GOOGLE_OAUTH_STATE_COOKIE, domain=config.COOKIE_DOMAIN or None)
    return response


@auth_router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def login(
    request: Request,
    body: LoginRequest,
    auth_service: Annotated[AuthService, Depends(AuthService)],
) -> Response:
    user = await auth_service.authenticate(body)
    tokens = await auth_service.login(user)
    resp = Response(
        content=LoginResponse(access_token=str(tokens["access_token"])).model_dump(), status_code=status.HTTP_200_OK
    )
    resp.set_cookie(
        key="refresh_token",
        value=str(tokens["refresh_token"]),
        httponly=True,
        secure=True if config.ENV == Env.PROD else False,
        samesite="Lax",
        domain=config.COOKIE_DOMAIN or None,
        expires=tokens["refresh_token"].payload["exp"],
    )
    return resp


@auth_router.get("/token/refresh", response_model=TokenRefreshResponse, status_code=status.HTTP_200_OK)
async def token_refresh(
    jwt_service: Annotated[JwtService, Depends(JwtService)],
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> Response:
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token is missing.")
    access_token = jwt_service.refresh_jwt(refresh_token)
    return Response(
        content=TokenRefreshResponse(access_token=str(access_token)).model_dump(), status_code=status.HTTP_200_OK
    )


@auth_router.post("/consent", status_code=status.HTTP_201_CREATED)
async def save_consent(
    request: ConsentRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[OnboardingService, Depends(OnboardingService)],
) -> Response:
    result = await service.save_consent(user_id=user.id, data=request)
    return Response(content=result.model_dump(mode="json"), status_code=status.HTTP_201_CREATED)


@auth_router.patch("/consent", status_code=status.HTTP_200_OK)
async def update_consent(
    request: ConsentUpdateRequest,
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[OnboardingService, Depends(OnboardingService)],
) -> Response:
    result = await service.update_consent(user_id=user.id, data=request)
    return Response(content=result.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@auth_router.get("/consent", status_code=status.HTTP_200_OK)
async def get_consent(
    user: Annotated[User, Depends(get_request_user)],
    service: Annotated[OnboardingService, Depends(OnboardingService)],
) -> Response:
    result = await service.get_consent(user_id=user.id)
    return Response(content=result.model_dump(mode="json"), status_code=status.HTTP_200_OK)
