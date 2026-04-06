"""대시보드 서비스 — 앱 첫 화면 데이터 조합.

GET /dashboard/init 하나의 요청으로
오늘기록 + 위험도 + 챌린지 + 참여상태 + 유저그룹을 한 번에 내려준다.
"""

from __future__ import annotations

from datetime import date

from backend.core.cache import get_cached, set_cached
from backend.dtos.dashboard import (
    ChallengeSummaryItem,
    DashboardInitResponse,
    EngagementResponse,
    RiskSummaryResponse,
)
from backend.dtos.health import DailyLogResponse
from backend.models.assessments import RiskAssessment, UserEngagement
from backend.models.challenges import UserChallenge
from backend.models.enums import ChallengeStatus
from backend.models.health import DailyHealthLog, HealthProfile
from backend.services.health_daily import _empty_log_response, _log_to_response


class DashboardService:
    """대시보드 초기화 데이터 조합."""

    async def get_init(self, user_id: int) -> DashboardInitResponse:
        """대시보드 init — 5개 컴포넌트 한 번에 조합."""
        today = date.today()

        # 1. 오늘의 건강 기록
        daily_log = await self._get_daily_log(user_id, today)

        # 2. 최신 위험도
        risk = await self._get_risk_summary(user_id)

        # 3. 챌린지 요약
        challenge_summary = await self._get_challenge_summary(user_id)

        # 4. 참여 상태
        engagement = await self._get_engagement(user_id)

        # 5. 유저 그룹
        profile = await HealthProfile.get_or_none(user_id=user_id)
        user_group = profile.user_group if profile else None

        return DashboardInitResponse(
            daily_log=daily_log,
            risk=risk,
            challenge_summary=challenge_summary,
            engagement=engagement,
            user_group=user_group,
        )

    @staticmethod
    async def _get_daily_log(
        user_id: int, today: date
    ) -> DailyLogResponse | None:
        """오늘의 건강 기록."""
        log = await DailyHealthLog.get_or_none(
            user_id=user_id, log_date=today,
        )
        if not log:
            return _empty_log_response(today)
        return _log_to_response(log)

    @staticmethod
    async def _get_risk_summary(user_id: int) -> RiskSummaryResponse | None:
        """최신 위험도 요약 (캐시 TTL: 60분)."""
        cache_key = f"dash:risk:{user_id}"
        cached = await get_cached(cache_key)
        if cached is not None:
            return RiskSummaryResponse(**cached)

        assessment = await RiskAssessment.filter(
            user_id=user_id,
        ).order_by("-assessed_at").first()

        if not assessment:
            return None

        result = RiskSummaryResponse(
            findrisc_score=assessment.findrisc_score,
            risk_level=assessment.risk_level,
            sleep_score=assessment.sleep_score,
            diet_score=assessment.diet_score,
            exercise_score=assessment.exercise_score,
            lifestyle_score=assessment.lifestyle_score,
            assessed_at=assessment.assessed_at,
        )
        await set_cached(cache_key, result.model_dump(mode="json"), ttl_seconds=3600)
        return result

    @staticmethod
    async def _get_challenge_summary(
        user_id: int,
    ) -> list[ChallengeSummaryItem]:
        """활성 챌린지 요약 (캐시 TTL: 5분)."""
        cache_key = f"dash:challenge:{user_id}"
        cached = await get_cached(cache_key)
        if cached is not None:
            return [ChallengeSummaryItem(**item) for item in cached]

        active = await UserChallenge.filter(
            user_id=user_id, status=ChallengeStatus.ACTIVE,
        ).prefetch_related("template")

        result = [
            ChallengeSummaryItem(
                user_challenge_id=uc.id,
                name=uc.template.name,
                emoji=uc.template.emoji,
                category=uc.template.category,
                progress_pct=float(uc.progress_pct),
                today_checked=uc.today_checked,
            )
            for uc in active
        ]
        await set_cached(
            cache_key,
            [item.model_dump(mode="json") for item in result],
            ttl_seconds=300,
        )
        return result

    @staticmethod
    async def _get_engagement(user_id: int) -> EngagementResponse | None:
        """참여 상태 (캐시 TTL: 60분)."""
        cache_key = f"dash:engagement:{user_id}"
        cached = await get_cached(cache_key)
        if cached is not None:
            return EngagementResponse(**cached)

        eng = await UserEngagement.get_or_none(user_id=user_id)
        if not eng:
            return None

        result = EngagementResponse(
            state=eng.state,
            seven_day_response_rate=float(eng.seven_day_response_rate),
            cooldown_until=eng.cooldown_until,
        )
        await set_cached(cache_key, result.model_dump(mode="json"), ttl_seconds=3600)
        return result
