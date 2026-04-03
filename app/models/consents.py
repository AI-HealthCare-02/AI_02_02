"""사용자 동의 정보 모델."""

from tortoise import fields, models


class UserConsent(models.Model):
    """회원의 최신 동의 상태 (1인당 1행)."""

    id = fields.BigIntField(primary_key=True)
    user = fields.OneToOneField(
        "models.User", related_name="consent", on_delete=fields.CASCADE
    )
    terms_of_service = fields.BooleanField()
    privacy_policy = fields.BooleanField()
    health_data_consent = fields.BooleanField()
    disclaimer_consent = fields.BooleanField()
    marketing_consent = fields.BooleanField(default=False)
    consented_at = fields.DatetimeField()
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "user_consents"
