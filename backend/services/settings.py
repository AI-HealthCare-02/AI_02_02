from __future__ import annotations

import csv
from datetime import datetime
from io import StringIO

from backend.core import config
from backend.dtos.settings import SettingsPatchRequest
from backend.models.assessments import RiskAssessment
from backend.models.consents import UserConsent
from backend.models.health import HealthProfile
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
            "max_bundles_per_day",
            "preferred_times",
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

        now = datetime.now(tz=config.TIMEZONE)
        settings.last_exported_at = now
        await settings.save(update_fields=["last_exported_at", "updated_at"])

        filename = f"danaa-user-export-{user_id}-{now.strftime('%Y%m%d-%H%M%S')}.csv"
        return output.getvalue(), filename, now
