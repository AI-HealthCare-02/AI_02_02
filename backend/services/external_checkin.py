"""External AI tool health check-in service.

Security shape:
- Device codes are short-lived and stored as hashes.
- Client tokens are returned once and stored as hashes only.
- A health answer can be saved only against a server-issued lease.
"""

from __future__ import annotations

import hashlib
import json
import secrets
import string
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException, status

from backend.core import config
from backend.core.logger import setup_logger
from backend.dtos.external_checkin import (
    CheckinAnswerRequest,
    CheckinAnswerResponse,
    CheckinNextResponse,
    DeviceApproveResponse,
    DeviceStartRequest,
    DeviceStartResponse,
    DeviceTokenResponse,
    ExternalQuestionItem,
    ExternalSettingsPatchRequest,
    ExternalSettingsResponse,
)
from backend.models.consents import UserConsent
from backend.models.enums import DataSource
from backend.models.external_checkin import (
    ExternalCheckinLease,
    ExternalCheckinRequest,
    ExternalClientToken,
    ExternalDeviceSession,
)
from backend.models.settings import UserSettings
from backend.services.health_question import HealthQuestionService

logger = setup_logger(__name__)

DEVICE_CODE_TTL_MINUTES = 10
LEASE_TTL_MINUTES = 15
CLIENT_TOKEN_TTL_DAYS = 90
DEVICE_POLL_INTERVAL_SECONDS = 5
DEFAULT_SCOPES = ["checkin:read", "checkin:write", "settings:read", "settings:write"]
ALLOWED_INTERVALS = {0, 60, 90, 120}


def _now() -> datetime:
    return datetime.now(tz=config.TIMEZONE)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _safe_json_hash(payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return _sha256(encoded)


def _new_user_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    raw = "".join(secrets.choice(alphabet) for _ in range(8))
    return f"{raw[:4]}-{raw[4:]}"


def _normalize_user_code(user_code: str) -> str:
    compact = "".join(ch for ch in user_code.upper() if ch.isalnum())
    if len(compact) == 8:
        return f"{compact[:4]}-{compact[4:]}"
    return user_code.upper()


class ExternalCheckinService:
    async def start_device_flow(self, data: DeviceStartRequest) -> DeviceStartResponse:
        device_code = f"dvc_{secrets.token_urlsafe(32)}"
        user_code = _new_user_code()
        expires_at = _now() + timedelta(minutes=DEVICE_CODE_TTL_MINUTES)
        await ExternalDeviceSession.create(
            user_code=user_code,
            device_code_hash=_sha256(device_code),
            client_name=data.client_name,
            client_type=data.client_type,
            scopes=DEFAULT_SCOPES,
            expires_at=expires_at,
        )
        return DeviceStartResponse(
            device_code=device_code,
            user_code=user_code,
            verification_uri=f"{config.FRONTEND_BASE_URL}/settings/integrations/danaa-health-cards",
            expires_in=DEVICE_CODE_TTL_MINUTES * 60,
            interval=DEVICE_POLL_INTERVAL_SECONDS,
        )

    async def approve_device_flow(self, *, user_id: int, user_code: str) -> DeviceApproveResponse:
        session = await ExternalDeviceSession.get_or_none(
            user_code=_normalize_user_code(user_code),
            status="pending",
        )
        if session is None or session.expires_at <= _now():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "DEVICE_CODE_NOT_FOUND", "message": "승인할 기기 코드가 없거나 만료되었습니다."},
            )

        session.status = "approved"
        session.approved_user_id = user_id
        session.approved_at = _now()
        await session.save(update_fields=["status", "approved_user_id", "approved_at"])
        return DeviceApproveResponse(
            approved=True,
            message="CLI 연결을 승인했습니다. 이제 CLI에서 토큰을 받을 수 있습니다.",
        )

    async def exchange_device_token(self, *, device_code: str) -> DeviceTokenResponse:
        session = await ExternalDeviceSession.get_or_none(
            device_code_hash=_sha256(device_code),
        )
        if session is None or session.expires_at <= _now():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "EXPIRED_DEVICE_CODE", "message": "기기 코드가 만료되었습니다."},
            )
        if session.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_428_PRECONDITION_REQUIRED,
                detail={"error_code": "AUTHORIZATION_PENDING", "message": "아직 웹에서 승인되지 않았습니다."},
            )
        if session.status != "approved" or session.approved_user_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "INVALID_DEVICE_SESSION", "message": "이미 사용되었거나 거절된 기기 코드입니다."},
            )

        raw_token = f"danaa_ext_{secrets.token_urlsafe(32)}"
        expires_at = _now() + timedelta(days=CLIENT_TOKEN_TTL_DAYS)
        await ExternalClientToken.create(
            user_id=session.approved_user_id,
            token_hash=_sha256(raw_token),
            client_name=session.client_name,
            client_type=session.client_type,
            scopes=session.scopes,
            expires_at=expires_at,
        )
        session.status = "issued"
        await session.save(update_fields=["status"])
        return DeviceTokenResponse(
            access_token=raw_token,
            expires_in=CLIENT_TOKEN_TTL_DAYS * 24 * 60 * 60,
            scopes=list(session.scopes or DEFAULT_SCOPES),
        )

    async def verify_client_token(self, raw_token: str, *, required_scope: str) -> ExternalClientToken:
        token = (
            await ExternalClientToken.filter(
                token_hash=_sha256(raw_token),
                revoked_at__isnull=True,
                expires_at__gt=_now(),
            )
            .select_related("user")
            .first()
        )
        if token is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error_code": "INVALID_EXTERNAL_TOKEN", "message": "외부 도구 토큰이 유효하지 않습니다."},
            )
        if required_scope not in set(token.scopes or []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "INSUFFICIENT_SCOPE", "message": "이 토큰에는 필요한 권한이 없습니다."},
            )
        if not token.user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "USER_INACTIVE", "message": "비활성화된 계정입니다."},
            )

        token.last_used_at = _now()
        await token.save(update_fields=["last_used_at"])
        return token

    async def get_settings(self, *, token: ExternalClientToken) -> ExternalSettingsResponse:
        settings, _ = await UserSettings.get_or_create(user_id=token.user_id)
        interval = int(settings.health_question_interval_minutes or 90)
        if interval not in ALLOWED_INTERVALS:
            interval = 90
        return ExternalSettingsResponse(
            health_question_interval_minutes=interval,
            max_bundles_per_day=settings.max_bundles_per_day,
            auto_question_enabled=interval > 0,
        )

    async def patch_settings(
        self,
        *,
        token: ExternalClientToken,
        data: ExternalSettingsPatchRequest,
    ) -> ExternalSettingsResponse:
        settings, _ = await UserSettings.get_or_create(user_id=token.user_id)
        payload = data.model_dump(exclude_none=True)
        if "health_question_interval_minutes" in payload:
            settings.health_question_interval_minutes = payload["health_question_interval_minutes"]
            await settings.save(update_fields=["health_question_interval_minutes", "updated_at"])
        return await self.get_settings(token=token)

    async def get_next_checkin(self, *, token: ExternalClientToken) -> CheckinNextResponse:
        await self._ensure_health_consent(token.user_id)

        pending = await HealthQuestionService().get_daily_pending_questions(token.user_id)
        bundles = pending.get("bundles") or []
        if not bundles:
            return CheckinNextResponse(
                has_question=False,
                notice="오늘 저장할 건강질문이 더 없습니다.",
            )

        bundle = bundles[0]
        allowed_fields = [str(field_name) for field_name in bundle.get("unanswered_fields", [])]
        questions = [
            ExternalQuestionItem(**question)
            for question in (bundle.get("questions") or [])
            if question.get("field") in set(allowed_fields)
        ]
        if not questions:
            return CheckinNextResponse(
                has_question=False,
                notice="지금 바로 받을 수 있는 질문이 없습니다.",
            )

        expires_at = _now() + timedelta(minutes=LEASE_TTL_MINUTES)
        lease = await ExternalCheckinLease.create(
            lease_id=uuid4().hex,
            user_id=token.user_id,
            token_id=token.id,
            bundle_key=str(bundle.get("bundle_key")),
            question_payload={
                "bundle_key": str(bundle.get("bundle_key")),
                "name": str(bundle.get("name") or bundle.get("bundle_key")),
                "questions": [question.model_dump(mode="json") for question in questions],
            },
            allowed_fields=allowed_fields,
            log_date=_now().date(),
            expires_at=expires_at,
        )
        return CheckinNextResponse(
            has_question=True,
            lease_id=lease.lease_id,
            bundle_key=lease.bundle_key,
            bundle_name=str(bundle.get("name") or lease.bundle_key),
            log_date=lease.log_date,
            expires_at=lease.expires_at,
            questions=questions,
        )

    async def answer_checkin(
        self,
        *,
        token: ExternalClientToken,
        data: CheckinAnswerRequest,
        idempotency_key: str,
    ) -> CheckinAnswerResponse:
        if not idempotency_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error_code": "IDEMPOTENCY_KEY_REQUIRED", "message": "Idempotency-Key 헤더가 필요합니다."},
            )

        request_payload = data.model_dump(mode="json")
        request_hash = _safe_json_hash(request_payload)
        existing = await ExternalCheckinRequest.get_or_none(
            token_id=token.id,
            idempotency_key=idempotency_key,
        )
        if existing is not None:
            if existing.request_hash != request_hash:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={"error_code": "IDEMPOTENCY_KEY_REUSED", "message": "같은 Idempotency-Key로 다른 요청을 보냈습니다."},
                )
            return CheckinAnswerResponse(**existing.response_payload)

        await self._ensure_health_consent(token.user_id)
        lease = await ExternalCheckinLease.get_or_none(
            lease_id=data.lease_id,
            user_id=token.user_id,
            token_id=token.id,
        )
        if lease is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error_code": "LEASE_NOT_FOUND", "message": "서버가 발급한 질문권을 찾을 수 없습니다."},
            )
        if lease.expires_at <= _now():
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail={"error_code": "LEASE_EXPIRED", "message": "질문권이 만료되었습니다. 새 질문을 받아주세요."},
            )
        if lease.consumed_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error_code": "LEASE_CONSUMED", "message": "이미 사용한 질문권입니다."},
            )

        if data.skip:
            response = CheckinAnswerResponse(
                status="skipped",
                daily_log_date=lease.log_date,
                message="이번 질문은 건너뛰었습니다.",
            )
        else:
            self._validate_answers(lease=lease, answers=data.answers)
            result = await HealthQuestionService().save_health_answers(
                user_id=token.user_id,
                bundle_key=lease.bundle_key,
                answers=dict(data.answers),
                source=DataSource.AI_TOOL,
            )
            await self._refresh_derived_health_data(user_id=token.user_id)
            response = CheckinAnswerResponse(
                status="saved",
                saved_fields=list(result["saved_fields"]),
                skipped_fields=list(result["skipped_fields"]),
                daily_log_date=lease.log_date,
                message="DANAA 건강 기록에 저장했습니다.",
            )

        lease.consumed_at = _now()
        await lease.save(update_fields=["consumed_at"])
        await ExternalCheckinRequest.create(
            user_id=token.user_id,
            token_id=token.id,
            lease_id=lease.id,
            idempotency_key=idempotency_key,
            request_hash=request_hash,
            response_payload=response.model_dump(mode="json"),
        )
        return response

    @staticmethod
    async def _ensure_health_consent(user_id: int) -> None:
        consent = await UserConsent.get_or_none(user_id=user_id)
        if consent is None or not consent.health_data_consent:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error_code": "CONSENT_REQUIRED", "message": "건강정보 수집 동의가 필요합니다."},
            )

    @staticmethod
    def _validate_answers(*, lease: ExternalCheckinLease, answers: dict[str, str | int | bool]) -> None:
        allowed_fields = set(str(field_name) for field_name in (lease.allowed_fields or []))
        unknown_fields = [field_name for field_name in answers if field_name not in allowed_fields]
        if unknown_fields:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "error_code": "FIELD_NOT_ALLOWED",
                    "message": "서버가 발급한 질문에 포함되지 않은 필드입니다.",
                    "fields": unknown_fields,
                },
            )

        questions_by_field = {
            question["field"]: question
            for question in (lease.question_payload or {}).get("questions", [])
            if isinstance(question, dict) and "field" in question
        }
        for field_name, value in answers.items():
            question = questions_by_field.get(field_name)
            if question is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"error_code": "QUESTION_NOT_FOUND", "message": "질문 정보를 찾을 수 없습니다."},
                )
            if question.get("input_type") == "number":
                if not isinstance(value, int) or isinstance(value, bool) or value < 0 or value > 1440:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail={"error_code": "INVALID_NUMBER", "message": "숫자 답변은 0~1440 사이의 정수여야 합니다."},
                    )
                continue
            options = question.get("options") or []
            if value not in options:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail={"error_code": "INVALID_OPTION", "message": "질문에 없는 선택지입니다.", "field": field_name},
                )

    @staticmethod
    async def _refresh_derived_health_data(*, user_id: int) -> None:
        from backend.services.risk_analysis import RiskAnalysisService, invalidate_report_caches

        await invalidate_report_caches(user_id)
        try:
            await RiskAnalysisService().recalculate_risk(
                user_id=user_id,
                generate_coaching=False,
            )
        except Exception:
            logger.exception("external_checkin_recalculate_failed", user_id=user_id)
