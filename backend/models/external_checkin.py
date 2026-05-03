"""External AI tool check-in models.

These tables keep Claude Code / Codex CLI access separate from normal web auth.
Only token hashes and server-issued check-in leases are stored.
"""

from tortoise import fields, models


class ExternalDeviceSession(models.Model):
    id = fields.BigIntField(primary_key=True)
    user_code = fields.CharField(max_length=16, unique=True)
    device_code_hash = fields.CharField(max_length=64, unique=True)
    client_name = fields.CharField(max_length=80)
    client_type = fields.CharField(max_length=20, default="unknown")
    scopes = fields.JSONField(default=list)
    status = fields.CharField(max_length=16, default="pending")
    approved_user = fields.ForeignKeyField(
        "models.User",
        related_name="external_device_sessions",
        on_delete=fields.CASCADE,
        null=True,
    )
    approved_at = fields.DatetimeField(null=True)
    expires_at = fields.DatetimeField()
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "external_device_sessions"
        indexes = (("user_code", "status"),)


class ExternalClientToken(models.Model):
    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField(
        "models.User",
        related_name="external_client_tokens",
        on_delete=fields.CASCADE,
    )
    token_hash = fields.CharField(max_length=64, unique=True)
    client_name = fields.CharField(max_length=80)
    client_type = fields.CharField(max_length=20, default="unknown")
    scopes = fields.JSONField(default=list)
    expires_at = fields.DatetimeField()
    revoked_at = fields.DatetimeField(null=True)
    last_used_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "external_client_tokens"
        indexes = (("user", "revoked_at"),)


class ExternalCheckinLease(models.Model):
    id = fields.BigIntField(primary_key=True)
    lease_id = fields.CharField(max_length=64, unique=True)
    user = fields.ForeignKeyField(
        "models.User",
        related_name="external_checkin_leases",
        on_delete=fields.CASCADE,
    )
    token = fields.ForeignKeyField(
        "models.ExternalClientToken",
        related_name="checkin_leases",
        on_delete=fields.CASCADE,
    )
    bundle_key = fields.CharField(max_length=20)
    question_payload = fields.JSONField(default=dict)
    allowed_fields = fields.JSONField(default=list)
    log_date = fields.DateField()
    expires_at = fields.DatetimeField()
    consumed_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "external_checkin_leases"
        indexes = (("user", "log_date"), ("token", "expires_at"))


class ExternalCheckinRequest(models.Model):
    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField(
        "models.User",
        related_name="external_checkin_requests",
        on_delete=fields.CASCADE,
    )
    token = fields.ForeignKeyField(
        "models.ExternalClientToken",
        related_name="checkin_requests",
        on_delete=fields.CASCADE,
    )
    lease = fields.ForeignKeyField(
        "models.ExternalCheckinLease",
        related_name="requests",
        on_delete=fields.SET_NULL,
        null=True,
    )
    idempotency_key = fields.CharField(max_length=128)
    request_hash = fields.CharField(max_length=64)
    response_payload = fields.JSONField(default=dict)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "external_checkin_requests"
        unique_together = (("token", "idempotency_key"),)
