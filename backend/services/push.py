from __future__ import annotations

import json
from datetime import datetime, time, timedelta

from tortoise.exceptions import IntegrityError

from backend.core import config
from backend.core.logger import setup_logger
from backend.dtos.push import PushActionRequest, PushPreferenceRequest, PushSubscriptionRequest
from backend.models.push import PushSubscription
from backend.models.settings import UserSettings
from backend.models.users import User
from backend.services.health_question import HealthQuestionService

logger = setup_logger("services.push")


def _now() -> datetime:
    return datetime.now(tz=config.TIMEZONE)


def _tomorrow_start(now: datetime) -> datetime:
    tomorrow = now.date() + timedelta(days=1)
    return datetime.combine(tomorrow, time.min, tzinfo=config.TIMEZONE)


def web_push_ready() -> bool:
    return bool(
        config.WEB_PUSH_ENABLED
        and config.WEB_PUSH_VAPID_PUBLIC_KEY
        and config.web_push_vapid_private_key_value
    )


class PushService:
    async def upsert_subscription(self, user_id: int, data: PushSubscriptionRequest) -> PushSubscription:
        settings, _ = await UserSettings.get_or_create(user_id=user_id)
        interval = settings.health_question_interval_minutes or 0
        first_check_delay = timedelta(seconds=10)
        initial_last_sent_at = None
        if interval > 0:
            initial_last_sent_at = _now() - timedelta(minutes=interval) + first_check_delay
        payload = {
            "user_id": user_id,
            "p256dh": data.keys.p256dh,
            "auth": data.keys.auth,
            "is_active": True,
            "disabled_at": None,
            "muted_until": None,
            "last_sent_at": initial_last_sent_at,
        }
        subscription = await PushSubscription.get_or_none(endpoint=data.endpoint)
        if subscription:
            for field_name, value in payload.items():
                setattr(subscription, field_name, value)
            await subscription.save(update_fields=[*payload.keys(), "updated_at"])
            return subscription
        try:
            return await PushSubscription.create(endpoint=data.endpoint, **payload)
        except IntegrityError:
            subscription = await PushSubscription.get(endpoint=data.endpoint)
            for field_name, value in payload.items():
                setattr(subscription, field_name, value)
            await subscription.save(update_fields=[*payload.keys(), "updated_at"])
            return subscription

    async def deactivate_subscription(self, user_id: int, data: PushSubscriptionRequest) -> None:
        await PushSubscription.filter(user_id=user_id, endpoint=data.endpoint).delete()

    async def update_preferences(self, user_id: int, data: PushPreferenceRequest) -> None:
        now = _now()
        query = PushSubscription.filter(user_id=user_id)
        if data.action == "mute_today":
            await query.update(muted_until=_tomorrow_start(now), updated_at=now)
        elif data.action == "disable":
            await query.update(is_active=False, disabled_at=now, updated_at=now)
        elif data.action == "enable":
            await query.update(is_active=True, disabled_at=None, muted_until=None, updated_at=now)

    async def handle_action_token(self, data: PushActionRequest) -> bool:
        subscription = await PushSubscription.get_or_none(action_token=data.token)
        if subscription is None:
            return False
        now = _now()
        if data.action == "mute_today":
            subscription.muted_until = _tomorrow_start(now)
            update_fields = ["muted_until", "updated_at"]
        else:
            subscription.is_active = False
            subscription.disabled_at = now
            update_fields = ["is_active", "disabled_at", "updated_at"]
        await subscription.save(update_fields=update_fields)
        return True

    async def send_due_notifications(self) -> int:
        if not web_push_ready():
            return 0
        now = _now()
        subscriptions = (
            await PushSubscription.filter(is_active=True, disabled_at=None)
            .select_related("user")
            .limit(config.WEB_PUSH_BATCH_SIZE)
        )
        sent_count = 0
        health_question_service = HealthQuestionService()
        for subscription in subscriptions:
            if subscription.muted_until and subscription.muted_until > now:
                continue
            settings, _ = await UserSettings.get_or_create(user_id=subscription.user_id)
            interval = settings.health_question_interval_minutes or 0
            if not settings.chat_notification or interval <= 0:
                continue
            if subscription.last_sent_at and subscription.last_sent_at + timedelta(minutes=interval) > now:
                continue
            user = subscription.user
            if not isinstance(user, User) or not user.is_active or not user.onboarding_completed:
                continue
            due_bundle = await health_question_service.get_due_push_bundle(user.id, now=now)
            if not due_bundle:
                continue
            if await self._send_one(subscription, user, due_bundle):
                subscription.last_sent_at = now
                await subscription.save(update_fields=["last_sent_at", "updated_at"])
                sent_count += 1
        return sent_count

    async def _send_one(self, subscription: PushSubscription, user: User, due_bundle: dict[str, object]) -> bool:
        try:
            from pywebpush import WebPushException, webpush
        except ImportError:
            logger.warning("pywebpush_not_installed")
            return False

        name = user.name or "사용자"
        bundle_key = str(due_bundle.get("bundle_key") or "")
        bundle_name = str(due_bundle.get("name") or "건강 기록")
        unanswered_count = int(due_bundle.get("unanswered_count") or 0)
        payload = {
            "title": f"{bundle_name} 기록이 비어 있어요",
            "body": f"{name}님, 지나간 시간대의 {bundle_name} 질문 {unanswered_count}개를 지금 체크할 수 있어요.",
            "url": f"/app/chat?from=push&bundle_key={bundle_key}",
            "bundle_key": bundle_key,
            "bundle_name": bundle_name,
            "api_base": config.WEB_PUSH_ACTION_API_BASE.rstrip("/"),
            "token": subscription.action_token,
        }
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                },
                data=json.dumps(payload, ensure_ascii=False),
                vapid_private_key=config.web_push_vapid_private_key_value,
                vapid_claims={"sub": config.WEB_PUSH_VAPID_SUBJECT},
            )
            return True
        except WebPushException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code in {404, 410}:
                subscription.is_active = False
                subscription.disabled_at = _now()
                await subscription.save(update_fields=["is_active", "disabled_at", "updated_at"])
            logger.warning("web_push_send_failed", status_code=status_code)
            return False
