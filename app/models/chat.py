"""AI 채팅 세션 · 메시지 모델."""

from enum import StrEnum

from tortoise import fields, models


class MessageRole(StrEnum):
    """채팅 메시지 역할."""

    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatSession(models.Model):
    """채팅 대화 세션 (사용자당 여러 개)."""

    id = fields.BigIntField(primary_key=True)
    user = fields.ForeignKeyField(
        "models.User", related_name="chat_sessions", on_delete=fields.CASCADE
    )
    title = fields.CharField(max_length=100, default="")
    is_active = fields.BooleanField(default=True)
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "chat_sessions"
        indexes = (("user", "is_active"),)


class ChatMessage(models.Model):
    """채팅 개별 메시지."""

    id = fields.BigIntField(primary_key=True)
    session = fields.ForeignKeyField(
        "models.ChatSession", related_name="messages", on_delete=fields.CASCADE
    )
    role = fields.CharEnumField(enum_type=MessageRole)
    content = fields.TextField()
    has_health_questions = fields.BooleanField(default=False)
    bundle_keys = fields.JSONField(null=True)
    created_at = fields.DatetimeField(auto_now_add=True)

    class Meta:
        table = "chat_messages"
        indexes = (("session", "created_at"),)
