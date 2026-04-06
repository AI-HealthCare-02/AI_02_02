from backend.core import config
from backend.core.jwt.backends import TokenBackend

token_backend = TokenBackend(
    algorithm=config.JWT_ALGORITHM,
    signing_key=config.SECRET_KEY,
    leeway=config.JWT_LEEWAY,
)
