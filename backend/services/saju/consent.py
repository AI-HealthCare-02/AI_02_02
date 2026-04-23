"""사주 전용 동의 서비스 (v2.7 P1 스캐폴딩 / P1.5 확장).

동의 없이는 생년월일 등 민감정보 수집 금지. 프로필 저장 전 반드시 조회.

P1.5 확장: list_all (export용), delete_all + record_revocation (삭제 파이프라인용).
"""

from __future__ import annotations

from backend.models.saju import SajuConsentEvent

# 삭제 파이프라인이 기록하는 동의 버전 라벨.
# 사용자가 기록한 동의와 구분되도록 `revoked-by-user`로 고정.
CONSENT_VERSION_REVOCATION = "revoked-by-user"


class SajuConsentService:
    """사주 동의 이력 관리."""

    async def get_latest(self, user_id: int) -> SajuConsentEvent | None:
        """최근 동의 이벤트 조회."""
        return (
            await SajuConsentEvent.filter(user_id=user_id).order_by("-created_at").first()
        )

    async def list_all(self, user_id: int) -> list[SajuConsentEvent]:
        """전체 동의 이벤트 (export용). 시간순 오름차순."""
        return await SajuConsentEvent.filter(user_id=user_id).order_by("created_at").all()

    async def record(
        self,
        *,
        user_id: int,
        consent_version: str,
        granted: bool,
        ip_hash: str | None = None,
        ua_hash: str | None = None,
    ) -> SajuConsentEvent:
        """동의 이벤트 기록. 이미 granted=True 여도 새 이벤트로 append-only 저장."""
        return await SajuConsentEvent.create(
            user_id=user_id,
            consent_version=consent_version,
            granted=granted,
            ip_hash=ip_hash,
            ua_hash=ua_hash,
        )

    async def is_granted(self, user_id: int) -> bool:
        """사주 기능 사용 동의 여부 (가장 최근 이벤트 기준)."""
        latest = await self.get_latest(user_id=user_id)
        return bool(latest and latest.granted)

    async def delete_all(self, user_id: int) -> int:
        """동의 이력 hard delete (삭제 파이프라인에서만 호출). 삭제된 건수 반환."""
        return await SajuConsentEvent.filter(user_id=user_id).delete()

    async def record_revocation(self, user_id: int) -> SajuConsentEvent:
        """삭제 파이프라인 직후 `revoked-by-user` 이벤트 1건 기록 (감사 흔적)."""
        return await SajuConsentEvent.create(
            user_id=user_id,
            consent_version=CONSENT_VERSION_REVOCATION,
            granted=False,
        )
