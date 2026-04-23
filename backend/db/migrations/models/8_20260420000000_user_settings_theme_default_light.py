from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "user_settings"
        ALTER COLUMN "theme_preference" SET DEFAULT 'light';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "user_settings"
        ALTER COLUMN "theme_preference" SET DEFAULT 'dark';"""


MODELS_STATE = (
    "eJyrVsrPVrJSMKwFAA3IAqI="
)
