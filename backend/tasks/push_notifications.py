from __future__ import annotations

from datetime import timedelta

from backend.core.logger import setup_logger
from backend.services.push import PushService
from backend.tasks.scheduler import distributed_lock

logger = setup_logger("tasks.push_notifications")


async def run_push_notification_tick() -> None:
    async with distributed_lock("push-notifications", ttl=timedelta(minutes=4)) as acquired:
        if not acquired:
            return
        sent_count = await PushService().send_due_notifications()
        if sent_count:
            logger.info("web_push_notifications_sent", sent_count=sent_count)
