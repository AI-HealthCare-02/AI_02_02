from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.users import User
from app.repositories.user_repository import UserRepository
from app.services.jwt import JwtService

security = HTTPBearer()


def get_request_token_payload(credential: Annotated[HTTPAuthorizationCredentials, Depends(security)]) -> dict[str, Any]:
    token = credential.credentials
    verified = JwtService().verify_jwt(token=token, token_type="access")
    return verified.payload


async def get_request_user(payload: Annotated[dict[str, Any], Depends(get_request_token_payload)]) -> User:
    user_id = payload["user_id"]
    user = await UserRepository().get_user(user_id)
    if not user:
        raise HTTPException(detail="Authenticate Failed.", status_code=status.HTTP_401_UNAUTHORIZED)
    return user
