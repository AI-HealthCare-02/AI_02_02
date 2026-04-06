"""챌린지 모델 — ChallengeTemplate · UserChallenge · ChallengeCheckin."""

from tortoise import fields, models

from backend.models.enums import (
    ChallengeCategory,
    ChallengeStatus,
    CheckinJudge,
    CheckinStatus,
    SelectionSource,
)


class ChallengeTemplate(models.Model):
    """챌린지 원본 정의 (마스터 데이터).

    hard delete 대신 is_active=false로 비활성화.
    """

    id = fields.BigIntField(primary_key=True)
    code = fields.CharField(max_length=50, unique=True)
    name = fields.CharField(max_length=100)
    emoji = fields.CharField(max_length=10, default="")
    category = fields.CharEnumField(enum_type=ChallengeCategory)
    description = fields.TextField(default="")
    goal_criteria = fields.JSONField(default=dict)
    default_duration_days = fields.SmallIntField(default=14)
    evidence_summary = fields.TextField(default="")
    for_groups = fields.JSONField(default=list)  # ["A", "B", "C"]
    is_active = fields.BooleanField(default=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "challenge_templates"


class UserChallenge(models.Model):
    """사용자가 참여 중인 챌린지 상태.

    NOTE: 동시 active 최대 2개, 같은 template active 중복 금지
          → 서비스 레이어에서 검증 (ORM 호환성 유지)
    """

    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField(
        "models.User", related_name="challenges", on_delete=fields.CASCADE
    )
    template = fields.ForeignKeyField(
        "models.ChallengeTemplate",
        related_name="user_challenges",
        on_delete=fields.RESTRICT,
    )

    selection_source = fields.CharEnumField(enum_type=SelectionSource)
    status = fields.CharEnumField(
        enum_type=ChallengeStatus, default=ChallengeStatus.ACTIVE
    )

    started_at = fields.DatetimeField()
    ends_at = fields.DatetimeField(null=True)
    completed_at = fields.DatetimeField(null=True)

    current_streak = fields.SmallIntField(default=0)
    best_streak = fields.SmallIntField(default=0)
    progress_pct = fields.DecimalField(max_digits=4, decimal_places=3, default=0)
    target_days = fields.SmallIntField(default=14)
    days_completed = fields.SmallIntField(default=0)
    today_checked = fields.BooleanField(default=False)
    daily_log = fields.JSONField(default=dict)

    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "user_challenges"
        indexes = (("user", "status", "started_at"),)


class ChallengeCheckin(models.Model):
    """챌린지 날짜별 수행 결과 (하루 1건)."""

    id = fields.BigIntField(primary_key=True)
    user_challenge = fields.ForeignKeyField(
        "models.UserChallenge", related_name="checkins", on_delete=fields.CASCADE
    )

    checkin_date = fields.DateField()
    status = fields.CharEnumField(enum_type=CheckinStatus)
    judged_by = fields.CharEnumField(
        enum_type=CheckinJudge, default=CheckinJudge.SYSTEM_AUTO
    )
    source_field_keys = fields.JSONField(default=list)
    source_period = fields.CharField(max_length=20, null=True)
    note = fields.TextField(null=True)

    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "challenge_checkins"
        unique_together = (("user_challenge", "checkin_date"),)
