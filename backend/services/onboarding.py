"""온보딩 서비스 — 동의 저장, 설문 제출, 상태 확인.

흐름: 동의(consent) → 설문(survey) → 상태확인(status)
설문 시 서버가 자동 계산: user_group, BMI, FINDRISC 점수
"""

from datetime import datetime

from fastapi import HTTPException, status
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
from backend.services.prediction import calculate_initial_findrisc

# ── relation → user_group 매핑 ──
RELATION_TO_GROUP: dict[str, UserGroup] = {
    "diagnosed": UserGroup.A,
    "prediabetes": UserGroup.B,
    "family": UserGroup.C,
    "curious": UserGroup.C,
    "prevention": UserGroup.C,
}

# ── age_range → 대표 나이 (FINDRISC 계산용) ──
AGE_RANGE_TO_NUMERIC: dict[str, int] = {
    "under_45": 40,
    "45_54": 50,
    "55_64": 60,
    "65_plus": 70,
}


class OnboardingService:
    """온보딩 비즈니스 로직."""

    async def save_consent(
        self, user_id: int, data: ConsentRequest
    ) -> ConsentResponse:
        """이용약관 동의 저장."""
        existing = await UserConsent.get_or_none(user_id=user_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 동의 정보가 저장되어 있습니다.",
            )

        now = datetime.now(tz=config.TIMEZONE)
        consent = await UserConsent.create(
            user_id=user_id,
            terms_of_service=data.terms_of_service,
            privacy_policy=data.privacy_policy,
            health_data_consent=data.health_data_consent,
            disclaimer_consent=data.disclaimer_consent,
            marketing_consent=data.marketing_consent,
            consented_at=now,
        )
        return ConsentResponse(consented_at=consent.consented_at)

    async def update_consent(
        self, user_id: int, data: ConsentUpdateRequest
    ) -> ConsentDetailResponse:
        """기존 동의 상태 부분 수정."""
        consent = await UserConsent.get_or_none(user_id=user_id)
        if not consent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="동의 정보가 없습니다. 먼저 최초 동의를 완료해주세요.",
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

    async def submit_survey(
        self, user_id: int, data: SurveyRequest
    ) -> SurveyResponse:
        """건강 설문 저장 + BMI·FINDRISC 자동 계산."""
        # 1. 동의 확인
        consent = await UserConsent.get_or_none(user_id=user_id)
        if not consent:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="동의 정보가 없습니다. 먼저 동의를 완료해주세요.",
            )

        # 2. 중복 체크
        existing = await HealthProfile.get_or_none(user_id=user_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 온보딩이 완료되었습니다.",
            )

        # 3. 파생값 계산
        user_group = RELATION_TO_GROUP[data.relation]
        bmi = round(data.weight_kg / (data.height_cm / 100) ** 2, 1)
        has_hypertension = "hypertension" in data.conditions
        has_high_glucose = "high_glucose" in data.conditions
        numeric_age = AGE_RANGE_TO_NUMERIC[data.age_range]
        is_male = data.gender == "MALE"

        # 4. FINDRISC 계산
        findrisc = calculate_initial_findrisc(
            age=numeric_age,
            bmi=bmi,
            is_male=is_male,
            exercise_frequency=data.exercise_frequency,
            eats_vegetables_daily=None,  # 온보딩에서 미수집 → 1점 (보수적)
            has_hypertension=has_hypertension,
            has_high_glucose_history=has_high_glucose,
            family_history=data.family_history,
        )

        # 5. DB 저장 (트랜잭션)
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
            message="온보딩이 완료되었습니다! 🎉",
        )

    async def get_status(self, user_id: int) -> OnboardingStatusResponse:
        """온보딩 완료 여부 확인."""
        profile = await HealthProfile.get_or_none(user_id=user_id)
        if profile:
            return OnboardingStatusResponse(
                is_completed=True,
                completed_at=profile.created_at,
                user_group=profile.user_group,
                gender=profile.gender,
                age_range=profile.age_range,
                bmi=profile.bmi,
            )
        return OnboardingStatusResponse(is_completed=False)
