from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "user_settings"
        ADD COLUMN IF NOT EXISTS "health_question_interval_minutes" SMALLINT NOT NULL DEFAULT 90;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "user_settings"
        DROP COLUMN IF EXISTS "health_question_interval_minutes";
    """


MODELS_STATE = (
    "eJyrVsrPVrJSMKwFAA3IAqI="
)
