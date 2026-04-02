from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS `user_consents` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `terms_of_service` BOOL NOT NULL,
    `privacy_policy` BOOL NOT NULL,
    `health_data_consent` BOOL NOT NULL,
    `disclaimer_consent` BOOL NOT NULL,
    `marketing_consent` BOOL NOT NULL DEFAULT 0,
    `consented_at` DATETIME(6) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL UNIQUE,
    CONSTRAINT `fk_user_con_users_4a5cdd72` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COMMENT='회원의 최신 동의 상태 (1인당 1행).';
        CREATE TABLE IF NOT EXISTS `daily_health_logs` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `log_date` DATE NOT NULL,
    `sleep_quality` VARCHAR(9) COMMENT 'VERY_GOOD: very_good\nGOOD: good\nNORMAL: normal\nBAD: bad\nVERY_BAD: very_bad',
    `sleep_duration_bucket` VARCHAR(11) COMMENT 'UNDER_5: under_5\nBETWEEN_5_6: between_5_6\nBETWEEN_6_7: between_6_7\nBETWEEN_7_8: between_7_8\nOVER_8: over_8',
    `breakfast_status` VARCHAR(7) COMMENT 'HEARTY: hearty\nSIMPLE: simple\nSKIPPED: skipped',
    `lunch_status` VARCHAR(7) COMMENT 'HEARTY: hearty\nSIMPLE: simple\nSKIPPED: skipped',
    `dinner_status` VARCHAR(7) COMMENT 'HEARTY: hearty\nSIMPLE: simple\nSKIPPED: skipped',
    `vegetable_intake_level` VARCHAR(6) COMMENT 'ENOUGH: enough\nLITTLE: little\nNONE: none',
    `meal_balance_level` VARCHAR(17) COMMENT 'BALANCED: balanced\nCARB_HEAVY: carb_heavy\nPROTEIN_VEG_HEAVY: protein_veg_heavy',
    `sweetdrink_level` VARCHAR(8) COMMENT 'NONE: none\nONE: one\nTWO_PLUS: two_plus',
    `exercise_done` BOOL,
    `exercise_type` VARCHAR(12) COMMENT 'WALKING: walking\nRUNNING: running\nCYCLING: cycling\nSWIMMING: swimming\nGYM: gym\nHOME_WORKOUT: home_workout\nOTHER: other',
    `exercise_minutes` SMALLINT,
    `walk_done` BOOL,
    `water_cups` SMALLINT,
    `nightsnack_level` VARCHAR(5) COMMENT 'NONE: none\nLIGHT: light\nHEAVY: heavy',
    `took_medication` BOOL,
    `mood_level` VARCHAR(13) COMMENT 'VERY_GOOD: very_good\nGOOD: good\nNORMAL: normal\nSTRESSED: stressed\nVERY_STRESSED: very_stressed',
    `alcohol_today` BOOL,
    `alcohol_amount_level` VARCHAR(8) COMMENT 'LIGHT: light\nMODERATE: moderate\nHEAVY: heavy',
    `sleep_quality_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `breakfast_status_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `lunch_status_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `dinner_status_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `vegetable_intake_level_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `meal_balance_level_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `sweetdrink_level_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `exercise_done_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `walk_done_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `water_cups_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `nightsnack_level_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `took_medication_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `mood_level_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `alcohol_today_source` VARCHAR(8) COMMENT 'CHAT: chat\nDIRECT: direct\nBACKFILL: backfill',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    UNIQUE KEY `uid_daily_healt_user_id_d68870` (`user_id`, `log_date`),
    CONSTRAINT `fk_daily_he_users_867fdcac` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COMMENT='매일 건강 기록 (1인당 하루 1행).';
        CREATE TABLE IF NOT EXISTS `health_profiles` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `relation` VARCHAR(11) NOT NULL COMMENT 'DIAGNOSED: diagnosed\nPREDIABETES: prediabetes\nFAMILY: family\nCURIOUS: curious\nPREVENTION: prevention',
    `user_group` VARCHAR(1) NOT NULL COMMENT 'A: A\nB: B\nC: C',
    `gender` VARCHAR(6) NOT NULL COMMENT 'MALE: MALE\nFEMALE: FEMALE',
    `age_range` VARCHAR(8) NOT NULL COMMENT 'UNDER_45: under_45\nBETWEEN_45_54: 45_54\nBETWEEN_55_64: 55_64\nOVER_65: 65_plus',
    `height_cm` DOUBLE NOT NULL,
    `weight_kg` DOUBLE NOT NULL,
    `bmi` DOUBLE NOT NULL,
    `family_history` VARCHAR(8) NOT NULL COMMENT 'PARENTS: parents\nSIBLINGS: siblings\nBOTH: both\nNONE: none\nUNKNOWN: unknown',
    `conditions` JSON NOT NULL,
    `has_hypertension` BOOL NOT NULL DEFAULT 0,
    `has_high_glucose_history` BOOL NOT NULL DEFAULT 0,
    `treatments` JSON,
    `hba1c_range` VARCHAR(10) COMMENT 'UNDER_5_7: under_5_7\nRANGE_5_7_6_4: 5_7_to_6_4\nRANGE_6_5_7_0: 6_5_to_7_0\nOVER_7: over_7\nUNKNOWN: unknown',
    `fasting_glucose_range` VARCHAR(10) COMMENT 'UNDER_100: under_100\nRANGE_100_125: 100_to_125\nOVER_126: over_126\nUNKNOWN: unknown',
    `exercise_frequency` VARCHAR(15) NOT NULL COMMENT 'NONE: none\nONE_TO_TWO: 1_2_per_week\nTHREE_TO_FOUR: 3_4_per_week\nFIVE_PLUS: 5_plus_per_week',
    `diet_habits` JSON NOT NULL,
    `sleep_duration_bucket` VARCHAR(11) NOT NULL COMMENT 'UNDER_5: under_5\nBETWEEN_5_6: between_5_6\nBETWEEN_6_7: between_6_7\nBETWEEN_7_8: between_7_8\nOVER_8: over_8',
    `alcohol_frequency` VARCHAR(9) NOT NULL COMMENT 'NONE: none\nSOMETIMES: sometimes\nOFTEN: often\nDAILY: daily',
    `smoking_status` VARCHAR(10) NOT NULL COMMENT 'NON_SMOKER: non_smoker\nFORMER: former\nCURRENT: current',
    `goals` JSON NOT NULL,
    `ai_consent` VARCHAR(8) NOT NULL COMMENT 'AGREED: agreed\nDECLINED: declined',
    `initial_findrisc_score` SMALLINT,
    `initial_risk_level` VARCHAR(9) COMMENT 'LOW: low\nSLIGHT: slight\nMODERATE: moderate\nHIGH: high\nVERY_HIGH: very_high',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL UNIQUE,
    CONSTRAINT `fk_health_p_users_35ba10a2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COMMENT='온보딩 설문 결과 (1인당 1행).';
        CREATE TABLE IF NOT EXISTS `periodic_measurements` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `measurement_type` VARCHAR(15) NOT NULL COMMENT 'WEIGHT: weight\nWAIST: waist\nBLOOD_PRESSURE: blood_pressure\nHBA1C: hba1c\nFASTING_GLUCOSE: fasting_glucose',
    `measured_at` DATETIME(6) NOT NULL,
    `numeric_value` DECIMAL(7,2) NOT NULL,
    `numeric_value_2` DECIMAL(7,2),
    `unit` VARCHAR(20) NOT NULL DEFAULT '',
    `source` VARCHAR(15) NOT NULL COMMENT 'MANUAL: manual\nIMPORT: import\nMEDICAL_CHECKUP: medical_checkup' DEFAULT 'manual',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_periodic_users_51363293` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_periodic_me_user_id_7b6ea6` (`user_id`, `measurement_type`, `measured_at`)
) CHARACTER SET utf8mb4 COMMENT='주기적 측정값 (체중·허리둘레·혈압·HbA1c·공복혈당).';
        CREATE TABLE IF NOT EXISTS `risk_assessments` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `period_type` VARCHAR(9) NOT NULL COMMENT 'WEEKLY: weekly\nMONTHLY: monthly\nQUARTERLY: quarterly',
    `period_start` DATE NOT NULL,
    `period_end` DATE NOT NULL,
    `findrisc_score` SMALLINT NOT NULL,
    `risk_level` VARCHAR(9) NOT NULL COMMENT 'LOW: low\nSLIGHT: slight\nMODERATE: moderate\nHIGH: high\nVERY_HIGH: very_high',
    `sleep_score` SMALLINT,
    `diet_score` SMALLINT,
    `exercise_score` SMALLINT,
    `lifestyle_score` SMALLINT,
    `score_age` SMALLINT NOT NULL DEFAULT 0,
    `score_bmi` SMALLINT NOT NULL DEFAULT 0,
    `score_waist` SMALLINT NOT NULL DEFAULT 0,
    `score_activity` SMALLINT NOT NULL DEFAULT 0,
    `score_vegetable` SMALLINT NOT NULL DEFAULT 0,
    `score_hypertension` SMALLINT NOT NULL DEFAULT 0,
    `score_glucose_history` SMALLINT NOT NULL DEFAULT 0,
    `score_family` SMALLINT NOT NULL DEFAULT 0,
    `top_positive_factors` JSON NOT NULL,
    `top_risk_factors` JSON NOT NULL,
    `assessed_at` DATETIME(6) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_risk_ass_users_5bb5f994` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_risk_assess_user_id_815b5d` (`user_id`, `period_type`, `period_end`)
) CHARACTER SET utf8mb4 COMMENT='위험도 계산 결과 · 리포트용 점수.';
        CREATE TABLE IF NOT EXISTS `user_engagements` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `state` VARCHAR(11) NOT NULL COMMENT 'ACTIVE: ACTIVE\nMODERATE: MODERATE\nLOW: LOW\nDORMANT: DORMANT\nHIBERNATING: HIBERNATING' DEFAULT 'ACTIVE',
    `seven_day_response_rate` DECIMAL(4,3) NOT NULL DEFAULT 0,
    `consecutive_missed_days` SMALLINT NOT NULL DEFAULT 0,
    `state_since` DATETIME(6),
    `total_responses` INT NOT NULL DEFAULT 0,
    `today_bundle_count` SMALLINT NOT NULL DEFAULT 0,
    `cooldown_until` DATETIME(6),
    `last_bundle_key` VARCHAR(50),
    `last_response_at` DATETIME(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL UNIQUE,
    CONSTRAINT `fk_user_eng_users_e78008be` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COMMENT='사용자 응답 참여 상태 (1인당 1행).';
        CREATE TABLE IF NOT EXISTS `challenge_templates` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL UNIQUE,
    `name` VARCHAR(100) NOT NULL,
    `emoji` VARCHAR(10) NOT NULL DEFAULT '',
    `category` VARCHAR(10) NOT NULL COMMENT 'EXERCISE: exercise\nDIET: diet\nSLEEP: sleep\nHYDRATION: hydration\nMEDICATION: medication\nLIFESTYLE: lifestyle',
    `description` LONGTEXT NOT NULL,
    `goal_criteria` JSON NOT NULL,
    `default_duration_days` SMALLINT NOT NULL DEFAULT 14,
    `evidence_summary` LONGTEXT NOT NULL,
    `for_groups` JSON NOT NULL,
    `is_active` BOOL NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) CHARACTER SET utf8mb4 COMMENT='챌린지 원본 정의 (마스터 데이터).';
        CREATE TABLE IF NOT EXISTS `user_challenges` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `selection_source` VARCHAR(18) NOT NULL COMMENT 'SYSTEM_RECOMMENDED: system_recommended\nUSER_SELECTED: user_selected',
    `status` VARCHAR(9) NOT NULL COMMENT 'ACTIVE: active\nPAUSED: paused\nCOMPLETED: completed\nFAILED: failed' DEFAULT 'active',
    `started_at` DATETIME(6) NOT NULL,
    `ends_at` DATETIME(6),
    `completed_at` DATETIME(6),
    `current_streak` SMALLINT NOT NULL DEFAULT 0,
    `best_streak` SMALLINT NOT NULL DEFAULT 0,
    `progress_pct` DECIMAL(4,3) NOT NULL DEFAULT 0,
    `target_days` SMALLINT NOT NULL DEFAULT 14,
    `days_completed` SMALLINT NOT NULL DEFAULT 0,
    `today_checked` BOOL NOT NULL DEFAULT 0,
    `daily_log` JSON NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `template_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_user_cha_challeng_cec12e6b` FOREIGN KEY (`template_id`) REFERENCES `challenge_templates` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_user_cha_users_efa1c2d1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_user_challe_user_id_34ead6` (`user_id`, `status`, `started_at`)
) CHARACTER SET utf8mb4 COMMENT='사용자가 참여 중인 챌린지 상태.';
        CREATE TABLE IF NOT EXISTS `challenge_checkins` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `checkin_date` DATE NOT NULL,
    `status` VARCHAR(8) NOT NULL COMMENT 'ACHIEVED: achieved\nMISSED: missed\nPARTIAL: partial',
    `judged_by` VARCHAR(11) NOT NULL COMMENT 'SYSTEM_AUTO: system_auto\nUSER_MANUAL: user_manual' DEFAULT 'system_auto',
    `source_field_keys` JSON NOT NULL,
    `source_period` VARCHAR(20),
    `note` LONGTEXT,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `user_challenge_id` BIGINT NOT NULL,
    UNIQUE KEY `uid_challenge_c_user_ch_16e315` (`user_challenge_id`, `checkin_date`),
    CONSTRAINT `fk_challeng_user_cha_651df2d5` FOREIGN KEY (`user_challenge_id`) REFERENCES `user_challenges` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COMMENT='챌린지 날짜별 수행 결과 (하루 1건).';
        CREATE TABLE IF NOT EXISTS `user_settings` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `nickname` VARCHAR(30),
    `morning_reminder` BOOL NOT NULL DEFAULT 1,
    `evening_reminder` BOOL NOT NULL DEFAULT 1,
    `challenge_reminder` BOOL NOT NULL DEFAULT 1,
    `weekly_report` BOOL NOT NULL DEFAULT 1,
    `reminder_time_morning` TIME(6),
    `reminder_time_evening` TIME(6),
    `max_bundles_per_day` SMALLINT NOT NULL DEFAULT 5,
    `preferred_times` JSON NOT NULL,
    `last_exported_at` DATETIME(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL UNIQUE,
    CONSTRAINT `fk_user_set_users_9237a864` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COMMENT='사용자 설정의 최신 상태 (1인당 1행).';
        CREATE TABLE IF NOT EXISTS `chat_sessions` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `title` VARCHAR(100) NOT NULL DEFAULT '',
    `is_active` BOOL NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_chat_ses_users_520002c0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_chat_sessio_user_id_1091ca` (`user_id`, `is_active`)
) CHARACTER SET utf8mb4 COMMENT='채팅 대화 세션 (사용자당 여러 개).';
        CREATE TABLE IF NOT EXISTS `chat_messages` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `role` VARCHAR(9) NOT NULL COMMENT 'USER: user\nASSISTANT: assistant\nSYSTEM: system',
    `content` LONGTEXT NOT NULL,
    `has_health_questions` BOOL NOT NULL DEFAULT 0,
    `bundle_keys` JSON,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `session_id` BIGINT NOT NULL,
    CONSTRAINT `fk_chat_mes_chat_ses_0d4a2737` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE,
    KEY `idx_chat_messag_session_fb3c4b` (`session_id`, `created_at`)
) CHARACTER SET utf8mb4 COMMENT='채팅 개별 메시지.';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS `user_engagements`;
        DROP TABLE IF EXISTS `user_consents`;
        DROP TABLE IF EXISTS `challenge_templates`;
        DROP TABLE IF EXISTS `user_challenges`;
        DROP TABLE IF EXISTS `health_profiles`;
        DROP TABLE IF EXISTS `periodic_measurements`;
        DROP TABLE IF EXISTS `challenge_checkins`;
        DROP TABLE IF EXISTS `user_settings`;
        DROP TABLE IF EXISTS `daily_health_logs`;
        DROP TABLE IF EXISTS `chat_messages`;
        DROP TABLE IF EXISTS `chat_sessions`;
        DROP TABLE IF EXISTS `risk_assessments`;"""


MODELS_STATE = (
    "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"
)
