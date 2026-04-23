"""사주 사이드 게임 5 테이블 추가 (v2.7 P1 스캐폴딩).

정책:
- 건강 데이터와 분리 (기존 테이블 FK 없음, users만 참조)
- 운영 데이터 생긴 뒤 DROP 금지 원칙 → downgrade는 export 후 수동 승인 시에만 수행
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "saju_consent_events" (
            "id" BIGSERIAL NOT NULL PRIMARY KEY,
            "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
            "consent_version" VARCHAR(16) NOT NULL,
            "granted" BOOL NOT NULL,
            "ip_hash" VARCHAR(64),
            "ua_hash" VARCHAR(64),
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_saju_consent_user_time"
            ON "saju_consent_events" ("user_id", "created_at");

        CREATE TABLE IF NOT EXISTS "saju_profiles" (
            "id" BIGSERIAL NOT NULL PRIMARY KEY,
            "user_id" BIGINT NOT NULL UNIQUE REFERENCES "users" ("id") ON DELETE CASCADE,
            "birth_date" DATE NOT NULL,
            "is_lunar" BOOL NOT NULL DEFAULT False,
            "is_leap_month" BOOL NOT NULL DEFAULT False,
            "birth_time" TIME,
            "birth_time_accuracy" VARCHAR(10) NOT NULL DEFAULT 'unknown',
            "gender" VARCHAR(10) NOT NULL,
            "is_deleted" BOOL NOT NULL DEFAULT False,
            "deleted_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_saju_profiles_user_active"
            ON "saju_profiles" ("user_id") WHERE "is_deleted" = False;

        CREATE TABLE IF NOT EXISTS "saju_charts" (
            "id" BIGSERIAL NOT NULL PRIMARY KEY,
            "profile_id" BIGINT NOT NULL UNIQUE REFERENCES "saju_profiles" ("id") ON DELETE CASCADE,
            "engine_version" VARCHAR(32) NOT NULL,
            "natal" JSONB NOT NULL DEFAULT '{}'::jsonb,
            "strength" JSONB NOT NULL DEFAULT '{}'::jsonb,
            "yongshin" JSONB NOT NULL DEFAULT '{}'::jsonb,
            "daewoon" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "computed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS "saju_daily_cards" (
            "id" BIGSERIAL NOT NULL PRIMARY KEY,
            "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
            "card_date" DATE NOT NULL,
            "summary" VARCHAR(200) NOT NULL DEFAULT '',
            "keywords" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "sections" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "safety_notice" TEXT NOT NULL DEFAULT '',
            "engine_version" VARCHAR(32) NOT NULL,
            "template_version" VARCHAR(32) NOT NULL DEFAULT 'v1',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "uq_saju_daily_user_date" UNIQUE ("user_id", "card_date")
        );
        CREATE INDEX IF NOT EXISTS "idx_saju_daily_user_date"
            ON "saju_daily_cards" ("user_id", "card_date");

        CREATE TABLE IF NOT EXISTS "saju_feedback_events" (
            "id" BIGSERIAL NOT NULL PRIMARY KEY,
            "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
            "card_id" BIGINT REFERENCES "saju_daily_cards" ("id") ON DELETE CASCADE,
            "section_key" VARCHAR(20),
            "verdict" VARCHAR(12) NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_saju_feedback_user_time"
            ON "saju_feedback_events" ("user_id", "created_at");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    # 운영 데이터 생성 후 DROP 시 반드시 export 후 수동 승인 필요.
    # 개발 환경 롤백 용도로만 사용.
    return """
        DROP TABLE IF EXISTS "saju_feedback_events";
        DROP TABLE IF EXISTS "saju_daily_cards";
        DROP TABLE IF EXISTS "saju_charts";
        DROP TABLE IF EXISTS "saju_profiles";
        DROP TABLE IF EXISTS "saju_consent_events";
    """
