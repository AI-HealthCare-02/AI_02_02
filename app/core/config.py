import os
import uuid
import zoneinfo
from datetime import tzinfo
from enum import StrEnum
from pathlib import Path

from dateutil import tz
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Env(StrEnum):
    LOCAL = "local"
    DEV = "dev"
    PROD = "prod"


def get_timezone() -> tzinfo:
    try:
        return zoneinfo.ZoneInfo("Asia/Seoul")
    except zoneinfo.ZoneInfoNotFoundError:
        fallback = tz.gettz("Asia/Seoul")
        if fallback is None:
            raise
        return fallback


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="allow")

    APP_NAME: str = "DANAA API"
    APP_VERSION: str = "2026-04-02"
    ENV: Env = Env.LOCAL
    SECRET_KEY: str = f"default-secret-key-{uuid.uuid4().hex}"
    TIMEZONE: tzinfo = Field(default_factory=get_timezone)
    TEMPLATE_DIR: str = os.path.join(Path(__file__).resolve().parent.parent, "templates")

    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_NAME: str = "ai_health"
    DB_CONNECT_TIMEOUT: int = 5
    DB_CONNECTION_POOL_MAXSIZE: int = 10

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    COOKIE_DOMAIN: str = "localhost"

    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 14 * 24 * 60
    JWT_LEEWAY: int = 5


config = Config()
