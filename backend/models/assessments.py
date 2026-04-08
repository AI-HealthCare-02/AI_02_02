"""위험도 평가 · 참여 상태 모델."""

from tortoise import fields, models

from backend.models.enums import EngagementState, PeriodType, RiskLevel


class RiskAssessment(models.Model):
    """위험도 계산 결과 · 리포트용 점수.

    FINDRISC 8변수 개별 점수(score_age ~ score_family)를 저장하고,
    risk_badge / overall_grade / coach_summary는 후속 분석 고도화 시
    API 계층에서 계산할 수 있는 후보 값이다.
    """

    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField(
        "models.User", related_name="risk_assessments", on_delete=fields.CASCADE
    )

    # 리포트 기간
    period_type = fields.CharEnumField(enum_type=PeriodType)
    period_start = fields.DateField()
    period_end = fields.DateField()

    # FINDRISC 총점
    findrisc_score = fields.SmallIntField()
    risk_level = fields.CharEnumField(enum_type=RiskLevel)

    # 영역별 점수 (0-100 스케일)
    sleep_score = fields.SmallIntField(null=True)
    diet_score = fields.SmallIntField(null=True)
    exercise_score = fields.SmallIntField(null=True)
    lifestyle_score = fields.SmallIntField(null=True)

    # FINDRISC 8변수 개별 점수
    score_age = fields.SmallIntField(default=0)
    score_bmi = fields.SmallIntField(default=0)
    score_waist = fields.SmallIntField(default=0)
    score_activity = fields.SmallIntField(default=0)
    score_vegetable = fields.SmallIntField(default=0)
    score_hypertension = fields.SmallIntField(default=0)
    score_glucose_history = fields.SmallIntField(default=0)
    score_family = fields.SmallIntField(default=0)

    # 요인 분석
    top_positive_factors = fields.JSONField(default=list)
    top_risk_factors = fields.JSONField(default=list)

    assessed_at = fields.DatetimeField()
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "risk_assessments"
        indexes = (("user", "period_type", "period_end"),)


class UserEngagement(models.Model):
    """사용자 응답 참여 상태 (1인당 1행).

    질문 운영 로직(쿨다운·묶음 횟수)에 사용되는 운영용 데이터.
    """

    id = fields.BigIntField(primary_key=True)
    user = fields.OneToOneField(
        "models.User", related_name="engagement", on_delete=fields.CASCADE
    )

    state = fields.CharEnumField(
        enum_type=EngagementState, default=EngagementState.ACTIVE
    )
    seven_day_response_rate = fields.DecimalField(
        max_digits=4, decimal_places=3, default=0
    )
    consecutive_missed_days = fields.SmallIntField(default=0)
    state_since = fields.DatetimeField(null=True)
    total_responses = fields.IntField(default=0)

    # 질문 운영
    today_bundle_count = fields.SmallIntField(default=0)
    cooldown_until = fields.DatetimeField(null=True)
    last_bundle_key = fields.CharField(max_length=50, null=True)
    last_response_at = fields.DatetimeField(null=True)

    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "user_engagements"
