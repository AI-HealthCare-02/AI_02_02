"""사주 사이드 게임 서비스 모듈 (v2.7 P1 스캐폴딩).

lazy loading 패턴 (chat/challenge 서비스와 일관):
- SajuService: 프로필·오늘의 운세 오케스트레이션
- SajuConsentService: 동의 이력
- SajuFeedbackService: 피드백 4축

P2~P6에서 engine/*, llm/* (※ LLM 미사용, 규칙+템플릿), safety.py 추가 예정.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.services.saju.consent import SajuConsentService
    from backend.services.saju.feedback import SajuFeedbackService
    from backend.services.saju.service import SajuService


def __getattr__(name: str):
    if name == "SajuService":
        from backend.services.saju.service import SajuService as _SajuService

        return _SajuService
    if name == "SajuConsentService":
        from backend.services.saju.consent import SajuConsentService as _SajuConsentService

        return _SajuConsentService
    if name == "SajuFeedbackService":
        from backend.services.saju.feedback import SajuFeedbackService as _SajuFeedbackService

        return _SajuFeedbackService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = ["SajuService", "SajuConsentService", "SajuFeedbackService"]
