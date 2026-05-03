from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "external_device_sessions" (
            "id" BIGSERIAL NOT NULL PRIMARY KEY,
            "user_code" VARCHAR(16) NOT NULL UNIQUE,
            "device_code_hash" VARCHAR(64) NOT NULL UNIQUE,
            "client_name" VARCHAR(80) NOT NULL,
            "client_type" VARCHAR(20) NOT NULL DEFAULT 'unknown',
            "scopes" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
            "approved_user_id" BIGINT REFERENCES "users" ("id") ON DELETE CASCADE,
            "approved_at" TIMESTAMPTZ,
            "expires_at" TIMESTAMPTZ NOT NULL,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_external_device_user_code_status"
            ON "external_device_sessions" ("user_code", "status");

        CREATE TABLE IF NOT EXISTS "external_client_tokens" (
            "id" BIGSERIAL NOT NULL PRIMARY KEY,
            "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
            "token_hash" VARCHAR(64) NOT NULL UNIQUE,
            "client_name" VARCHAR(80) NOT NULL,
            "client_type" VARCHAR(20) NOT NULL DEFAULT 'unknown',
            "scopes" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "expires_at" TIMESTAMPTZ NOT NULL,
            "revoked_at" TIMESTAMPTZ,
            "last_used_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_external_tokens_user_revoked"
            ON "external_client_tokens" ("user_id", "revoked_at");

        CREATE TABLE IF NOT EXISTS "external_checkin_leases" (
            "id" BIGSERIAL NOT NULL PRIMARY KEY,
            "lease_id" VARCHAR(64) NOT NULL UNIQUE,
            "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
            "token_id" BIGINT NOT NULL REFERENCES "external_client_tokens" ("id") ON DELETE CASCADE,
            "bundle_key" VARCHAR(20) NOT NULL,
            "question_payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
            "allowed_fields" JSONB NOT NULL DEFAULT '[]'::jsonb,
            "log_date" DATE NOT NULL,
            "expires_at" TIMESTAMPTZ NOT NULL,
            "consumed_at" TIMESTAMPTZ,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "idx_external_leases_user_date"
            ON "external_checkin_leases" ("user_id", "log_date");
        CREATE INDEX IF NOT EXISTS "idx_external_leases_token_expires"
            ON "external_checkin_leases" ("token_id", "expires_at");

        CREATE TABLE IF NOT EXISTS "external_checkin_requests" (
            "id" BIGSERIAL NOT NULL PRIMARY KEY,
            "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
            "token_id" BIGINT NOT NULL REFERENCES "external_client_tokens" ("id") ON DELETE CASCADE,
            "lease_id" BIGINT REFERENCES "external_checkin_leases" ("id") ON DELETE SET NULL,
            "idempotency_key" VARCHAR(128) NOT NULL,
            "request_hash" VARCHAR(64) NOT NULL,
            "response_payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "uq_external_request_token_idempotency"
                UNIQUE ("token_id", "idempotency_key")
        );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "external_checkin_requests";
        DROP TABLE IF EXISTS "external_checkin_leases";
        DROP TABLE IF EXISTS "external_client_tokens";
        DROP TABLE IF EXISTS "external_device_sessions";
    """


MODELS_STATE = (
    "external_checkin_tables_v1"
)
