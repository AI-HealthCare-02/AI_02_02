"""사용자 설정 모델."""

from tortoise import fields, models


class UserSettings(models.Model):
    """사용자 설정의 최신 상태 (1인당 1행)."""

    id = fields.BigIntField(primary_key=True)
    user = fields.OneToOneField(
        "models.User", related_name="settings", on_delete=fields.CASCADE
    )

    nickname = fields.CharField(max_length=30, null=True)
    chat_notification = fields.BooleanField(default=True)
    morning_reminder = fields.BooleanField(default=True)
    evening_reminder = fields.BooleanField(default=True)
    challenge_reminder = fields.BooleanField(default=True)
    weekly_report = fields.BooleanField(default=True)
    reminder_time_morning = fields.TimeField(null=True)
    reminder_time_evening = fields.TimeField(null=True)
    health_question_interval_minutes = fields.SmallIntField(default=90)
    max_bundles_per_day = fields.SmallIntField(default=5)
    preferred_times = fields.JSONField(default=list)  # ["morning", "evening"]
    theme_preference = fields.CharField(max_length=10, default="light")
    last_exported_at = fields.DatetimeField(null=True)

    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "user_settings"
