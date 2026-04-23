from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "push_subscriptions" (
            "id" BIGSERIAL NOT NULL PRIMARY KEY,
            "endpoint" VARCHAR(500) NOT NULL UNIQUE,
            "p256dh" TEXT NOT NULL,
            "auth" TEXT NOT NULL,
            "action_token" VARCHAR(96) NOT NULL UNIQUE,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "muted_until" TIMESTAMPTZ,
            "disabled_at" TIMESTAMPTZ,
            "last_sent_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "idx_push_subs_user_active"
        ON "push_subscriptions" ("user_id", "is_active");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "push_subscriptions";
    """


MODELS_STATE = (
    "eJyrVsrPVrJSMKwFAA3IAqI="
)
