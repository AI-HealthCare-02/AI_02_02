from tortoise import fields, models


class EmailSignupSession(models.Model):
    id = fields.BigIntField(primary_key=True)
    user_id = fields.BigIntField(null=True, index=True)
    email = fields.CharField(max_length=40, index=True)
    password_hash = fields.CharField(max_length=128)
    name = fields.CharField(max_length=20)
    birthday = fields.DateField(null=True)
    verification_code_hash = fields.CharField(max_length=128)
    expires_at = fields.DatetimeField()
    verified_at = fields.DatetimeField(null=True)
    consumed_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "email_signup_sessions"
