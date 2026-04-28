"""?ъ＜ ?ъ씠??寃뚯엫 5 ?뚯씠釉?異붽? (v2.7 P1 ?ㅼ틦?대뵫).

?뺤콉:
- 嫄닿컯 ?곗씠?곗? 遺꾨━ (湲곗〈 ?뚯씠釉?FK ?놁쓬, users留?李몄“)
- ?댁쁺 ?곗씠???앷릿 ??DROP 湲덉? ?먯튃 ??downgrade??export ???섎룞 ?뱀씤 ?쒖뿉留??섑뻾
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
    # ?댁쁺 ?곗씠???앹꽦 ??DROP ??諛섎뱶??export ???섎룞 ?뱀씤 ?꾩슂.
    # 媛쒕컻 ?섍꼍 濡ㅻ갚 ?⑸룄濡쒕쭔 ?ъ슜.
    return """
        DROP TABLE IF EXISTS "saju_feedback_events";
        DROP TABLE IF EXISTS "saju_daily_cards";
        DROP TABLE IF EXISTS "saju_charts";
        DROP TABLE IF EXISTS "saju_profiles";
        DROP TABLE IF EXISTS "saju_consent_events";
    """


MODELS_STATE = (
    "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"
    "xpHa5Qkt6yyCzY160Qv91/8DyQmNIw=="
)
