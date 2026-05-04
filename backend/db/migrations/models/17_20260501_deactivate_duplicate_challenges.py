from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "challenge_templates"
        SET "is_active" = false
        WHERE "code" IN ('exercise_3x_week', 'alcohol_limit');

        UPDATE "user_challenges"
        SET "status" = 'cancelled',
            "completed_at" = CURRENT_TIMESTAMP,
            "today_checked" = false
        WHERE "status" = 'active'
          AND "template_id" IN (
              SELECT "id"
              FROM "challenge_templates"
              WHERE "code" IN ('exercise_3x_week', 'alcohol_limit')
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "challenge_templates"
        SET "is_active" = true
        WHERE "code" IN ('exercise_3x_week', 'alcohol_limit');
    """


MODELS_STATE = (
    "eJyrVsrPVrJSMKwFAA3IAqI="
)
