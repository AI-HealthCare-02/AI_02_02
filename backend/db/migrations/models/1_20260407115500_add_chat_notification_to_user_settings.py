from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "user_settings"
        ADD COLUMN IF NOT EXISTS "chat_notification" BOOL NOT NULL DEFAULT True;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "user_settings"
        DROP COLUMN IF EXISTS "chat_notification";
    """
