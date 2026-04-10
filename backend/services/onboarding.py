from datetime import datetime

from fastapi import HTTPException, status
from tortoise.exceptions import IntegrityError
from tortoise.transactions import in_transaction

from backend.core import config
from backend.dtos.onboarding import (
    ConsentDetailResponse,
    ConsentRequest,
    ConsentResponse,
    ConsentUpdateRequest,
    OnboardingStatusResponse,
    SurveyRequest,
    SurveyResponse,
)
from backend.models.assessments import UserEngagement
from backend.models.consents import UserConsent
from backend.models.enums import EngagementState, UserGroup
from backend.models.health import HealthProfile
from backend.models.users import User
from backend.services.prediction import calculate_initial_findrisc

RELATION_TO_GROUP: dict[str, UserGroup] = {
    "diagnosed": UserGroup.A,
    "prediabetes": UserGroup.B,
    "family": UserGroup.C,
    "curious": UserGroup.C,
    "prevention": UserGroup.C,
}

AGE_RANGE_TO_NUMERIC: dict[str, int] = {
    "under_45": 40,
    "45_54": 50,
    "55_64": 60,
    "65_plus": 70,
}


class OnboardingService:
    async def save_consent(self, user_id: int, data: ConsentRequest) -> ConsentResponse:
        now = datetime.now(tz=config.TIMEZONE)
        consent = await UserConsent.get_or_none(user_id=user_id)
        if consent:
            consent.terms_of_service = data.terms_of_service
            consent.privacy_policy = data.privacy_policy
            consent.health_data_consent = data.health_data_consent
            consent.disclaimer_consent = data.disclaimer_consent
            consent.marketing_consent = data.marketing_consent
            consent.consented_at = now
            await consent.save(
                update_fields=[
                    "terms_of_service",
                    "privacy_policy",
                    "health_data_consent",
                    "disclaimer_consent",
                    "marketing_consent",
                    "consented_at",
                    "updated_at",
                ]
            )
            return ConsentResponse(consented_at=consent.consented_at)

        try:
            consent = await UserConsent.create(
                user_id=user_id,
                terms_of_service=data.terms_of_service,
                privacy_policy=data.privacy_policy,
                health_data_consent=data.health_data_consent,
                disclaimer_consent=data.disclaimer_consent,
                marketing_consent=data.marketing_consent,
                consented_at=now,
            )
        except IntegrityError:
            consent = await UserConsent.get_or_none(user_id=user_id)
            if not consent:
                raise
        return ConsentResponse(consented_at=consent.consented_at)

    async def update_consent(self, user_id: int, data: ConsentUpdateRequest) -> ConsentDetailResponse:
        consent = await UserConsent.get_or_none(user_id=user_id)
        if not consent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Consent not found. Please complete consent first.",
            )

        payload = data.model_dump(exclude_none=True)
        for field_name, value in payload.items():
            setattr(consent, field_name, value)

        await consent.save(update_fields=[*payload.keys(), "updated_at"])
        return ConsentDetailResponse(
            terms_of_service=consent.terms_of_service,
            privacy_policy=consent.privacy_policy,
            health_data_consent=consent.health_data_consent,
            disclaimer_consent=consent.disclaimer_consent,
            marketing_consent=consent.marketing_consent,
            consented_at=consent.consented_at,
            updated_at=consent.updated_at,
        )

    async def get_consent(self, user_id: int) -> ConsentDetailResponse:
        consent = await UserConsent.get_or_none(user_id=user_id)
        if not consent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Consent not found. Please complete consent first.",
            )
        return ConsentDetailResponse(
            terms_of_service=consent.terms_of_service,
            privacy_policy=consent.privacy_policy,
            health_data_consent=consent.health_data_consent,
            disclaimer_consent=consent.disclaimer_consent,
            marketing_consent=consent.marketing_consent,
            consented_at=consent.consented_at,
            updated_at=consent.updated_at,
        )

    async def submit_survey(self, user_id: int, data: SurveyRequest) -> SurveyResponse:
        consent = await UserConsent.get_or_none(user_id=user_id)
        if not consent:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Consent is required before survey submission.",
            )
        if not consent.health_data_consent:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Health data consent is required before survey submission.",
            )

        existing = await HealthProfile.get_or_none(user_id=user_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Onboarding already completed.",
            )

        user_group = RELATION_TO_GROUP[data.relation]
        bmi = round(data.weight_kg / (data.height_cm / 100) ** 2, 1)
        has_hypertension = "hypertension" in data.conditions
        has_high_glucose = "high_glucose" in data.conditions
        numeric_age = AGE_RANGE_TO_NUMERIC[data.age_range]
        is_male = data.gender == "MALE"

        findrisc = calculate_initial_findrisc(
            age=numeric_age,
            bmi=bmi,
            is_male=is_male,
            exercise_frequency=data.exercise_frequency,
            eats_vegetables_daily=None,
            has_hypertension=has_hypertension,
            has_high_glucose_history=has_high_glucose,
            family_history=data.family_history,
        )

        now = datetime.now(tz=config.TIMEZONE)
        async with in_transaction():
            profile = await HealthProfile.create(
                user_id=user_id,
                relation=data.relation,
                user_group=user_group,
                gender=data.gender,
                age_range=data.age_range,
                height_cm=data.height_cm,
                weight_kg=data.weight_kg,
                bmi=bmi,
                family_history=data.family_history,
                conditions=data.conditions,
                has_hypertension=has_hypertension,
                has_high_glucose_history=has_high_glucose,
                treatments=data.treatments,
                hba1c_range=data.hba1c_range,
                fasting_glucose_range=data.fasting_glucose_range,
                exercise_frequency=data.exercise_frequency,
                diet_habits=data.diet_habits,
                sleep_duration_bucket=data.sleep_duration_bucket,
                alcohol_frequency=data.alcohol_frequency,
                smoking_status=data.smoking_status,
                goals=data.goals,
                ai_consent=data.ai_consent,
                initial_findrisc_score=findrisc.total_score,
                initial_risk_level=findrisc.risk_level,
            )
            await User.filter(id=user_id).update(
                onboarding_completed=True,
                onboarding_completed_at=now,
                updated_at=now,
            )
            await UserEngagement.get_or_create(
                user_id=user_id,
                defaults={"state": EngagementState.ACTIVE},
            )

        return SurveyResponse(
            health_profile_id=profile.id,
            user_group=user_group,
            bmi=bmi,
            initial_findrisc_score=findrisc.total_score,
            initial_risk_level=findrisc.risk_level,
            message="Onboarding completed.",
        )

    async def get_status(self, user_id: int) -> OnboardingStatusResponse:
        user = await User.get_or_none(id=user_id)
        profile = await HealthProfile.get_or_none(user_id=user_id)
        if user and (user.onboarding_completed or profile):
            return OnboardingStatusResponse(
                is_completed=True,
                completed_at=user.onboarding_completed_at or (profile.created_at if profile else None),
                user_group=profile.user_group if profile else None,
                gender=profile.gender if profile else None,
                age_range=profile.age_range if profile else None,
                bmi=profile.bmi if profile else None,
            )
        return OnboardingStatusResponse(is_completed=False)
