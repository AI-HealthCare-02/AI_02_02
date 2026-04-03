"""slowapi 기반 Rate Limiting — Redis 백엔드.

엔드포인트별 제한:
- signup: 3/min, login: 5/min
- chat: 20/min, health: 10/min, measurements: 5/min
"""

from __future__ import annotations

from fastapi import FastAPI
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import Config

_config = Config()

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=f"redis://{_config.REDIS_HOST}:{_config.REDIS_PORT}/{_config.REDIS_DB}",
    default_limits=["60/minute"],
)


def setup_rate_limit(app: FastAPI) -> None:
    """SlowAPI 미들웨어를 FastAPI 앱에 등록한다."""
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
