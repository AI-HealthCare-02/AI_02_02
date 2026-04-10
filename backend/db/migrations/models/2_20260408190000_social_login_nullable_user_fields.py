from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "users"
            ADD COLUMN IF NOT EXISTS "provider" VARCHAR(20),
            ADD COLUMN IF NOT EXISTS "provider_user_id" VARCHAR(128);

        ALTER TABLE "users"
            ALTER COLUMN "email" DROP NOT NULL,
            ALTER COLUMN "hashed_password" DROP NOT NULL,
            ALTER COLUMN "name" DROP NOT NULL,
            ALTER COLUMN "gender" DROP NOT NULL,
            ALTER COLUMN "birthday" DROP NOT NULL,
            ALTER COLUMN "phone_number" DROP NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "users"
            ALTER COLUMN "phone_number" SET NOT NULL,
            ALTER COLUMN "birthday" SET NOT NULL,
            ALTER COLUMN "gender" SET NOT NULL,
            ALTER COLUMN "name" SET NOT NULL,
            ALTER COLUMN "hashed_password" SET NOT NULL,
            ALTER COLUMN "email" SET NOT NULL;

        ALTER TABLE "users"
            DROP COLUMN IF EXISTS "provider_user_id",
            DROP COLUMN IF EXISTS "provider";
    """
