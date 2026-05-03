from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "doit_thoughts" (
            "id"              VARCHAR(40)   NOT NULL PRIMARY KEY,
            "user_id"         BIGINT        NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
            "text"            TEXT          NOT NULL DEFAULT '',
            "category"        VARCHAR(20),
            "created_at"      TIMESTAMPTZ   NOT NULL,
            "classified_at"   TIMESTAMPTZ,
            "discarded_at"    TIMESTAMPTZ,
            "completed_at"    TIMESTAMPTZ,
            "canvas_x"        DOUBLE PRECISION,
            "canvas_y"        DOUBLE PRECISION,
            "rotation"        SMALLINT      NOT NULL DEFAULT 0,
            "color"           VARCHAR(20),
            "card_width"      SMALLINT,
            "card_height"     SMALLINT,
            "scheduled_date"  DATE,
            "scheduled_time"  TIME,
            "schedule_note"   TEXT,
            "planned_date"    DATE,
            "description"     TEXT,
            "next_action"     TEXT,
            "project_status"  VARCHAR(20),
            "project_link_id" VARCHAR(40),
            "note_body"       TEXT,
            "clarification"   JSONB         NOT NULL DEFAULT '{}',
            "end_of_day"      JSONB         NOT NULL DEFAULT '{}',
            "waiting_for"     TEXT,
            "someday_reason"  TEXT,
            "urgency"         JSONB,
            "updated_at"      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS "idx_doit_thoughts_user_id"
            ON "doit_thoughts" ("user_id");
        CREATE INDEX IF NOT EXISTS "idx_doit_thoughts_user_category"
            ON "doit_thoughts" ("user_id", "category");
        CREATE INDEX IF NOT EXISTS "idx_doit_thoughts_user_updated"
            ON "doit_thoughts" ("user_id", "updated_at" DESC);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "doit_thoughts";
    """
