from enum import StrEnum


class ChallengeCategory(StrEnum):
    EXERCISE = "exercise"
    DIET = "diet"
    SLEEP = "sleep"
    LIFESTYLE = "lifestyle"
    MEDICATION = "medication"
    WEIGHT = "weight"


class ChallengeStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class CheckinStatus(StrEnum):
    ACHIEVED = "achieved"
    MISSED = "missed"
    PARTIAL = "partial"


class CheckinJudgeType(StrEnum):
    AUTO = "auto"
    MANUAL = "manual"


class BadgeType(StrEnum):
    FIRST_LOG = "first_log"
    WEEK_STREAK = "week_streak"
    MONTH_STREAK = "month_streak"
    FIRST_CHALLENGE = "first_challenge"
    FIVE_CHALLENGES = "five_challenges"
    EXERCISE_MASTER = "exercise_master"
    DIET_CHAMPION = "diet_champion"
    SLEEP_HERO = "sleep_hero"
    RISK_IMPROVER = "risk_improver"
    PERFECT_WEEK = "perfect_week"
    COMEBACK = "comeback"
    ONBOARDING_COMPLETE = "onboarding_complete"
