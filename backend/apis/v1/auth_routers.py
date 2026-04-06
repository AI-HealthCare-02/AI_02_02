from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse as Response

from backend.core import config
from backend.core.config import Env
from backend.dependencies.security import get_request_user
from backend.dtos.auth import LoginRequest, LoginResponse, SignUpRequest, TokenRefreshResponse
from backend.dtos.onboarding import ConsentRequest
from backend.middleware.rate_limit import limiter
from backend.models.users import User
from backend.services.auth import AuthService
from backend.services.jwt import JwtService
from backend.services.onboarding import OnboardingService

auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/signup", status_code=status.HTTP_201_CREATED)
@limiter.limit("3/minute")
async def signup(
    request: Request,
    body: SignUpRequest,
    auth_service: Annotated[AuthService, Depends(AuthService)],
) -> Response:
    await auth_service.signup(body)
    return Response(content={"detail": "회원가입이 성공적으로 완료되었습니다."}, status_code=status.HTTP_201_CREATED)


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
    """이용약관 동의 저장."""
    result = await service.save_consent(user_id=user.id, data=request)
    return Response(
        content=result.model_dump(mode="json"),
        status_code=status.HTTP_201_CREATED,
    )
