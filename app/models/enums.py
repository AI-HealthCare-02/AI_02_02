"""다나아 건강 데이터 모델용 Enum 정의.

모든 모델이 공유하는 StrEnum을 한 곳에 모아둔다.
기존 Gender(users.py)는 그대로 유지 — 여기서 재정의하지 않는다.
"""

from enum import StrEnum

# ──────────────────────────────────────────────
# 온보딩 / HealthProfile
# ──────────────────────────────────────────────


class Relation(StrEnum):
    """당뇨와의 관계 — 사용자 원본 응답 (user_group 분류 근거)"""

    DIAGNOSED = "diagnosed"
    PREDIABETES = "prediabetes"
    FAMILY = "family"
    CURIOUS = "curious"
    PREVENTION = "prevention"


class UserGroup(StrEnum):
    """서버가 relation으로부터 계산하는 사용자 그룹"""

    A = "A"
    B = "B"
    C = "C"


class AgeRange(StrEnum):
    """연령대 — FINDRISC 점수 구간과 연동"""

    UNDER_45 = "under_45"
    BETWEEN_45_54 = "45_54"
    BETWEEN_55_64 = "55_64"
    OVER_65 = "65_plus"


class FamilyHistory(StrEnum):
    """가족 중 당뇨 여부"""

    PARENTS = "parents"
    SIBLINGS = "siblings"
    BOTH = "both"
    NONE = "none"
    UNKNOWN = "unknown"


class HbA1cRange(StrEnum):
    """당화혈색소 범위 (A·B그룹만)"""

    UNDER_5_7 = "under_5_7"
    RANGE_5_7_6_4 = "5_7_to_6_4"
    RANGE_6_5_7_0 = "6_5_to_7_0"
    OVER_7 = "over_7"
    UNKNOWN = "unknown"


class FastingGlucoseRange(StrEnum):
    """공복혈당 범위 (A·B그룹만)"""

    UNDER_100 = "under_100"
    RANGE_100_125 = "100_to_125"
    OVER_126 = "over_126"
    UNKNOWN = "unknown"


class ExerciseFrequency(StrEnum):
    """운동 빈도 — 온보딩 시 수집"""

    NONE = "none"
    ONE_TO_TWO = "1_2_per_week"
    THREE_TO_FOUR = "3_4_per_week"
    FIVE_PLUS = "5_plus_per_week"


class AlcoholFrequency(StrEnum):
    """음주 빈도 — 온보딩 시 수집"""

    NONE = "none"
    SOMETIMES = "sometimes"
    OFTEN = "often"
    DAILY = "daily"


class SmokingStatus(StrEnum):
    """흡연 상태"""

    NON_SMOKER = "non_smoker"
    FORMER = "former"
    CURRENT = "current"


class AiConsent(StrEnum):
    """AI 이용 동의"""

    AGREED = "agreed"
    DECLINED = "declined"


class GoalType(StrEnum):
    """온보딩 목표 설정"""

    RISK_ASSESSMENT = "risk_assessment"
    HEALTH_TRACKING = "health_tracking"
    DIET_IMPROVEMENT = "diet_improvement"
    EXERCISE_HABIT = "exercise_habit"
    WEIGHT_MANAGEMENT = "weight_management"
    ALL = "all"


class DietHabitType(StrEnum):
    """온보딩 식습관 패턴"""

    CARB_HEAVY = "carb_heavy"
    SUGARY_DRINK = "sugary_drink"
    LATE_SNACK = "late_snack"
    VEGGIES_DAILY = "veggies_daily"
    IRREGULAR_MEALS = "irregular_meals"
    NONE = "none"


class ConditionType(StrEnum):
    """동반 상태 (복수선택)"""

    HYPERTENSION = "hypertension"
    DYSLIPIDEMIA = "dyslipidemia"
    HIGH_GLUCOSE = "high_glucose"
    GESTATIONAL = "gestational"
    NONE = "none"


class TreatmentType(StrEnum):
    """치료 방식 (A그룹, 복수선택)"""

    LIFESTYLE = "lifestyle"
    ORAL_MED = "oral_med"
    INSULIN = "insulin"
    OTHER_MED = "other_med"
    NOTHING = "nothing"


class RiskLevel(StrEnum):
    """FINDRISC 위험도 5단계 (0-26점)"""

    LOW = "low"
    SLIGHT = "slight"
    MODERATE = "moderate"
    HIGH = "high"
    VERY_HIGH = "very_high"


# ──────────────────────────────────────────────
# 매일 건강 기록 (DailyHealthLog)
# ──────────────────────────────────────────────


class SleepQuality(StrEnum):
    """수면의 질"""

    VERY_GOOD = "very_good"
    GOOD = "good"
    NORMAL = "normal"
    BAD = "bad"
    VERY_BAD = "very_bad"


class SleepDurationBucket(StrEnum):
    """수면시간 구간 — 온보딩 + 매일 기록 공용"""

    UNDER_5 = "under_5"
    BETWEEN_5_6 = "between_5_6"
    BETWEEN_6_7 = "between_6_7"
    BETWEEN_7_8 = "between_7_8"
    OVER_8 = "over_8"


class MealStatus(StrEnum):
    """식사 상태 (아침/점심/저녁)"""

    HEARTY = "hearty"
    SIMPLE = "simple"
    SKIPPED = "skipped"


class VegetableIntakeLevel(StrEnum):
    """채소 섭취 수준"""

    ENOUGH = "enough"
    LITTLE = "little"
    NONE = "none"


class MealBalanceLevel(StrEnum):
    """식사 구성 균형"""

    BALANCED = "balanced"
    CARB_HEAVY = "carb_heavy"
    PROTEIN_VEG_HEAVY = "protein_veg_heavy"


class SweetdrinkLevel(StrEnum):
    """당 음료/간식 섭취"""

    NONE = "none"
    ONE = "one"
    TWO_PLUS = "two_plus"


class ExerciseType(StrEnum):
    """운동 종류 — API 최종확정안 기준 7종"""

    WALKING = "walking"
    RUNNING = "running"
    CYCLING = "cycling"
    SWIMMING = "swimming"
    GYM = "gym"
    HOME_WORKOUT = "home_workout"
    OTHER = "other"


class NightsnackLevel(StrEnum):
    """야식 수준"""

    NONE = "none"
    LIGHT = "light"
    HEAVY = "heavy"


class MoodLevel(StrEnum):
    """기분/스트레스"""

    VERY_GOOD = "very_good"
    GOOD = "good"
    NORMAL = "normal"
    STRESSED = "stressed"
    VERY_STRESSED = "very_stressed"


class AlcoholAmountLevel(StrEnum):
    """음주량"""

    LIGHT = "light"
    MODERATE = "moderate"
    HEAVY = "heavy"


class DataSource(StrEnum):
    """데이터 입력 출처"""

    CHAT = "chat"
    DIRECT = "direct"
    BACKFILL = "backfill"


# ──────────────────────────────────────────────
# 주기적 측정값 (PeriodicMeasurement)
# ──────────────────────────────────────────────


class MeasurementType(StrEnum):
    """측정값 종류 — MVP 5종"""

    WEIGHT = "weight"
    WAIST = "waist"
    BLOOD_PRESSURE = "blood_pressure"
    HBA1C = "hba1c"
    FASTING_GLUCOSE = "fasting_glucose"


class MeasurementSource(StrEnum):
    """측정값 입력 출처"""

    MANUAL = "manual"
    IMPORT = "import"
    MEDICAL_CHECKUP = "medical_checkup"


# ──────────────────────────────────────────────
# 위험도 평가 (RiskAssessment)
# ──────────────────────────────────────────────


class PeriodType(StrEnum):
    """리포트 기간 단위"""

    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


# ──────────────────────────────────────────────
# 참여 상태 (UserEngagement)
# ──────────────────────────────────────────────


class EngagementState(StrEnum):
    """사용자 참여 상태 5단계"""

    ACTIVE = "ACTIVE"
    MODERATE = "MODERATE"
    LOW = "LOW"
    DORMANT = "DORMANT"
    HIBERNATING = "HIBERNATING"


# ──────────────────────────────────────────────
# 챌린지
# ──────────────────────────────────────────────


class ChallengeCategory(StrEnum):
    """챌린지 카테고리"""

    EXERCISE = "exercise"
    DIET = "diet"
    SLEEP = "sleep"
    HYDRATION = "hydration"
    MEDICATION = "medication"
    LIFESTYLE = "lifestyle"


class ChallengeStatus(StrEnum):
    """챌린지 참여 상태"""

    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


class CheckinStatus(StrEnum):
    """체크인 결과"""

    ACHIEVED = "achieved"
    MISSED = "missed"
    PARTIAL = "partial"


class CheckinJudge(StrEnum):
    """체크인 판정 주체"""

    SYSTEM_AUTO = "system_auto"
    USER_MANUAL = "user_manual"


class SelectionSource(StrEnum):
    """챌린지 선택 방식"""

    SYSTEM_RECOMMENDED = "system_recommended"
    USER_SELECTED = "user_selected"


# ──────────────────────────────────────────────
# 콘텐츠 필터 (욕설/위기/의료안전)
# ──────────────────────────────────────────────


class FilterExpressionVerdict(StrEnum):
    """표현축 판정 — 욕설/혐오 수준"""

    ALLOW = "allow"
    WARN = "warn"
    BLOCK = "block"


class FilterMedicalAction(StrEnum):
    """의료안전축 판정 — 위기/복약거부 수준"""

    NONE = "none"
    MEDICAL_NOTE = "medical_note"
    CRISIS_ESCALATE = "crisis_escalate"


# ──────────────────────────────────────────────
# 도메인 매핑 상수
# ──────────────────────────────────────────────

# 건강질문 저장 필드 → _source 필드 매핑
FIELD_TO_SOURCE: dict[str, str] = {
    "sleep_quality": "sleep_quality_source",
    "sleep_duration_bucket": "sleep_quality_source",
    "breakfast_status": "breakfast_status_source",
    "lunch_status": "lunch_status_source",
    "dinner_status": "dinner_status_source",
    "vegetable_intake_level": "vegetable_intake_level_source",
    "meal_balance_level": "meal_balance_level_source",
    "sweetdrink_level": "sweetdrink_level_source",
    "exercise_done": "exercise_done_source",
    "exercise_type": "exercise_done_source",
    "exercise_minutes": "exercise_done_source",
    "walk_done": "walk_done_source",
    "water_cups": "water_cups_source",
    "nightsnack_level": "nightsnack_level_source",
    "took_medication": "took_medication_source",
    "mood_level": "mood_level_source",
    "alcohol_today": "alcohol_today_source",
    "alcohol_amount_level": "alcohol_today_source",
}
