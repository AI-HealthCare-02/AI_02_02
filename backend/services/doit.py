"""Do it OS 서비스 — Thought CRUD + AI 요약."""

from __future__ import annotations

from datetime import date, datetime

from fastapi import HTTPException, status

from backend.dtos.doit import (
    AiSummaryDTO,
    BulkSyncResultDTO,
    ThoughtCreateDTO,
    ThoughtDTO,
    ThoughtUpdateDTO,
)
from backend.models.doit import DoitThought

VALID_CATEGORIES = frozenset(
    ["todo", "schedule", "project", "note", "health", "waiting", "someday"]
)


def _to_dto(t: DoitThought) -> ThoughtDTO:
    from backend.dtos.doit import ClarificationDTO, EndOfDayDTO

    clarification_raw = t.clarification or {}
    end_of_day_raw = t.end_of_day or {}

    return ThoughtDTO(
        id=t.id,
        text=t.text,
        category=t.category,
        created_at=t.created_at,
        classified_at=t.classified_at,
        discarded_at=t.discarded_at,
        completed_at=t.completed_at,
        canvas_x=t.canvas_x,
        canvas_y=t.canvas_y,
        rotation=t.rotation,
        color=t.color,
        card_width=t.card_width,
        card_height=t.card_height,
        scheduled_date=t.scheduled_date,
        scheduled_time=t.scheduled_time,
        schedule_note=t.schedule_note,
        planned_date=t.planned_date,
        description=t.description,
        next_action=t.next_action,
        project_status=t.project_status,
        project_link_id=t.project_link_id,
        note_body=t.note_body,
        clarification=ClarificationDTO(**clarification_raw),
        end_of_day=EndOfDayDTO(**end_of_day_raw),
        waiting_for=t.waiting_for,
        someday_reason=t.someday_reason,
        urgency=t.urgency,
        updated_at=t.updated_at,
    )


class DoitService:

    async def list_thoughts(
        self,
        user_id: int,
        category: str | None = None,
        since: datetime | None = None,
    ) -> list[ThoughtDTO]:
        qs = DoitThought.filter(user_id=user_id)
        if category is not None:
            if category not in VALID_CATEGORIES:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 카테고리입니다.")
            qs = qs.filter(category=category)
        if since is not None:
            qs = qs.filter(updated_at__gte=since)
        thoughts = await qs.order_by("created_at")
        return [_to_dto(t) for t in thoughts]

    async def create_thought(self, user_id: int, body: ThoughtCreateDTO) -> ThoughtDTO:
        if body.category is not None and body.category not in VALID_CATEGORIES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 카테고리입니다.")
        if await DoitThought.filter(id=body.id).exists():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 존재하는 ID입니다.")
        t = await DoitThought.create(
            id=body.id,
            user_id=user_id,
            text=body.text,
            category=body.category,
            created_at=body.created_at,
            classified_at=body.classified_at,
            discarded_at=body.discarded_at,
            completed_at=body.completed_at,
            canvas_x=body.canvas_x,
            canvas_y=body.canvas_y,
            rotation=body.rotation,
            color=body.color,
            card_width=body.card_width,
            card_height=body.card_height,
            scheduled_date=body.scheduled_date,
            scheduled_time=body.scheduled_time,
            schedule_note=body.schedule_note,
            planned_date=body.planned_date,
            description=body.description,
            next_action=body.next_action,
            project_status=body.project_status,
            project_link_id=body.project_link_id,
            note_body=body.note_body,
            clarification=body.clarification.model_dump(),
            end_of_day=body.end_of_day.model_dump(),
            waiting_for=body.waiting_for,
            someday_reason=body.someday_reason,
            urgency=body.urgency,
        )
        return _to_dto(t)

    async def update_thought(self, user_id: int, thought_id: str, body: ThoughtUpdateDTO) -> ThoughtDTO:
        t = await DoitThought.get_or_none(id=thought_id)
        if t is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="메모를 찾을 수 없습니다.")
        if t.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="권한이 없습니다.")

        update_data = body.model_dump(exclude_unset=True)
        if "clarification" in update_data and update_data["clarification"] is not None:
            update_data["clarification"] = body.clarification.model_dump()
        if "end_of_day" in update_data and update_data["end_of_day"] is not None:
            update_data["end_of_day"] = body.end_of_day.model_dump()

        if update_data:
            await t.update_from_dict(update_data).save()
        return _to_dto(t)

    async def delete_thought(self, user_id: int, thought_id: str) -> None:
        t = await DoitThought.get_or_none(id=thought_id)
        if t is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="메모를 찾을 수 없습니다.")
        if t.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="권한이 없습니다.")
        await t.delete()

    async def bulk_sync(self, user_id: int, thoughts: list[ThoughtCreateDTO]) -> BulkSyncResultDTO:
        """localStorage → DB 초기 이전용. 동일 ID는 updated_at 최신 우선 병합."""
        synced = 0
        skipped = 0
        errors: list[str] = []

        for body in thoughts:
            try:
                if body.category is not None and body.category not in VALID_CATEGORIES:
                    body = body.model_copy(update={"category": None})

                existing = await DoitThought.get_or_none(id=body.id)
                if existing is not None:
                    # 다른 사용자 소유 ID이면 에러
                    if existing.user_id != user_id:
                        errors.append(f"{body.id}: 다른 계정에 귀속된 ID")
                        continue
                    # 기존 레코드가 더 최신이면 skip
                    incoming_updated = body.created_at
                    if existing.updated_at >= incoming_updated:
                        skipped += 1
                        continue
                    # 덮어쓰기
                    await existing.update_from_dict({
                        "text": body.text,
                        "category": body.category,
                        "classified_at": body.classified_at,
                        "discarded_at": body.discarded_at,
                        "completed_at": body.completed_at,
                        "canvas_x": body.canvas_x,
                        "canvas_y": body.canvas_y,
                        "rotation": body.rotation,
                        "color": body.color,
                        "card_width": body.card_width,
                        "card_height": body.card_height,
                        "scheduled_date": body.scheduled_date,
                        "scheduled_time": body.scheduled_time,
                        "schedule_note": body.schedule_note,
                        "planned_date": body.planned_date,
                        "description": body.description,
                        "next_action": body.next_action,
                        "project_status": body.project_status,
                        "project_link_id": body.project_link_id,
                        "note_body": body.note_body,
                        "clarification": body.clarification.model_dump(),
                        "end_of_day": body.end_of_day.model_dump(),
                        "waiting_for": body.waiting_for,
                        "someday_reason": body.someday_reason,
                        "urgency": body.urgency,
                    }).save()
                    synced += 1
                else:
                    await DoitThought.create(
                        id=body.id,
                        user_id=user_id,
                        text=body.text,
                        category=body.category,
                        created_at=body.created_at,
                        classified_at=body.classified_at,
                        discarded_at=body.discarded_at,
                        completed_at=body.completed_at,
                        canvas_x=body.canvas_x,
                        canvas_y=body.canvas_y,
                        rotation=body.rotation,
                        color=body.color,
                        card_width=body.card_width,
                        card_height=body.card_height,
                        scheduled_date=body.scheduled_date,
                        scheduled_time=body.scheduled_time,
                        schedule_note=body.schedule_note,
                        planned_date=body.planned_date,
                        description=body.description,
                        next_action=body.next_action,
                        project_status=body.project_status,
                        project_link_id=body.project_link_id,
                        note_body=body.note_body,
                        clarification=body.clarification.model_dump(),
                        end_of_day=body.end_of_day.model_dump(),
                        waiting_for=body.waiting_for,
                        someday_reason=body.someday_reason,
                        urgency=body.urgency,
                    )
                    synced += 1
            except Exception as e:
                errors.append(f"{body.id}: {str(e)[:100]}")

        return BulkSyncResultDTO(synced=synced, skipped=skipped, errors=errors)

    async def get_ai_summary(self, user_id: int) -> AiSummaryDTO:
        """AI 도움 모드용 요약본 — 원본 text 전체 미포함, health 카테고리 기본 제외."""
        today = date.today()
        today_str = today.isoformat()

        all_active = await DoitThought.filter(
            user_id=user_id,
            discarded_at=None,
            completed_at=None,
        ).only("id", "text", "category", "scheduled_date", "project_status")

        unclassified_count = 0
        today_todos: list[str] = []
        overdue_schedules = 0
        active_projects: list[str] = []
        recent_notes_count = 0

        for t in all_active:
            if t.category is None:
                unclassified_count += 1
            elif t.category == "todo":
                today_todos.append(t.text[:40])
            elif t.category == "schedule":
                if t.scheduled_date is not None:
                    if t.scheduled_date.isoformat() == today_str:
                        today_todos.append(t.text[:40])
                    elif t.scheduled_date.isoformat() < today_str:
                        overdue_schedules += 1
            elif t.category == "project" and t.project_status in (None, "active"):
                active_projects.append(t.text[:40])
            elif t.category == "note":
                recent_notes_count += 1

        return AiSummaryDTO(
            unclassified_count=unclassified_count,
            today_todos=today_todos[:10],
            overdue_schedules=overdue_schedules,
            active_projects=active_projects[:5],
            recent_notes_count=recent_notes_count,
        )
