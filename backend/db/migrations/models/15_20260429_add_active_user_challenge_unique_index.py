from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE UNIQUE INDEX IF NOT EXISTS "uid_user_challenges_active_template"
        ON "user_challenges" ("user_id", "template_id")
        WHERE "status" = 'active';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "uid_user_challenges_active_template";
    """


MODELS_STATE = (
    "eJyrVsrPVrJSMKwFAA3IAqI="
)
