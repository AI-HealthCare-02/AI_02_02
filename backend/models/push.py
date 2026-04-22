from __future__ import annotations

import secrets

from tortoise import fields, models


def _action_token() -> str:
    return secrets.token_urlsafe(32)


class PushSubscription(models.Model):
    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField("models.User", related_name="push_subscriptions", on_delete=fields.CASCADE)
    endpoint = fields.CharField(max_length=500, unique=True)
    p256dh = fields.TextField()
    auth = fields.TextField()
    action_token = fields.CharField(max_length=96, unique=True, default=_action_token)
    is_active = fields.BooleanField(default=True)
    muted_until = fields.DatetimeField(null=True)
    disabled_at = fields.DatetimeField(null=True)
    last_sent_at = fields.DatetimeField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "push_subscriptions"
