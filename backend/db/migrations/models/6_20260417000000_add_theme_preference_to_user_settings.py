from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "user_settings"
        ADD COLUMN IF NOT EXISTS "theme_preference" VARCHAR(10) NOT NULL DEFAULT 'dark';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "user_settings"
        DROP COLUMN IF EXISTS "theme_preference";"""
