from enum import StrEnum


class UserGroup(StrEnum):
    A = "A"
    B = "B"
    C = "C"


class FamilyHistoryLevel(StrEnum):
    NONE = "none"
    SECOND_DEGREE = "second_degree"
    FIRST_DEGREE = "first_degree"


class SleepQuality(StrEnum):
    GREAT = "great"
    GOOD = "good"
    AVERAGE = "average"
    POOR = "poor"
    VERY_POOR = "very_poor"


class MealStatus(StrEnum):
    NONE = "none"
    LIGHT = "light"
    BALANCED = "balanced"
    HEAVY = "heavy"


class FoodComposition(StrEnum):
    BALANCED = "balanced"
    CARB_HEAVY = "carb_heavy"
    PROTEIN_HEAVY = "protein_heavy"
    VEGETABLE_HEAVY = "vegetable_heavy"
    FAST_FOOD = "fast_food"
    SKIPPED = "skipped"


class YesNoUnknown(StrEnum):
    YES = "yes"
    NO = "no"
    UNKNOWN = "unknown"


class ExerciseType(StrEnum):
    WALKING = "walking"
    CARDIO = "cardio"
    STRENGTH = "strength"
    SPORTS = "sports"
    STRETCHING = "stretching"
    OTHER = "other"


class MoodLevel(StrEnum):
    VERY_GOOD = "very_good"
    GOOD = "good"
    NEUTRAL = "neutral"
    LOW = "low"
    VERY_LOW = "very_low"


class DataSource(StrEnum):
    CHAT = "chat"
    DIRECT = "direct"
    BACKFILL = "backfill"


class MeasurementType(StrEnum):
    WEIGHT = "weight"
    WAIST = "waist"
    BLOOD_PRESSURE = "blood_pressure"
    HBA1C = "hba1c"
    FASTING_GLUCOSE = "fasting_glucose"
    CHOLESTEROL = "cholesterol"
    SMOKING_CHANGE = "smoking_change"
    MEDICATION_CHANGE = "medication_change"


class RiskPeriodType(StrEnum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class RiskLevel(StrEnum):
    LOW = "low"
    SLIGHT = "slight"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"


class EngagementState(StrEnum):
    ACTIVE = "ACTIVE"
    MODERATE = "MODERATE"
    LOW = "LOW"
    DORMANT = "DORMANT"
    HIBERNATING = "HIBERNATING"
