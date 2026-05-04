"""Do it OS 모델 — DoitThought."""

from tortoise import fields, models


class DoitThought(models.Model):
    """사용자의 생각 한 단위.

    카테고리별 sparse 필드 전략 — 단일 테이블로 todo/schedule/project/note/health/waiting/someday를 모두 표현.
    id는 프론트 생성값 't-{timestamp}-{random}'을 그대로 사용해 localStorage → DB 마이그레이션 충돌 방지.
    """

    id = fields.CharField(max_length=40, primary_key=True)
    user = fields.ForeignKeyField("models.User", related_name="doit_thoughts", on_delete=fields.CASCADE)

    # 공통
    text = fields.TextField(default="")
    category = fields.CharField(max_length=20, null=True)
    created_at = fields.DatetimeField()
    classified_at = fields.DatetimeField(null=True)
    discarded_at = fields.DatetimeField(null=True)
    completed_at = fields.DatetimeField(null=True)

    # 캔버스 UI
    canvas_x = fields.FloatField(null=True)
    canvas_y = fields.FloatField(null=True)
    rotation = fields.SmallIntField(default=0)
    color = fields.CharField(max_length=20, null=True)
    card_width = fields.SmallIntField(null=True)
    card_height = fields.SmallIntField(null=True)

    # schedule / todo
    scheduled_date = fields.DateField(null=True)
    scheduled_time = fields.TimeField(null=True)
    schedule_note = fields.TextField(null=True)
    planned_date = fields.DateField(null=True)

    # project
    description = fields.TextField(null=True)
    next_action = fields.TextField(null=True)
    project_status = fields.CharField(max_length=20, null=True)
    project_link_id = fields.CharField(max_length=40, null=True)

    # note
    note_body = fields.TextField(null=True)

    # 분류 흐름 { actionable, decision, source }
    clarification = fields.JSONField(default=dict)

    # 자기 전 리추얼 { ritualDate, action }
    end_of_day = fields.JSONField(default=dict)

    # 기타
    waiting_for = fields.TextField(null=True)
    someday_reason = fields.TextField(null=True)
    urgency = fields.JSONField(null=True)

    updated_at = fields.DatetimeField(auto_now=True)

    class Meta:
        table = "doit_thoughts"
        indexes = [
            ("user_id", "category"),
            ("user_id", "updated_at"),
        ]
