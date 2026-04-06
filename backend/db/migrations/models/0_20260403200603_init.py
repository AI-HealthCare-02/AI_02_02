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
CREATE TABLE IF NOT EXISTS "user_consents" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "terms_of_service" BOOL NOT NULL,
    "privacy_policy" BOOL NOT NULL,
    "health_data_consent" BOOL NOT NULL,
    "disclaimer_consent" BOOL NOT NULL,
    "marketing_consent" BOOL NOT NULL DEFAULT False,
    "consented_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" BIGINT NOT NULL UNIQUE REFERENCES "users" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "user_consents" IS '회원의 최신 동의 상태 (1인당 1행).';
CREATE TABLE IF NOT EXISTS "daily_health_logs" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "log_date" DATE NOT NULL,
    "sleep_quality" VARCHAR(9),
    "sleep_duration_bucket" VARCHAR(11),
    "breakfast_status" VARCHAR(7),
    "lunch_status" VARCHAR(7),
    "dinner_status" VARCHAR(7),
    "vegetable_intake_level" VARCHAR(6),
    "meal_balance_level" VARCHAR(17),
    "sweetdrink_level" VARCHAR(8),
    "exercise_done" BOOL,
    "exercise_type" VARCHAR(12),
    "exercise_minutes" SMALLINT,
    "walk_done" BOOL,
    "water_cups" SMALLINT,
    "nightsnack_level" VARCHAR(5),
    "took_medication" BOOL,
    "mood_level" VARCHAR(13),
    "alcohol_today" BOOL,
    "alcohol_amount_level" VARCHAR(8),
    "sleep_quality_source" VARCHAR(8),
    "breakfast_status_source" VARCHAR(8),
    "lunch_status_source" VARCHAR(8),
    "dinner_status_source" VARCHAR(8),
    "vegetable_intake_level_source" VARCHAR(8),
    "meal_balance_level_source" VARCHAR(8),
    "sweetdrink_level_source" VARCHAR(8),
    "exercise_done_source" VARCHAR(8),
    "walk_done_source" VARCHAR(8),
    "water_cups_source" VARCHAR(8),
    "nightsnack_level_source" VARCHAR(8),
    "took_medication_source" VARCHAR(8),
    "mood_level_source" VARCHAR(8),
    "alcohol_today_source" VARCHAR(8),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_daily_healt_user_id_d68870" UNIQUE ("user_id", "log_date")
);
COMMENT ON COLUMN "daily_health_logs"."sleep_quality" IS 'VERY_GOOD: very_good\nGOOD: good\nNORMAL: normal\nBAD: bad\nVERY_BAD: very_bad';
COMMENT ON COLUMN "daily_health_logs"."sleep_duration_bucket" IS 'UNDER_5: under_5\nBETWEEN_5_6: between_5_6\nBETWEEN_6_7: between_6_7\nBETWEEN_7_8: between_7_8\nOVER_8: over_8';
COMMENT ON COLUMN "daily_health_logs"."breakfast_status" IS 'HEARTY: hearty\nSIMPLE: simple\nSKIPPED: skipped';
COMMENT ON COLUMN "daily_health_logs"."lunch_status" IS 'HEARTY: hearty\nSIMPLE: simple\nSKIPPED: skipped';
COMMENT ON COLUMN "daily_health_logs"."dinner_status" IS 'HEARTY: hearty\nSIMPLE: simple\nSKIPPED: skipped';
COMMENT ON COLUMN "daily_health_logs"."vegetable_intake_level" IS 'ENOUGH: enough\nLITTLE: little\nNONE: none';
COMMENT ON COLUMN "daily_health_logs"."meal_balance_level" IS 'BALANCED: balanced\nCARB_HEAVY: carb_heavy\nPROTEIN_VEG_HEAVY: protein_veg_heavy';
COMMENT ON COLUMN "daily_health_logs"."sweetdrink_level" IS 'NONE: none\nONE: one\nTWO_PLUS: two_plus';
COMMENT ON COLUMN "daily_health_logs"."exercise_type" IS 'WALKING: walking\nRUNNING: running\nCYCLING: cycling\nSWIMMING: swimming\nGYM: gym\nHOME_WORKOUT: home_workout\nOTHER: other';
COMMENT ON COLUMN "daily_health_logs"."nightsnack_level" IS 'NONE: none\nLIGHT: light\nHEAVY: heavy';
COMMENT ON COLUMN "daily_health_logs"."mood_level" IS 'VERY_GOOD: very_good\nGOOD: good\nNORMAL: normal\nSTRESSED: stressed\nVERY_STRESSED: very_stressed';
COMMENT ON COLUMN "daily_health_logs"."alcohol_amount_level" IS 'LIGHT: light\nMODERATE: moderate\nHEAVY: heavy';
COMMENT ON COLUMN "daily_health_logs"."sleep_quality_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."breakfast_status_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."lunch_status_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."dinner_status_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."vegetable_intake_level_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."meal_balance_level_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."sweetdrink_level_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."exercise_done_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."walk_done_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."water_cups_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."nightsnack_level_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."took_medication_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."mood_level_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON COLUMN "daily_health_logs"."alcohol_today_source" IS 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill';
COMMENT ON TABLE "daily_health_logs" IS '매일 건강 기록 (1인당 하루 1행).';
CREATE TABLE IF NOT EXISTS "health_profiles" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "relation" VARCHAR(11) NOT NULL,
    "user_group" VARCHAR(1) NOT NULL,
    "gender" VARCHAR(6) NOT NULL,
    "age_range" VARCHAR(8) NOT NULL,
    "height_cm" DOUBLE PRECISION NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "bmi" DOUBLE PRECISION NOT NULL,
    "family_history" VARCHAR(8) NOT NULL,
    "conditions" JSONB NOT NULL,
    "has_hypertension" BOOL NOT NULL DEFAULT False,
    "has_high_glucose_history" BOOL NOT NULL DEFAULT False,
    "treatments" JSONB,
    "hba1c_range" VARCHAR(10),
    "fasting_glucose_range" VARCHAR(10),
    "exercise_frequency" VARCHAR(15) NOT NULL,
    "diet_habits" JSONB NOT NULL,
    "sleep_duration_bucket" VARCHAR(11) NOT NULL,
    "alcohol_frequency" VARCHAR(9) NOT NULL,
    "smoking_status" VARCHAR(10) NOT NULL,
    "goals" JSONB NOT NULL,
    "ai_consent" VARCHAR(8) NOT NULL,
    "initial_findrisc_score" SMALLINT,
    "initial_risk_level" VARCHAR(9),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" BIGINT NOT NULL UNIQUE REFERENCES "users" ("id") ON DELETE CASCADE
);
COMMENT ON COLUMN "health_profiles"."relation" IS 'DIAGNOSED: diagnosed\nPREDIABETES: prediabetes\nFAMILY: family\nCURIOUS: curious\nPREVENTION: prevention';
COMMENT ON COLUMN "health_profiles"."user_group" IS 'A: A\nB: B\nC: C';
COMMENT ON COLUMN "health_profiles"."gender" IS 'MALE: MALE\nFEMALE: FEMALE';
COMMENT ON COLUMN "health_profiles"."age_range" IS 'UNDER_45: under_45\nBETWEEN_45_54: 45_54\nBETWEEN_55_64: 55_64\nOVER_65: 65_plus';
COMMENT ON COLUMN "health_profiles"."family_history" IS 'PARENTS: parents\nSIBLINGS: siblings\nBOTH: both\nNONE: none\nUNKNOWN: unknown';
COMMENT ON COLUMN "health_profiles"."hba1c_range" IS 'UNDER_5_7: under_5_7\nRANGE_5_7_6_4: 5_7_to_6_4\nRANGE_6_5_7_0: 6_5_to_7_0\nOVER_7: over_7\nUNKNOWN: unknown';
COMMENT ON COLUMN "health_profiles"."fasting_glucose_range" IS 'UNDER_100: under_100\nRANGE_100_125: 100_to_125\nOVER_126: over_126\nUNKNOWN: unknown';
COMMENT ON COLUMN "health_profiles"."exercise_frequency" IS 'NONE: none\nONE_TO_TWO: 1_2_per_week\nTHREE_TO_FOUR: 3_4_per_week\nFIVE_PLUS: 5_plus_per_week';
COMMENT ON COLUMN "health_profiles"."sleep_duration_bucket" IS 'UNDER_5: under_5\nBETWEEN_5_6: between_5_6\nBETWEEN_6_7: between_6_7\nBETWEEN_7_8: between_7_8\nOVER_8: over_8';
COMMENT ON COLUMN "health_profiles"."alcohol_frequency" IS 'NONE: none\nSOMETIMES: sometimes\nOFTEN: often\nDAILY: daily';
COMMENT ON COLUMN "health_profiles"."smoking_status" IS 'NON_SMOKER: non_smoker\nFORMER: former\nCURRENT: current';
COMMENT ON COLUMN "health_profiles"."ai_consent" IS 'AGREED: agreed\nDECLINED: declined';
COMMENT ON COLUMN "health_profiles"."initial_risk_level" IS 'LOW: low\nSLIGHT: slight\nMODERATE: moderate\nHIGH: high\nVERY_HIGH: very_high';
COMMENT ON TABLE "health_profiles" IS '온보딩 설문 결과 (1인당 1행).';
CREATE TABLE IF NOT EXISTS "periodic_measurements" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "measurement_type" VARCHAR(15) NOT NULL,
    "measured_at" TIMESTAMPTZ NOT NULL,
    "numeric_value" DECIMAL(7,2) NOT NULL,
    "numeric_value_2" DECIMAL(7,2),
    "unit" VARCHAR(20) NOT NULL DEFAULT '',
    "source" VARCHAR(15) NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_periodic_me_user_id_7b6ea6" ON "periodic_measurements" ("user_id", "measurement_type", "measured_at");
COMMENT ON COLUMN "periodic_measurements"."measurement_type" IS 'WEIGHT: weight\nWAIST: waist\nBLOOD_PRESSURE: blood_pressure\nHBA1C: hba1c\nFASTING_GLUCOSE: fasting_glucose';
COMMENT ON COLUMN "periodic_measurements"."source" IS 'MANUAL: manual\nIMPORT: import\nMEDICAL_CHECKUP: medical_checkup';
COMMENT ON TABLE "periodic_measurements" IS '주기적 측정값 (체중·허리둘레·혈압·HbA1c·공복혈당).';
CREATE TABLE IF NOT EXISTS "risk_assessments" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "period_type" VARCHAR(9) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "findrisc_score" SMALLINT NOT NULL,
    "risk_level" VARCHAR(9) NOT NULL,
    "sleep_score" SMALLINT,
    "diet_score" SMALLINT,
    "exercise_score" SMALLINT,
    "lifestyle_score" SMALLINT,
    "score_age" SMALLINT NOT NULL DEFAULT 0,
    "score_bmi" SMALLINT NOT NULL DEFAULT 0,
    "score_waist" SMALLINT NOT NULL DEFAULT 0,
    "score_activity" SMALLINT NOT NULL DEFAULT 0,
    "score_vegetable" SMALLINT NOT NULL DEFAULT 0,
    "score_hypertension" SMALLINT NOT NULL DEFAULT 0,
    "score_glucose_history" SMALLINT NOT NULL DEFAULT 0,
    "score_family" SMALLINT NOT NULL DEFAULT 0,
    "top_positive_factors" JSONB NOT NULL,
    "top_risk_factors" JSONB NOT NULL,
    "assessed_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_risk_assess_user_id_815b5d" ON "risk_assessments" ("user_id", "period_type", "period_end");
COMMENT ON COLUMN "risk_assessments"."period_type" IS 'WEEKLY: weekly\nMONTHLY: monthly\nQUARTERLY: quarterly';
COMMENT ON COLUMN "risk_assessments"."risk_level" IS 'LOW: low\nSLIGHT: slight\nMODERATE: moderate\nHIGH: high\nVERY_HIGH: very_high';
COMMENT ON TABLE "risk_assessments" IS '위험도 계산 결과 · 리포트용 점수.';
CREATE TABLE IF NOT EXISTS "user_engagements" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "state" VARCHAR(11) NOT NULL DEFAULT 'ACTIVE',
    "seven_day_response_rate" DECIMAL(4,3) NOT NULL DEFAULT 0,
    "consecutive_missed_days" SMALLINT NOT NULL DEFAULT 0,
    "state_since" TIMESTAMPTZ,
    "total_responses" INT NOT NULL DEFAULT 0,
    "today_bundle_count" SMALLINT NOT NULL DEFAULT 0,
    "cooldown_until" TIMESTAMPTZ,
    "last_bundle_key" VARCHAR(50),
    "last_response_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" BIGINT NOT NULL UNIQUE REFERENCES "users" ("id") ON DELETE CASCADE
);
COMMENT ON COLUMN "user_engagements"."state" IS 'ACTIVE: ACTIVE\nMODERATE: MODERATE\nLOW: LOW\nDORMANT: DORMANT\nHIBERNATING: HIBERNATING';
COMMENT ON TABLE "user_engagements" IS '사용자 응답 참여 상태 (1인당 1행).';
CREATE TABLE IF NOT EXISTS "challenge_templates" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "code" VARCHAR(50) NOT NULL UNIQUE,
    "name" VARCHAR(100) NOT NULL,
    "emoji" VARCHAR(10) NOT NULL DEFAULT '',
    "category" VARCHAR(10) NOT NULL,
    "description" TEXT NOT NULL,
    "goal_criteria" JSONB NOT NULL,
    "default_duration_days" SMALLINT NOT NULL DEFAULT 14,
    "evidence_summary" TEXT NOT NULL,
    "for_groups" JSONB NOT NULL,
    "is_active" BOOL NOT NULL DEFAULT True,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON COLUMN "challenge_templates"."category" IS 'EXERCISE: exercise\nDIET: diet\nSLEEP: sleep\nHYDRATION: hydration\nMEDICATION: medication\nLIFESTYLE: lifestyle';
COMMENT ON TABLE "challenge_templates" IS '챌린지 원본 정의 (마스터 데이터).';
CREATE TABLE IF NOT EXISTS "user_challenges" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "selection_source" VARCHAR(18) NOT NULL,
    "status" VARCHAR(9) NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "current_streak" SMALLINT NOT NULL DEFAULT 0,
    "best_streak" SMALLINT NOT NULL DEFAULT 0,
    "progress_pct" DECIMAL(4,3) NOT NULL DEFAULT 0,
    "target_days" SMALLINT NOT NULL DEFAULT 14,
    "days_completed" SMALLINT NOT NULL DEFAULT 0,
    "today_checked" BOOL NOT NULL DEFAULT False,
    "daily_log" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "template_id" BIGINT NOT NULL REFERENCES "challenge_templates" ("id") ON DELETE RESTRICT,
    "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_user_challe_user_id_34ead6" ON "user_challenges" ("user_id", "status", "started_at");
COMMENT ON COLUMN "user_challenges"."selection_source" IS 'SYSTEM_RECOMMENDED: system_recommended\nUSER_SELECTED: user_selected';
COMMENT ON COLUMN "user_challenges"."status" IS 'ACTIVE: active\nPAUSED: paused\nCOMPLETED: completed\nFAILED: failed';
COMMENT ON TABLE "user_challenges" IS '사용자가 참여 중인 챌린지 상태.';
CREATE TABLE IF NOT EXISTS "challenge_checkins" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "checkin_date" DATE NOT NULL,
    "status" VARCHAR(8) NOT NULL,
    "judged_by" VARCHAR(11) NOT NULL DEFAULT 'system_auto',
    "source_field_keys" JSONB NOT NULL,
    "source_period" VARCHAR(20),
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_challenge_id" BIGINT NOT NULL REFERENCES "user_challenges" ("id") ON DELETE CASCADE,
    CONSTRAINT "uid_challenge_c_user_ch_16e315" UNIQUE ("user_challenge_id", "checkin_date")
);
COMMENT ON COLUMN "challenge_checkins"."status" IS 'ACHIEVED: achieved\nMISSED: missed\nPARTIAL: partial';
COMMENT ON COLUMN "challenge_checkins"."judged_by" IS 'SYSTEM_AUTO: system_auto\nUSER_MANUAL: user_manual';
COMMENT ON TABLE "challenge_checkins" IS '챌린지 날짜별 수행 결과 (하루 1건).';
CREATE TABLE IF NOT EXISTS "user_settings" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "nickname" VARCHAR(30),
    "morning_reminder" BOOL NOT NULL DEFAULT True,
    "evening_reminder" BOOL NOT NULL DEFAULT True,
    "challenge_reminder" BOOL NOT NULL DEFAULT True,
    "weekly_report" BOOL NOT NULL DEFAULT True,
    "reminder_time_morning" TIMETZ,
    "reminder_time_evening" TIMETZ,
    "max_bundles_per_day" SMALLINT NOT NULL DEFAULT 5,
    "preferred_times" JSONB NOT NULL,
    "last_exported_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" BIGINT NOT NULL UNIQUE REFERENCES "users" ("id") ON DELETE CASCADE
);
COMMENT ON TABLE "user_settings" IS '사용자 설정의 최신 상태 (1인당 1행).';
CREATE TABLE IF NOT EXISTS "chat_sessions" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "title" VARCHAR(100) NOT NULL DEFAULT '',
    "is_active" BOOL NOT NULL DEFAULT True,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" BIGINT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_chat_sessio_user_id_1091ca" ON "chat_sessions" ("user_id", "is_active");
COMMENT ON TABLE "chat_sessions" IS '채팅 대화 세션 (사용자당 여러 개).';
CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "role" VARCHAR(9) NOT NULL,
    "content" TEXT NOT NULL,
    "has_health_questions" BOOL NOT NULL DEFAULT False,
    "bundle_keys" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" BIGINT NOT NULL REFERENCES "chat_sessions" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_chat_messag_session_fb3c4b" ON "chat_messages" ("session_id", "created_at");
COMMENT ON COLUMN "chat_messages"."role" IS 'USER: user\nASSISTANT: assistant\nSYSTEM: system';
COMMENT ON TABLE "chat_messages" IS '채팅 개별 메시지.';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        """


MODELS_STATE = (
    "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"
)
