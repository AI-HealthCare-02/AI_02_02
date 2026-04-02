from app.domains.health.enums import RelationType, RiskLevel, UserGroup
from app.domains.health.schemas import OnboardingStatusResponse, OnboardingSurveyRequest, OnboardingSurveyResponse
from app.domains.onboarding.repository import OnboardingRepository
from app.models.users import User
from app.services.jwt import JwtService


class OnboardingService:
    """Application service for relation -> user_group onboarding flow."""

    def __init__(self, repository: OnboardingRepository | None = None) -> None:
        self.repository = repository or OnboardingRepository()

    def resolve_user_group(self, relation: str) -> UserGroup:
        mapping = {
            RelationType.DIABETES.value: UserGroup.A,
            RelationType.PREDIABETES.value: UserGroup.B,
            RelationType.FAMILY_HISTORY.value: UserGroup.C,
        }
        return mapping.get(relation, UserGroup.C)

    def calculate_bmi(self, height_cm: float, weight_kg: float) -> float:
        return round(weight_kg / ((height_cm / 100) ** 2), 1)

    def calculate_findrisc_score(self, request: OnboardingSurveyRequest) -> int:
        score = 0
        age_scores = {
            "under_45": 0,
            "45_54": 2,
            "55_64": 3,
            "65_plus": 4,
        }
        family_scores = {
            "none": 0,
            "grandparent_aunt_uncle_cousin": 3,
            "parent_or_sibling": 5,
        }
        bmi = self.calculate_bmi(request.height_cm, request.weight_kg)
        score += age_scores.get(request.age_range, 0)
        score += family_scores.get(request.family_history, 0)
        if bmi >= 30:
            score += 3
        elif bmi >= 25:
            score += 1
        if "hypertension" in request.conditions:
            score += 2
        if "high_glucose_history" in request.conditions:
            score += 5
        if request.exercise_frequency == "less_than_4h":
            score += 2
        if "low_vegetable_intake" in request.diet_habits:
            score += 1
        return score

    def resolve_risk_level(self, score: int) -> RiskLevel:
        if score < 7:
            return RiskLevel.LOW
        if score < 12:
            return RiskLevel.SLIGHT
        if score < 15:
            return RiskLevel.MODERATE
        if score < 21:
            return RiskLevel.HIGH
        return RiskLevel.VERY_HIGH

    async def complete_survey(
        self,
        user: User,
        request: OnboardingSurveyRequest,
        jwt_service: JwtService,
    ) -> OnboardingSurveyResponse:
        user_group = self.resolve_user_group(request.relation)
        bmi = self.calculate_bmi(request.height_cm, request.weight_kg)
        initial_findrisc_score = self.calculate_findrisc_score(request)
        initial_risk_level = self.resolve_risk_level(initial_findrisc_score)
        access_token = jwt_service.create_access_token(user)
        access_token.payload["user_group"] = user_group

        health_profile_id = await self.repository.save_survey_result(
            user_id=user.id,
            payload=request.model_dump(mode="python") | {"user_group": user_group, "bmi": bmi},
        )
        return OnboardingSurveyResponse(
            health_profile_id=health_profile_id,
            user_group=user_group,
            bmi=bmi,
            initial_findrisc_score=initial_findrisc_score,
            initial_risk_level=initial_risk_level,
            access_token=str(access_token),
            message="온보딩이 완료되었습니다.",
        )

    async def get_status(self, user_id: int, user_group: str | None) -> OnboardingStatusResponse:
        is_completed, completed_at = await self.repository.get_completed_status(user_id)
        resolved_group = UserGroup(user_group) if user_group else None
        return OnboardingStatusResponse(
            is_completed=is_completed,
            completed_at=completed_at,
            user_group=resolved_group,
        )
