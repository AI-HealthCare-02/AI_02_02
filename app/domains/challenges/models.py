from tortoise import fields

from app.domains.challenges.enums import (
    ChallengeCategory,
    ChallengePhase,
    ChallengeSelectionSource,
    ChallengeStatus,
    CheckinJudgeType,
    CheckinStatus,
)
from app.domains.common.models import TimestampedModel


class ChallengeTemplate(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    code = fields.CharField(max_length=50, unique=True)
    name = fields.CharField(max_length=50)
    emoji = fields.CharField(max_length=10)
    category = fields.CharEnumField(ChallengeCategory)
    description = fields.CharField(max_length=255)
    goal_criteria = fields.JSONField(default=dict)
    default_duration_days = fields.IntField(default=14)
    evidence_summary = fields.CharField(max_length=255, null=True)
    for_groups = fields.JSONField(default=list)
    phase = fields.CharEnumField(ChallengePhase, default=ChallengePhase.DAILY)
    sort_order = fields.IntField(default=0)
    is_active = fields.BooleanField(default=True)

    class Meta:
        table = "challenge_templates"


class UserChallenge(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField("models.User", related_name="user_challenges", on_delete=fields.CASCADE)
    template = fields.ForeignKeyField("models.ChallengeTemplate", related_name="participants", on_delete=fields.CASCADE)
    selection_source = fields.CharEnumField(ChallengeSelectionSource)
    status = fields.CharEnumField(ChallengeStatus, default=ChallengeStatus.ACTIVE)
    started_at = fields.DateField()
    ends_at = fields.DateField(null=True)
    completed_at = fields.DatetimeField(null=True)
    current_streak = fields.IntField(default=0)
    best_streak = fields.IntField(default=0)
    progress_pct = fields.DecimalField(max_digits=5, decimal_places=2, default=0)
    target_days = fields.IntField(default=14)
    days_completed = fields.IntField(default=0)
    today_checked = fields.BooleanField(default=False)
    daily_log = fields.JSONField(null=True)

    class Meta:
        table = "user_challenges"


class ChallengeCheckin(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    user_challenge = fields.ForeignKeyField("models.UserChallenge", related_name="checkins", on_delete=fields.CASCADE)
    checkin_date = fields.DateField()
    status = fields.CharEnumField(CheckinStatus)
    judged_by = fields.CharEnumField(CheckinJudgeType)
    source_field_keys = fields.JSONField(default=list)
    source_period = fields.CharField(max_length=20, null=True)
    note = fields.CharField(max_length=255, null=True)

    class Meta:
        table = "challenge_checkins"
        unique_together = (("user_challenge_id", "checkin_date"),)
