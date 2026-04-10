from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "onboarding_completed" BOOL NOT NULL DEFAULT False,
            ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMPTZ;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "users"
            DROP COLUMN IF EXISTS "onboarding_completed_at",
            DROP COLUMN IF EXISTS "onboarding_completed";
    """
