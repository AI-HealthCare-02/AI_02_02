"""온보딩 API 요청/응답 DTO."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.enums import (
    AgeRange,
    AiConsent,
    AlcoholFrequency,
    ConditionType,
    DietHabitType,
    ExerciseFrequency,
    FamilyHistory,
    FastingGlucoseRange,
    GoalType,
    HbA1cRange,
    Relation,
    SleepDurationBucket,
    SmokingStatus,
    TreatmentType,
)
from app.models.users import Gender


class ConsentRequest(BaseModel):
    """이용약관 동의 요청."""

    model_config = {
        "json_schema_extra": {
            "example": {
                "terms_of_service": True,
                "privacy_policy": True,
                "health_data_consent": True,
                "disclaimer_consent": True,
                "marketing_consent": False,
            }
        }
    }

    terms_of_service: bool
    privacy_policy: bool
    health_data_consent: bool
    disclaimer_consent: bool
    marketing_consent: bool = False

    @model_validator(mode="after")
    def check_required_consents(self) -> "ConsentRequest":
        required = [
            "terms_of_service",
            "privacy_policy",
            "health_data_consent",
            "disclaimer_consent",
        ]
        for field_name in required:
            if not getattr(self, field_name):
                raise ValueError(f"{field_name}은(는) 반드시 동의해야 합니다.")
        return self


class ConsentResponse(BaseModel):
    """동의 저장 응답."""

    consented_at: datetime


class SurveyRequest(BaseModel):
    """건강 설문 요청."""

    model_config = {
        "json_schema_extra": {
            "example": {
                "relation": "prevention",
                "gender": "MALE",
                "age_range": "45_54",
                "height_cm": 175.0,
                "weight_kg": 80.0,
                "family_history": "parents",
                "conditions": ["hypertension"],
                "exercise_frequency": "1_2_per_week",
                "diet_habits": ["irregular_meals"],
                "sleep_duration_bucket": "between_6_7",
                "alcohol_frequency": "sometimes",
                "smoking_status": "non_smoker",
                "goals": ["weight_management"],
                "ai_consent": "agreed",
            }
        }
    }

    relation: Relation
    gender: Gender
    age_range: AgeRange
    height_cm: Annotated[float, Field(gt=100, le=250)]
    weight_kg: Annotated[float, Field(gt=30, le=200)]
    family_history: FamilyHistory
    conditions: Annotated[list[str], Field(default_factory=list, max_length=10)]
    treatments: list[str] | None = None
    hba1c_range: HbA1cRange | None = None
    fasting_glucose_range: FastingGlucoseRange | None = None
    exercise_frequency: ExerciseFrequency
    diet_habits: list[str] = Field(default_factory=list)
    sleep_duration_bucket: SleepDurationBucket
    alcohol_frequency: AlcoholFrequency
    smoking_status: SmokingStatus
    goals: list[str] = Field(default_factory=list)
    ai_consent: AiConsent

    @field_validator("gender", mode="before")
    @classmethod
    def normalize_gender(cls, v: str) -> str:
        """프론트에서 'male' 소문자로 보낼 수 있으므로 대문자로 변환."""
        return v.upper() if isinstance(v, str) else v

    @field_validator("conditions", mode="before")
    @classmethod
    def validate_conditions(cls, v: list[str]) -> list[str]:
        valid = {e.value for e in ConditionType}
        for item in v:
            if item not in valid:
                raise ValueError(f"Invalid condition: {item}. Must be one of {sorted(valid)}")
        return v

    @field_validator("diet_habits", mode="before")
    @classmethod
    def validate_diet_habits(cls, v: list[str]) -> list[str]:
        valid = {e.value for e in DietHabitType}
        for item in v:
            if item not in valid:
                raise ValueError(f"Invalid diet_habit: {item}. Must be one of {sorted(valid)}")
        return v

    @field_validator("goals", mode="before")
    @classmethod
    def validate_goals(cls, v: list[str]) -> list[str]:
        valid = {e.value for e in GoalType}
        for item in v:
            if item not in valid:
                raise ValueError(f"Invalid goal: {item}. Must be one of {sorted(valid)}")
        return v

    @field_validator("treatments", mode="before")
    @classmethod
    def validate_treatments(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        valid = {e.value for e in TreatmentType}
        for item in v:
            if item not in valid:
                raise ValueError(f"Invalid treatment: {item}. Must be one of {sorted(valid)}")
        return v


class SurveyResponse(BaseModel):
    """설문 저장 응답."""

    health_profile_id: int
    user_group: str
    bmi: float
    initial_findrisc_score: int
    initial_risk_level: str
    message: str


class OnboardingStatusResponse(BaseModel):
    """온보딩 상태 확인 응답."""

    is_completed: bool
    completed_at: datetime | None = None
    user_group: str | None = None
