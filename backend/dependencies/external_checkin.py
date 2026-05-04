from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.models.external_checkin import ExternalClientToken
from backend.services.external_checkin import ExternalCheckinService

external_security = HTTPBearer()


def require_external_scope(scope: str):
    async def _dependency(
        credential: Annotated[HTTPAuthorizationCredentials, Depends(external_security)],
        service: Annotated[ExternalCheckinService, Depends(ExternalCheckinService)],
    ) -> ExternalClientToken:
        return await service.verify_client_token(
            raw_token=credential.credentials,
            required_scope=scope,
        )

    return _dependency
