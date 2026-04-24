from __future__ import annotations

import csv
from datetime import datetime
from io import StringIO
from typing import Any

from backend.core import config
from backend.dtos.settings import SettingsPatchRequest
from backend.models.assessments import RiskAssessment
from backend.models.consents import UserConsent
from backend.models.health import HealthProfile
from backend.models.saju import (
    SajuConsentEvent,
    SajuDailyCard,
    SajuFeedbackEvent,
    SajuProfile,
)
from backend.models.settings import UserSettings
from backend.models.users import User


class SettingsService:
    @staticmethod
    async def get_settings(user_id: int) -> UserSettings:
        settings, _ = await UserSettings.get_or_create(user_id=user_id)
        return settings

    async def update_settings(self, user_id: int, data: SettingsPatchRequest) -> UserSettings:
        settings = await self.get_settings(user_id)
        payload = data.model_dump(exclude_none=True)
        for field_name, value in payload.items():
            setattr(settings, field_name, value)
        if payload:
            await settings.save(update_fields=[*payload.keys(), "updated_at"])
        return settings

    async def export_user_data_csv(self, user_id: int) -> tuple[str, str, datetime]:
        settings = await self.get_settings(user_id)
        user = await User.get(id=user_id)
        consent = await UserConsent.get_or_none(user_id=user_id)
        profile = await HealthProfile.get_or_none(user_id=user_id)
        latest_risk = await RiskAssessment.filter(user_id=user_id).order_by("-assessed_at").first()

        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["section", "field", "value"])

        for field_name in ("id", "email", "name", "gender", "birthday", "phone_number"):
            writer.writerow(["user", field_name, getattr(user, field_name)])

        if consent:
            for field_name in (
                "terms_of_service",
                "privacy_policy",
                "health_data_consent",
                "disclaimer_consent",
                "marketing_consent",
                "consented_at",
            ):
                writer.writerow(["consent", field_name, getattr(consent, field_name)])

        if profile:
            for field_name in (
                "relation",
                "user_group",
                "age_range",
                "height_cm",
                "weight_kg",
                "bmi",
                "family_history",
                "exercise_frequency",
                "sleep_duration_bucket",
                "alcohol_frequency",
                "smoking_status",
                "ai_consent",
            ):
                writer.writerow(["health_profile", field_name, getattr(profile, field_name)])

        for field_name in (
            "nickname",
            "chat_notification",
            "morning_reminder",
            "evening_reminder",
            "challenge_reminder",
            "weekly_report",
            "reminder_time_morning",
            "reminder_time_evening",
            "health_question_interval_minutes",
            "max_bundles_per_day",
            "preferred_times",
            "theme_preference",
            "last_exported_at",
        ):
            writer.writerow(["settings", field_name, getattr(settings, field_name)])

        if latest_risk:
            for field_name in (
                "findrisc_score",
                "risk_level",
                "sleep_score",
                "diet_score",
                "exercise_score",
                "lifestyle_score",
                "assessed_at",
            ):
                writer.writerow(["risk", field_name, getattr(latest_risk, field_name)])

        # 사주 사이드 게임 데이터 (P1.5 — 개인정보 권리 통합 export).
        # SAJU_ENABLED 무관하게 사용자 소유 데이터는 전부 포함.
        # 상세 이력은 GET /api/v1/saju/data/export (JSON) 에서 받을 수 있음.
        await self._write_saju_rows(writer, user_id=user_id)

        now = datetime.now(tz=config.TIMEZONE)
        settings.last_exported_at = now
        await settings.save(update_fields=["last_exported_at", "updated_at"])

        filename = f"danaa-user-export-{user_id}-{now.strftime('%Y%m%d-%H%M%S')}.csv"
        return output.getvalue(), filename, now

    @staticmethod
    async def _write_saju_rows(writer: Any, *, user_id: int) -> None:
        """사주 요약 3 블록 (consent / profile / summary) 을 CSV 에 기록.

        상세 이력 (카드·피드백 전체) 은 /api/v1/saju/data/export (JSON) 전용.
        """
        saju_consent_latest = (
            await SajuConsentEvent.filter(user_id=user_id).order_by("-created_at").first()
        )
        if saju_consent_latest:
            writer.writerow(
                ["saju_consent", "consent_version", saju_consent_latest.consent_version]
            )
            writer.writerow(["saju_consent", "granted", saju_consent_latest.granted])
            writer.writerow(
                ["saju_consent", "granted_at", saju_consent_latest.created_at]
            )

        saju_profile = await SajuProfile.filter(user_id=user_id).first()
        if saju_profile:
            for field_name in (
                "birth_date",
                "is_lunar",
                "is_leap_month",
                "birth_time",
                "birth_time_accuracy",
                "gender",
                "is_deleted",
            ):
                writer.writerow(
                    ["saju_profile", field_name, getattr(saju_profile, field_name)]
                )

        saju_cards_count = await SajuDailyCard.filter(user_id=user_id).count()
        saju_feedback_count = await SajuFeedbackEvent.filter(user_id=user_id).count()
        writer.writerow(["saju_summary", "daily_cards_count", saju_cards_count])
        writer.writerow(["saju_summary", "feedback_events_count", saju_feedback_count])
