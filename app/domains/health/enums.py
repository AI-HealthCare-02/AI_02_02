from enum import StrEnum


class UserGroup(StrEnum):
    A = "A"
    B = "B"
    C = "C"


class RelationType(StrEnum):
    DIABETES = "diabetes"
    PREDIABETES = "prediabetes"
    FAMILY_HISTORY = "family_history"


class AiConsentStatus(StrEnum):
    AGREED = "agreed"
    DECLINED = "declined"


class SleepQuality(StrEnum):
    VERY_GOOD = "very_good"
    GOOD = "good"
    NORMAL = "normal"
    BAD = "bad"
    VERY_BAD = "very_bad"


class SleepDurationBucket(StrEnum):
    UNDER_5 = "under_5"
    BETWEEN_5_6 = "between_5_6"
    BETWEEN_6_7 = "between_6_7"
    BETWEEN_7_8 = "between_7_8"
    OVER_8 = "over_8"


class MealStatus(StrEnum):
    HEARTY = "hearty"
    SIMPLE = "simple"
    SKIPPED = "skipped"


class VegetableIntakeLevel(StrEnum):
    ENOUGH = "enough"
    LITTLE = "little"
    NONE = "none"


class MealBalanceLevel(StrEnum):
    BALANCED = "balanced"
    CARB_HEAVY = "carb_heavy"
    PROTEIN_VEG_HEAVY = "protein_veg_heavy"


class SweetdrinkLevel(StrEnum):
    NONE = "none"
    ONE = "one"
    TWO_PLUS = "two_plus"


class ExerciseType(StrEnum):
    WALKING = "walking"
    RUNNING = "running"
    CYCLING = "cycling"
    SWIMMING = "swimming"
    GYM = "gym"
    HOME_WORKOUT = "home_workout"
    OTHER = "other"


class NightsnackLevel(StrEnum):
    NONE = "none"
    LIGHT = "light"
    HEAVY = "heavy"


class MoodLevel(StrEnum):
    VERY_GOOD = "very_good"
    GOOD = "good"
    NORMAL = "normal"
    STRESSED = "stressed"
    VERY_STRESSED = "very_stressed"


class AlcoholAmountLevel(StrEnum):
    LIGHT = "light"
    MODERATE = "moderate"
    HEAVY = "heavy"


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
    CHOLESTEROL_TOTAL = "cholesterol_total"
    CHOLESTEROL_LDL = "cholesterol_ldl"
    CHOLESTEROL_HDL = "cholesterol_hdl"


class MeasurementSource(StrEnum):
    MANUAL = "manual"
    IMPORT = "import"
    MEDICAL_CHECKUP = "medical_checkup"


class RiskPeriodType(StrEnum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"


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
