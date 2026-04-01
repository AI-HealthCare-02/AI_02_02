from tortoise import fields, models

from app.domains.challenges.enums import BadgeType, ChallengeCategory, ChallengeStatus, CheckinJudgeType, CheckinStatus


class TimestampedModel(models.Model):
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        abstract = True


class ChallengeTemplate(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    name = fields.CharField(max_length=50)
    category = fields.CharEnumField(ChallengeCategory)
    description = fields.CharField(max_length=200)
    goal_criteria = fields.JSONField(default=dict)
    duration_days = fields.IntField(default=7)
    evidence_summary = fields.CharField(max_length=255, null=True)
    risk_factor = fields.CharField(max_length=50, null=True)
    for_groups = fields.JSONField(default=list)
    is_active = fields.BooleanField(default=True)

    class Meta:
        table = "challenge_templates"


class UserChallenge(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField("models.User", related_name="user_challenges", on_delete=fields.CASCADE)
    template = fields.ForeignKeyField(
        "models.ChallengeTemplate",
        related_name="participants",
        on_delete=fields.CASCADE,
    )
    status = fields.CharEnumField(ChallengeStatus, default=ChallengeStatus.ACTIVE)
    started_at = fields.DatetimeField()
    target_end_date = fields.DateField(null=True)
    completed_at = fields.DatetimeField(null=True)
    current_streak = fields.IntField(default=0)
    best_streak = fields.IntField(default=0)
    progress_pct = fields.DecimalField(max_digits=5, decimal_places=2, default=0)
    daily_log = fields.JSONField(null=True)
    notes = fields.CharField(max_length=255, null=True)

    class Meta:
        table = "user_challenges"


class ChallengeCheckin(TimestampedModel):
    id = fields.BigIntField(primary_key=True)
    user_challenge = fields.ForeignKeyField(
        "models.UserChallenge",
        related_name="checkins",
        on_delete=fields.CASCADE,
    )
    checkin_date = fields.DateField()
    status = fields.CharEnumField(CheckinStatus)
    judged_by = fields.CharEnumField(CheckinJudgeType)
    source_field_keys = fields.JSONField(default=list)
    note = fields.CharField(max_length=255, null=True)

    class Meta:
        table = "challenge_checkins"
        unique_together = (("user_challenge_id", "checkin_date"),)


class UserBadge(models.Model):
    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField("models.User", related_name="badges", on_delete=fields.CASCADE)
    badge_type = fields.CharEnumField(BadgeType)
    earned_at = fields.DatetimeField(auto_now_add=True)
    context = fields.JSONField(null=True)

    class Meta:
        table = "user_badges"
