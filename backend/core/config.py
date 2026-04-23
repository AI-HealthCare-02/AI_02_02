import os
import uuid
import zoneinfo
from dataclasses import field
from enum import StrEnum
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Env(StrEnum):
    LOCAL = "local"
    DEV = "dev"
    PROD = "prod"


class ChatLangGraphMode(StrEnum):
    OFF = "off"
    SHADOW = "shadow"
    PARTIAL = "partial"


class ChatAppContextMode(StrEnum):
    OFF = "off"
    HELP_ONLY = "help_only"
    LIVE_STATE = "live_state"


class LLMProvider(StrEnum):
    OPENAI = "openai"
    GEMMA_VLLM = "gemma_vllm"


class LLMFallbackProvider(StrEnum):
    OFF = "off"
    OPENAI = "openai"


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="allow")

    ENV: Env = Env.LOCAL
    SECRET_KEY: str = f"default-secret-key{uuid.uuid4().hex}"
    TIMEZONE: zoneinfo.ZoneInfo = field(default_factory=lambda: zoneinfo.ZoneInfo("Asia/Seoul"))
    TEMPLATE_DIR: str = os.path.join(Path(__file__).resolve().parent.parent, "templates")

    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "root"
    DB_PASSWORD: str = "pw1234"
    DB_NAME: str = "ai_health"
    DB_CONNECT_TIMEOUT: int = 5
    DB_CONNECTION_POOL_MAXSIZE: int = 10

    COOKIE_DOMAIN: str = "localhost"
    FRONTEND_BASE_URL: str = "http://localhost:3000"

    # Social login
    KAKAO_REST_API_KEY: str = ""
    KAKAO_CLIENT_SECRET: str = ""
    KAKAO_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/social/callback/kakao"
    KAKAO_LOGOUT_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/social/logout/kakao"
    NAVER_CLIENT_ID: str = ""
    NAVER_CLIENT_SECRET: str = ""
    NAVER_REDIRECT_URI: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""
    SOCIAL_PENDING_TOKEN_EXPIRE_MINUTES: int = 30

    # Email / SMTP
    MAIL_FROM: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    SHARED_DEMO_PASSWORD: str = ""

    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 14 * 24 * 60
    JWT_LEEWAY: int = 5

    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    LLM_PROVIDER: LLMProvider = LLMProvider.OPENAI
    LLM_BASE_URL: str = ""
    LLM_MODEL: str = ""
    LLM_API_KEY: str = ""
    LLM_FALLBACK_PROVIDER: LLMFallbackProvider = LLMFallbackProvider.OFF

    DB_CONNECTION_POOL_MINSIZE: int = 2

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_MAX_CONNECTIONS: int = 20

    # Sentry
    SENTRY_DSN: str = ""

    # 콘텐츠 필터 (욕설/위기/의료안전)
    CONTENT_FILTER_ENABLED: bool = True
    CONTENT_FILTER_BLOCK_ENABLED: bool = True
    CONTENT_FILTER_SHADOW_MODERATION_ENABLED: bool = False

    # 메시지 라우팅 (route enum + emotional_priority)
    CONTENT_FILTER_ROUTING_ENABLED: bool = False
    CONTENT_FILTER_ROUTING_APPLY_ENABLED: bool = False

    # RAG (건강 문서 검색 — in-process lexical)
    RAG_ENABLED: bool = False
    RAG_APPLY_ENABLED: bool = False
    RAG_TOP_K: int = 2
    RAG_MAX_CONTEXT_CHARS: int = 700
    RAG_CORPUS_DIR: str = "docs/knowledge/approved"

    # 사용자 맥락 (맞춤답변 — HealthProfile 기반 thin personalization)
    USER_CONTEXT_ENABLED: bool = False
    USER_CONTEXT_APPLY_ENABLED: bool = False

    # Chat preparation LangGraph rollout
    CHAT_LANGGRAPH_MODE: ChatLangGraphMode = ChatLangGraphMode.OFF
    CHAT_LANGGRAPH_PARTIAL_PERCENT: int = 0
    CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE: float = 0.0
    CHAT_LANGGRAPH_AUDIT_SAMPLE_RATE: float = 0.0
    CHAT_LANGGRAPH_PREP_TIMEOUT_MS: int = 250
    CHAT_LANGGRAPH_FORCE_FALLBACK: bool = False
    CHAT_APP_CONTEXT_MODE: ChatAppContextMode = ChatAppContextMode.HELP_ONLY

    CHAT_OPENAI_SHARED_CLIENT_ENABLED: bool = True
    CHAT_OPENAI_STREAM_CONNECT_TIMEOUT_MS: int = 3000
    CHAT_OPENAI_STREAM_POOL_TIMEOUT_MS: int = 2000
    CHAT_OPENAI_STREAM_WRITE_TIMEOUT_MS: int = 5000
    CHAT_OPENAI_STREAM_MAX_CONNECTIONS: int = 20
    CHAT_OPENAI_STREAM_MAX_KEEPALIVE_CONNECTIONS: int = 10
    CHAT_OPENAI_STREAM_MAX_RETRIES: int = 0
    CHAT_OPENAI_STREAM_FIRST_TOKEN_TIMEOUT_MS: int = 20000
    CHAT_OPENAI_STREAM_INTER_TOKEN_TIMEOUT_MS: int = 15000
    CHAT_OPENAI_STREAM_TOTAL_DEADLINE_MS: int = 90000
    CHAT_OPENAI_MAX_TOKENS: int = 1024
    CHAT_OPENAI_SHORT_RESPONSE_ENABLED: bool = False
    CHAT_OPENAI_SHORT_RESPONSE_MAX_TOKENS: int = 256
    GEMMA_MAX_MODEL_LEN: int = 4096
    GEMMA_MAX_NUM_SEQS: int = 1
    GEMMA_MAX_NUM_BATCHED_TOKENS: int = 2048
    GEMMA_GPU_MEMORY_UTILIZATION: float = 0.90

    CHAT_BENCH_BUDGET_ENABLED: bool = False

    # 사주 사이드 게임 (우측 카드 진입형, v2.7)
    # - false 기본: 상품 API 503 응답. export/delete는 플래그와 무관하게 허용.
    # - P1 스캐폴딩 단계에서는 엔드포인트 stub만 제공.
    SAJU_ENABLED: bool = False
