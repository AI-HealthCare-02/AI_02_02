from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "predicted_score_pct" SMALLINT;
        ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "predicted_risk_level" VARCHAR(20);
        ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "predicted_risk_label" VARCHAR(40);
        ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "predicted_stage_label" VARCHAR(60);
        ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "model_track" VARCHAR(30);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "risk_assessments" DROP COLUMN IF EXISTS "model_track";
        ALTER TABLE "risk_assessments" DROP COLUMN IF EXISTS "predicted_stage_label";
        ALTER TABLE "risk_assessments" DROP COLUMN IF EXISTS "predicted_risk_label";
        ALTER TABLE "risk_assessments" DROP COLUMN IF EXISTS "predicted_risk_level";
        ALTER TABLE "risk_assessments" DROP COLUMN IF EXISTS "predicted_score_pct";
    """


MODELS_STATE = (
    "eJyrVsrPVrJSMKwFAA3IAqI="
)
