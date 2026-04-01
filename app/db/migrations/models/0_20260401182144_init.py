from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "aerich" (
    "id" SERIAL NOT NULL PRIMARY KEY,
    "version" VARCHAR(255) NOT NULL,
    "app" VARCHAR(100) NOT NULL,
    "content" JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS "users" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "email" VARCHAR(40) NOT NULL,
    "hashed_password" VARCHAR(128) NOT NULL,
    "name" VARCHAR(20) NOT NULL,
    "gender" VARCHAR(6) NOT NULL,
    "birthday" DATE NOT NULL,
    "phone_number" VARCHAR(11) NOT NULL,
    "is_active" BOOL NOT NULL DEFAULT True,
    "is_admin" BOOL NOT NULL DEFAULT False,
    "last_login" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON COLUMN "users"."gender" IS 'MALE: MALE\nFEMALE: FEMALE';
CREATE TABLE IF NOT EXISTS "daily_health_logs" (
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "log_date" DATE NOT NULL,
    "sleep" VARCHAR(9),
    "sleep_hours" DECIMAL(4,1),
    "breakfast" VARCHAR(8),
    "took_medication" VARCHAR(7),
    "foodcomp" VARCHAR(15),
    "sweetdrink" VARCHAR(7),
    "exercise" VARCHAR(7),
    "exercise_type" VARCHAR(10),
    "exercise_minutes" INT,
    "veggie" VARCHAR(7),
    "walk" VARCHAR(7),
    "nightsnack" VARCHAR(7),
    "mood" VARCHAR(9),
    "alcohol_today" VARCHAR(7),
    "alcohol_amount" VARCHAR(30),
    "lunch" VARCHAR(8),
    "dinner" VARCHAR(8),
    "water_cups" INT,
    "sleep_source" VARCHAR(8),
    "breakfast_source" VARCHAR(8),
    "took_medication_source" VARCHAR(8),
    "foodcomp_source" VARCHAR(8),
    "sweetdrink_source" VARCHAR(8),
    "exercise_source" VARCHAR(8),
    "exercise_minutes_source" VARCHAR(8),
    "veggie_source" VARCHAR(8),
    "walk_source" VARCHAR(8),
    "nightsnack_source" VARCHAR(8),
    "mood_source" VARCHAR(8),
    "alcohol_today_source" VARCHAR(8),
    "alcohol_amount_source" VARCHAR(8),
    "is_backfill" BOOL NOT NULL DEFAULT False,
    "backfilled_at" TIMESTAMPTZ,
    "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_daily_healt_user_id_d68870" UNIQUE ("user_id", "log_date")
);
COMMENT ON COLUMN "daily_health_logs"."sleep" IS 'GREAT: great\nGOOD: good\nAVERAGE: average\nPOOR: poor\nVERY_POOR: very_poor';
COMMENT ON COLUMN "daily_health_logs"."breakfast" IS 'NONE: none\nLIGHT: light\nBALANCED: balanced\nHEAVY: heavy';
COMMENT ON COLUMN "daily_health_logs"."took_medication" IS 'YES: yes\nNO: no\nUNKNOWN: unknown';
COMMENT ON COLUMN "daily_health_logs"."foodcomp" IS 'BALANCED: balanced\nCARB_HEAVY: carb_heavy\nPROTEIN_HEAVY: protein_heavy\nVEGETABLE_HEAVY: vegetable_heavy\nFAST_FOOD: fast_food\nSKIPPED: skipped';
COMMENT ON COLUMN "daily_health_logs"."sweetdrink" IS 'YES: yes\nNO: no\nUNKNOWN: unknown';
COMMENT ON COLUMN "daily_health_logs"."exercise" IS 'YES: yes\nNO: no\nUNKNOWN: unknown';
COMMENT ON COLUMN "daily_health_logs"."exercise_type" IS 'WALKING: walking\nCARDIO: cardio\nSTRENGTH: strength\nSPORTS: sports\nSTRETCHING: stretching\nOTHER: other';
COMMENT ON COLUMN "daily_health_logs"."veggie" IS 'YES: yes\nNO: no\nUNKNOWN: unknown';
COMMENT ON COLUMN "daily_health_logs"."walk" IS 'YES: yes\nNO: no\nUNKNOWN: unknown';
COMMENT ON COLUMN "daily_health_logs"."nightsnack" IS 'YES: yes\nNO: no\nUNKNOWN: unknown';
COMMENT ON COLUMN "daily_health_logs"."mood" IS 'VERY_GOOD: very_good\nGOOD: good\nNEUTRAL: neutral\nLOW: low\nVERY_LOW: very_low';
COMMENT ON COLUMN "daily_health_logs"."alcohol_today" IS 'YES: yes\nNO: no\nUNKNOWN: unknown';
COMMENT ON COLUMN "daily_health_logs"."lunch" IS 'NONE: none\nLIGHT: light\nBALANCED: balanced\nHEAVY: heavy';
COMMENT ON COLUMN "daily_health_logs"."dinner" IS 'NONE: none\nLIGHT: light\nBALANCED: balanced\nHEAVY: heavy';
COMMENT ON COLUMN "daily_health_logs"."sleep_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."breakfast_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."took_medication_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."foodcomp_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."sweetdrink_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."exercise_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."exercise_minutes_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."veggie_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."walk_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."nightsnack_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."mood_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."alcohol_today_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."alcohol_amount_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
CREATE TABLE IF NOT EXISTS "health_profiles" (
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "user_group" VARCHAR(1) NOT NULL,
    "relation" VARCHAR(20) NOT NULL,
    "age_range" VARCHAR(20) NOT NULL,
    "height_cm" INT NOT NULL,
    "weight_kg" DECIMAL(5,2) NOT NULL,
    "bmi" DECIMAL(5,2) NOT NULL,
    "family_history" VARCHAR(13) NOT NULL,
    "conditions" JSONB NOT NULL,
    "has_hypertension" BOOL NOT NULL DEFAULT False,
    "has_high_glucose_history" BOOL NOT NULL DEFAULT False,
    "exercise_frequency" VARCHAR(20),
    "has_daily_vegetables" BOOL NOT NULL DEFAULT False,
    "diet_habits" JSONB NOT NULL,
    "sleep_habit" VARCHAR(20),
    "smoking_status" VARCHAR(20),
    "alcohol_frequency" VARCHAR(20),
    "goals" JSONB NOT NULL,
    "initial_findrisc_score" INT NOT NULL,
    "onboarding_completed_at" TIMESTAMPTZ,
    "user_id" BIGINT NOT NULL UNIQUE REFERENCES "users" ("id") ON DELETE CASCADE
);
COMMENT ON COLUMN "health_profiles"."user_group" IS 'A: A\nB: B\nC: C';
COMMENT ON COLUMN "health_profiles"."family_history" IS 'NONE: none\nSECOND_DEGREE: second_degree\nFIRST_DEGREE: first_degree';
CREATE TABLE IF NOT EXISTS "periodic_measurements" (
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "measurement_type" VARCHAR(17) NOT NULL,
    "measured_date" DATE NOT NULL,
    "numeric_value" DECIMAL(8,2),
    "secondary_value" DECIMAL(8,2),
    "unit" VARCHAR(20),
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "note" VARCHAR(255),
    "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
);
COMMENT ON COLUMN "periodic_measurements"."measurement_type" IS 'WEIGHT: weight\nWAIST: waist\nBLOOD_PRESSURE: blood_pressure\nHBA1C: hba1c\nFASTING_GLUCOSE: fasting_glucose\nCHOLESTEROL: cholesterol\nSMOKING_CHANGE: smoking_change\nMEDICATION_CHANGE: medication_change';
CREATE TABLE IF NOT EXISTS "risk_assessments" (
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "period_type" VARCHAR(9) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "findrisc_score" INT NOT NULL,
    "risk_level" VARCHAR(9) NOT NULL,
    "sleep_score" INT NOT NULL DEFAULT 0,
    "diet_score" INT NOT NULL DEFAULT 0,
    "exercise_score" INT NOT NULL DEFAULT 0,
    "lifestyle_score" INT NOT NULL DEFAULT 0,
    "score_age" INT NOT NULL DEFAULT 0,
    "score_bmi" INT NOT NULL DEFAULT 0,
    "score_waist" INT NOT NULL DEFAULT 0,
    "score_exercise" INT NOT NULL DEFAULT 0,
    "score_vegetable" INT NOT NULL DEFAULT 0,
    "score_hypertension" INT NOT NULL DEFAULT 0,
    "score_glucose_history" INT NOT NULL DEFAULT 0,
    "score_family" INT NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMPTZ NOT NULL,
    "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_risk_assess_user_id_9e967b" UNIQUE ("user_id", "period_type", "period_start", "period_end")
);
COMMENT ON COLUMN "risk_assessments"."period_type" IS 'WEEKLY: weekly\nMONTHLY: monthly\nQUARTERLY: quarterly';
COMMENT ON COLUMN "risk_assessments"."risk_level" IS 'LOW: low\nSLIGHT: slight\nMODERATE: moderate\nHIGH: high\nVERY_HIGH: very_high';
CREATE TABLE IF NOT EXISTS "user_engagements" (
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "state" VARCHAR(11) NOT NULL DEFAULT 'ACTIVE',
    "seven_day_response_rate" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "last_question_bundle_at" TIMESTAMPTZ,
    "bundles_today" INT NOT NULL DEFAULT 0,
    "cooldown_until" TIMESTAMPTZ,
    "last_bundle_key" VARCHAR(50),
    "last_answered_at" TIMESTAMPTZ,
    "is_on_vacation" BOOL NOT NULL DEFAULT False,
    "user_id" BIGINT NOT NULL UNIQUE REFERENCES "users" ("id") ON DELETE CASCADE
);
COMMENT ON COLUMN "user_engagements"."state" IS 'ACTIVE: ACTIVE\nMODERATE: MODERATE\nLOW: LOW\nDORMANT: DORMANT\nHIBERNATING: HIBERNATING';
CREATE TABLE IF NOT EXISTS "challenge_templates" (
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL,
    "category" VARCHAR(10) NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "goal_criteria" JSONB NOT NULL,
    "duration_days" INT NOT NULL DEFAULT 7,
    "evidence_summary" VARCHAR(255),
    "risk_factor" VARCHAR(50),
    "for_groups" JSONB NOT NULL,
    "is_active" BOOL NOT NULL DEFAULT True
);
COMMENT ON COLUMN "challenge_templates"."category" IS 'EXERCISE: exercise\nDIET: diet\nSLEEP: sleep\nLIFESTYLE: lifestyle\nMEDICATION: medication\nWEIGHT: weight';
CREATE TABLE IF NOT EXISTS "user_badges" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "badge_type" VARCHAR(19) NOT NULL,
    "earned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "context" JSONB,
    "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
);
COMMENT ON COLUMN "user_badges"."badge_type" IS 'FIRST_LOG: first_log\nWEEK_STREAK: week_streak\nMONTH_STREAK: month_streak\nFIRST_CHALLENGE: first_challenge\nFIVE_CHALLENGES: five_challenges\nEXERCISE_MASTER: exercise_master\nDIET_CHAMPION: diet_champion\nSLEEP_HERO: sleep_hero\nRISK_IMPROVER: risk_improver\nPERFECT_WEEK: perfect_week\nCOMEBACK: comeback\nONBOARDING_COMPLETE: onboarding_complete';
CREATE TABLE IF NOT EXISTS "user_challenges" (
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "status" VARCHAR(9) NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMPTZ NOT NULL,
    "target_end_date" DATE,
    "completed_at" TIMESTAMPTZ,
    "current_streak" INT NOT NULL DEFAULT 0,
    "best_streak" INT NOT NULL DEFAULT 0,
    "progress_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "daily_log" JSONB,
    "notes" VARCHAR(255),
    "template_id" BIGINT NOT NULL REFERENCES "challenge_templates" ("id") ON DELETE CASCADE,
    "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
);
COMMENT ON COLUMN "user_challenges"."status" IS 'ACTIVE: active\nCOMPLETED: completed\nFAILED: failed\nPAUSED: paused';
CREATE TABLE IF NOT EXISTS "challenge_checkins" (
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "checkin_date" DATE NOT NULL,
    "status" VARCHAR(8) NOT NULL,
    "judged_by" VARCHAR(6) NOT NULL,
    "source_field_keys" JSONB NOT NULL,
    "note" VARCHAR(255),
    "user_challenge_id" BIGINT NOT NULL REFERENCES "user_challenges" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_challenge_c_user_ch_16e315" UNIQUE ("user_challenge_id", "checkin_date")
);
COMMENT ON COLUMN "challenge_checkins"."status" IS 'ACHIEVED: achieved\nMISSED: missed\nPARTIAL: partial';
COMMENT ON COLUMN "challenge_checkins"."judged_by" IS 'AUTO: auto\nMANUAL: manual';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        """


MODELS_STATE = (
    "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"
)
