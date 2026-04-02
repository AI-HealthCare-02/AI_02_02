from enum import StrEnum


class ChallengeCategory(StrEnum):
    EXERCISE = "exercise"
    DIET = "diet"
    SLEEP = "sleep"
    LIFESTYLE = "lifestyle"
    MEDICATION = "medication"


class ChallengePhase(StrEnum):
    ONBOARDING = "onboarding"
    DAILY = "daily"
    REPORT = "report"


class ChallengeSelectionSource(StrEnum):
    SYSTEM_RECOMMENDED = "system_recommended"
    USER_SELECTED = "user_selected"


class ChallengeStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"


class CheckinStatus(StrEnum):
    ACHIEVED = "achieved"
    MISSED = "missed"
    PARTIAL = "partial"


class CheckinJudgeType(StrEnum):
    AUTO = "auto"
    MANUAL = "manual"
