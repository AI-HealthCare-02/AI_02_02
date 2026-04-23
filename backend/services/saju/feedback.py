"""사주 피드백 서비스 (v2.7 P1 스캐폴딩).

피드백 4축: wow/match/mild/mismatch.
P3 이후 R71~R75 자동 트리거 및 학파 선호 학습과 연동 예정.
"""

from __future__ import annotations

from datetime import date

from backend.models.saju import SajuDailyCard, SajuFeedbackEvent


class SajuFeedbackService:
    """사주 피드백 기록."""

    async def record(
        self,
        *,
        user_id: int,
        card_date: date,
        verdict: str,
        section_key: str | None = None,
    ) -> SajuFeedbackEvent:
        """해당 날짜 카드에 대한 피드백 저장.

        카드가 없어도 append-only로 기록 (신뢰도 이벤트 성격).
        """
        card = await SajuDailyCard.filter(user_id=user_id, card_date=card_date).first()
        return await SajuFeedbackEvent.create(
            user_id=user_id,
            card_id=card.id if card else None,
            section_key=section_key,
            verdict=verdict,
        )
