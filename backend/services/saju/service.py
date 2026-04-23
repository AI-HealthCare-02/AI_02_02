"""사주 사이드 게임 오케스트레이션 서비스 (v2.7 P1 스캐폴딩).

역할:
- 프로필 조회/저장 (consent 선행 필수)
- 오늘의 운세 조회 (P1: stub, P4에서 실제 생성)
- 데이터 export/delete (P6에서 구현)

P2~P6 확장 지점:
- P2: SajuChart 계산 (sajupy 어댑터)
- P3: 4학파·템플릿·Specificity Filter
- P4: 7 섹션 body/reason 생성
- P6: export/delete 완성
"""

from __future__ import annotations

from backend.models.saju import SajuProfile


class SajuService:
    """사주 프로필·오늘 카드 오케스트레이션."""

    async def get_profile(self, user_id: int) -> SajuProfile | None:
        """활성(soft delete 제외) 프로필 조회."""
        return (
            await SajuProfile.filter(user_id=user_id, is_deleted=False).first()
        )

    async def upsert_profile(
        self,
        *,
        user_id: int,
        birth_date,
        is_lunar: bool,
        is_leap_month: bool,
        birth_time,
        birth_time_accuracy: str,
        gender: str,
    ) -> SajuProfile:
        """프로필 생성/수정 (soft delete된 기존 프로필은 되살리지 않고 신규 생성)."""
        existing = await self.get_profile(user_id=user_id)
        if existing is not None:
            existing.birth_date = birth_date
            existing.is_lunar = is_lunar
            existing.is_leap_month = is_leap_month
            existing.birth_time = birth_time
            existing.birth_time_accuracy = birth_time_accuracy
            existing.gender = gender
            await existing.save()
            return existing

        return await SajuProfile.create(
            user_id=user_id,
            birth_date=birth_date,
            is_lunar=is_lunar,
            is_leap_month=is_leap_month,
            birth_time=birth_time,
            birth_time_accuracy=birth_time_accuracy,
            gender=gender,
        )

    async def soft_delete_profile(self, user_id: int) -> bool:
        """프로필 소프트 삭제. 관련 차트/카드/피드백은 CASCADE(하드) 예정 테이블 제외."""
        from datetime import datetime

        profile = await self.get_profile(user_id=user_id)
        if profile is None:
            return False
        profile.is_deleted = True
        profile.deleted_at = datetime.now()
        await profile.save()
        return True
