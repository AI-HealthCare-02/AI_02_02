from __future__ import annotations

from datetime import date, datetime

import pytest
from fastapi import HTTPException
from tortoise.contrib.test import TestCase

from backend.core import config
from backend.dtos.external_checkin import (
    CheckinAnswerRequest,
    DeviceStartRequest,
    ExternalSettingsPatchRequest,
)
from backend.models.consents import UserConsent
from backend.models.enums import DataSource
from backend.models.external_checkin import ExternalCheckinRequest, ExternalClientToken
from backend.models.health import DailyHealthLog
from backend.models.users import Gender, User
from backend.services.external_checkin import ExternalCheckinService


class TestExternalCheckinService(TestCase):
    async def _make_user(self, email: str) -> User:
        return await User.create(
            email=email,
            hashed_password="hashed-password",
            name="external-test",
            gender=Gender.MALE,
            birthday=date(1990, 1, 1),
            phone_number=f"010{abs(hash(email)) % 100000000:08d}",
            is_active=True,
        )

    async def _grant_health_consent(self, user: User) -> None:
        await UserConsent.create(
            user_id=user.id,
            terms_of_service=True,
            privacy_policy=True,
            health_data_consent=True,
            disclaimer_consent=True,
            marketing_consent=False,
            consented_at=datetime.now(tz=config.TIMEZONE),
        )

    async def _issue_token(self, user: User) -> tuple[str, ExternalClientToken]:
        service = ExternalCheckinService()
        start = await service.start_device_flow(
            DeviceStartRequest(client_name="Claude Code", client_type="claude-code")
        )
        await service.approve_device_flow(user_id=user.id, user_code=start.user_code)
        token_response = await service.exchange_device_token(device_code=start.device_code)
        token = await service.verify_client_token(
            raw_token=token_response.access_token,
            required_scope="checkin:read",
        )
        return token_response.access_token, token

    async def test_device_flow_stores_only_token_hash(self):
        user = await self._make_user("external-device@test.com")

        raw_token, token = await self._issue_token(user)

        assert raw_token.startswith("danaa_ext_")
        assert token.token_hash != raw_token
        assert raw_token not in token.token_hash
        assert token.user_id == user.id

    async def test_next_checkin_requires_health_consent(self):
        user = await self._make_user("external-consent@test.com")
        _, token = await self._issue_token(user)

        with pytest.raises(HTTPException) as exc_info:
            await ExternalCheckinService().get_next_checkin(token=token)

        assert exc_info.value.status_code == 403
        assert exc_info.value.detail["error_code"] == "CONSENT_REQUIRED"

    async def test_answer_saves_ai_tool_source_and_idempotency(self):
        user = await self._make_user("external-answer@test.com")
        await self._grant_health_consent(user)
        _, token = await self._issue_token(user)
        service = ExternalCheckinService()

        next_card = await service.get_next_checkin(token=token)
        answers = {
            question.field: question.options[1] if question.options else 10
            for question in next_card.questions
        }
        response = await service.answer_checkin(
            token=token,
            data=CheckinAnswerRequest(lease_id=next_card.lease_id, answers=answers),
            idempotency_key="idem-answer-1",
        )
        duplicate = await service.answer_checkin(
            token=token,
            data=CheckinAnswerRequest(lease_id=next_card.lease_id, answers=answers),
            idempotency_key="idem-answer-1",
        )
        log = await DailyHealthLog.get(user_id=user.id)

        assert response.status == "saved"
        assert duplicate == response
        assert await ExternalCheckinRequest.filter(token_id=token.id, idempotency_key="idem-answer-1").count() == 1
        for field_name in response.saved_fields:
            source_field = f"{field_name}_source"
            if hasattr(log, source_field):
                assert getattr(log, source_field) == DataSource.AI_TOOL

    async def test_answer_rejects_field_outside_server_lease(self):
        user = await self._make_user("external-field@test.com")
        await self._grant_health_consent(user)
        _, token = await self._issue_token(user)
        service = ExternalCheckinService()
        next_card = await service.get_next_checkin(token=token)

        with pytest.raises(HTTPException) as exc_info:
            await service.answer_checkin(
                token=token,
                data=CheckinAnswerRequest(
                    lease_id=next_card.lease_id,
                    answers={"water_cups": 4},
                ),
                idempotency_key="idem-invalid-field",
            )

        assert exc_info.value.status_code == 422
        assert exc_info.value.detail["error_code"] == "FIELD_NOT_ALLOWED"

    async def test_external_settings_allow_only_safe_intervals(self):
        user = await self._make_user("external-settings@test.com")
        _, token = await self._issue_token(user)

        result = await ExternalCheckinService().patch_settings(
            token=token,
            data=ExternalSettingsPatchRequest(health_question_interval_minutes=120),
        )

        assert result.health_question_interval_minutes == 120
        assert result.auto_question_enabled is True
