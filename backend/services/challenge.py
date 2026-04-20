"""챌린지 서비스 — 참여, 체크인, 스트릭 계산, 추천.

핵심 규칙:
- 최대 2개 동시 진행
- 같은 템플릿 중복 참여 불가 (진행중인 것)
- 스트릭: achieved 연속 → current_streak 증가, missed → 0 리셋
- 진행률: days_completed / target_days (1.0 이상 → 완료)
"""

from __future__ import annotations

from datetime import date, datetime

from fastapi import HTTPException, status

from backend.core import config
from backend.core.cache import delete_cached
from backend.dtos.challenges import (
    CalendarDayEntry,
    ChallengeCalendarResponse,
    ChallengeCatalogItem,
    ChallengeCheckinRequest,
    ChallengeCheckinResponse,
    ChallengeJoinResponse,
    ChallengeOverviewItem,
    ChallengeOverviewResponse,
    ChallengeRecommendedItem,
)
from backend.models.challenges import ChallengeCheckin, ChallengeTemplate, UserChallenge
from backend.models.enums import ChallengeStatus, CheckinStatus, SelectionSource

MAX_ACTIVE_CHALLENGES = 2


class ChallengeService:
    """챌린지 비즈니스 로직."""

    @staticmethod
    async def _invalidate_user_caches(user_id: int) -> None:
        await delete_cached(f"dash:challenge:{user_id}")

    async def get_overview(self, user_id: int) -> ChallengeOverviewResponse:
        """챌린지 전체 조회 (활성 + 완료 + 추천).

        ``today_checked``는 ``ChallengeCheckin`` 테이블을 **오늘 날짜로 직접 조회**하여
        매 요청마다 계산한다 — 자정 크론 누락/타임존 드리프트에도 내구성 확보.
        """
        user_challenges = await UserChallenge.filter(
            user_id=user_id,
        ).prefetch_related("template").order_by("-created_at")

        today = date.today()
        active_uc_ids = [
            uc.id for uc in user_challenges if uc.status == ChallengeStatus.ACTIVE
        ]
        today_checked_ids: set[int] = set()
        if active_uc_ids:
            today_checked_ids = set(
                await ChallengeCheckin.filter(
                    user_challenge_id__in=active_uc_ids,
                    checkin_date=today,
                ).values_list("user_challenge_id", flat=True)
            )

        active: list[ChallengeOverviewItem] = []
        completed: list[ChallengeOverviewItem] = []

        for uc in user_challenges:
            computed_today_checked = (
                uc.id in today_checked_ids
                if uc.status == ChallengeStatus.ACTIVE
                else bool(uc.today_checked)
            )
            item = ChallengeOverviewItem(
                user_challenge_id=uc.id,
                template_id=uc.template_id,
                name=uc.template.name,
                emoji=uc.template.emoji,
                category=uc.template.category,
                status=uc.status,
                is_fixed=uc.selection_source == SelectionSource.SYSTEM_RECOMMENDED,
                current_streak=uc.current_streak,
                best_streak=uc.best_streak,
                progress_pct=float(uc.progress_pct),
                started_at=uc.started_at,
                target_days=uc.target_days,
                days_completed=uc.days_completed,
                today_checked=computed_today_checked,
                selection_source=uc.selection_source,
            )
            if uc.status == ChallengeStatus.ACTIVE:
                active.append(item)
            elif uc.status == ChallengeStatus.COMPLETED:
                completed.append(item)

        # 오늘 체크인한 템플릿 ID 집합 — 당일 재참여 차단 플래그 계산용
        checked_today_template_ids: set[int] = set()
        user_uc_ids = [uc.id for uc in user_challenges]
        if user_uc_ids:
            rows = await ChallengeCheckin.filter(
                user_challenge_id__in=user_uc_ids,
                checkin_date=today,
            ).values("user_challenge_id")
            checked_uc_id_set = {r["user_challenge_id"] for r in rows}
            checked_today_template_ids = {
                uc.template_id for uc in user_challenges if uc.id in checked_uc_id_set
            }

        # 추천 챌린지
        from backend.models.health import HealthProfile
        profile = await HealthProfile.get_or_none(user_id=user_id)
        user_group = profile.user_group.value if profile and hasattr(profile.user_group, "value") else (profile.user_group if profile else "C")
        recommended = await self._get_recommended(user_id, user_group, checked_today_template_ids)
        catalog = await self._get_catalog(user_id, user_group, recommended, checked_today_template_ids)

        return ChallengeOverviewResponse(
            active=active,
            completed=completed,
            recommended=recommended,
            catalog=catalog,
            stats={
                "active_count": len(active),
                "completed_count": len(completed),
                "max_active_count": MAX_ACTIVE_CHALLENGES,
                "remaining_active_slots": max(0, MAX_ACTIVE_CHALLENGES - len(active)),
            },
        )

    async def join_challenge(
        self, user_id: int, template_id: int
    ) -> ChallengeJoinResponse:
        """챌린지 참여."""
        template = await ChallengeTemplate.get_or_none(
            id=template_id, is_active=True,
        )
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="존재하지 않거나 비활성화된 챌린지입니다.",
            )

        # 최대 2개 제한
        active_count = await UserChallenge.filter(
            user_id=user_id, status=ChallengeStatus.ACTIVE,
        ).count()
        if active_count >= MAX_ACTIVE_CHALLENGES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"동시에 최대 {MAX_ACTIVE_CHALLENGES}개까지만 참여할 수 있습니다.",
            )

        # 같은 템플릿 중복 참여 불가
        existing = await UserChallenge.get_or_none(
            user_id=user_id,
            template_id=template_id,
            status=ChallengeStatus.ACTIVE,
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 진행 중인 챌린지입니다.",
            )

        # 같은 템플릿을 오늘 체크인한 이력이 있으면 당일 재참여 차단
        # (취소 후 재선택 시 하루에 같은 챌린지 2번 체크인되는 왜곡 방지)
        today = date.today()
        checkin_today = await ChallengeCheckin.filter(
            user_challenge__user_id=user_id,
            user_challenge__template_id=template_id,
            checkin_date=today,
        ).exists()
        if checkin_today:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="오늘 체크인한 챌린지는 내일부터 다시 시작할 수 있습니다.",
            )

        now = datetime.now(tz=config.TIMEZONE)
        uc = await UserChallenge.create(
            user_id=user_id,
            template_id=template_id,
            selection_source=SelectionSource.USER_SELECTED,
            status=ChallengeStatus.ACTIVE,
            started_at=now,
            target_days=template.default_duration_days,
        )
        await self._invalidate_user_caches(user_id)
        return ChallengeJoinResponse(
            user_challenge_id=uc.id,
            template_id=template_id,
            status=uc.status,
            selection_source=uc.selection_source,
            started_at=uc.started_at,
            target_days=uc.target_days,
        )

    async def cancel_challenge(
        self, user_id: int, user_challenge_id: int
    ) -> dict:
        """챌린지 취소 (soft delete, ``status=CANCELLED``).

        - 진행 중(``ACTIVE``)인 챌린지만 취소 가능.
        - 오늘 체크인 기록이 있어도 **취소는 허용** — 체크인 레코드는 이력으로 보존.
        - 다만 같은 템플릿의 **당일 재참여**는 ``join_challenge``에서 차단되어
          하루에 같은 챌린지 2번 체크인되는 데이터 왜곡을 방지한다.
        """
        uc = await UserChallenge.get_or_none(
            id=user_challenge_id, user_id=user_id,
        )
        if not uc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="챌린지를 찾을 수 없습니다.",
            )
        if uc.status != ChallengeStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="진행 중인 챌린지만 취소할 수 있습니다.",
            )

        uc.status = ChallengeStatus.CANCELLED
        uc.completed_at = datetime.now(tz=config.TIMEZONE)
        uc.today_checked = False
        await uc.save()
        await self._invalidate_user_caches(user_id)

        return {
            "user_challenge_id": uc.id,
            "status": uc.status.value,
        }

    async def checkin(
        self,
        user_id: int,
        user_challenge_id: int,
        data: ChallengeCheckinRequest,
    ) -> ChallengeCheckinResponse:
        """일일 체크인."""
        uc = await UserChallenge.get_or_none(
            id=user_challenge_id, user_id=user_id,
        )
        if not uc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="챌린지를 찾을 수 없습니다.",
            )
        if uc.status != ChallengeStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="진행 중인 챌린지만 체크인할 수 있습니다.",
            )

        today = date.today()

        # 오늘 이미 체크인했는지 확인
        existing = await ChallengeCheckin.get_or_none(
            user_challenge_id=user_challenge_id, checkin_date=today,
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="오늘은 이미 체크인했습니다.",
            )

        checkin = await ChallengeCheckin.create(
            user_challenge_id=user_challenge_id,
            checkin_date=today,
            status=data.status,
        )

        # 스트릭 업데이트
        self._update_streak(uc, data.status)
        uc.days_completed += 1
        uc.today_checked = True
        uc.progress_pct = round(uc.days_completed / uc.target_days, 3)

        # 완료 체크
        if uc.progress_pct >= 1.0:
            uc.status = ChallengeStatus.COMPLETED
            uc.completed_at = datetime.now(tz=config.TIMEZONE)

        await uc.save()
        await self._invalidate_user_caches(user_id)

        return ChallengeCheckinResponse(
            checkin_id=checkin.id,
            checkin_date=today,
            status=data.status,
            current_streak=uc.current_streak,
            best_streak=uc.best_streak,
            progress_pct=float(uc.progress_pct),
            days_completed=uc.days_completed,
        )

    async def get_calendar(
        self, user_id: int, user_challenge_id: int
    ) -> ChallengeCalendarResponse:
        """챌린지 달력 조회."""
        uc = await UserChallenge.get_or_none(
            id=user_challenge_id, user_id=user_id,
        ).prefetch_related("template")
        if not uc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="챌린지를 찾을 수 없습니다.",
            )

        checkins = await ChallengeCheckin.filter(
            user_challenge_id=user_challenge_id,
        ).order_by("checkin_date")

        entries = [
            CalendarDayEntry(date=c.checkin_date, status=c.status)
            for c in checkins
        ]
        achieved = sum(1 for c in checkins if c.status == CheckinStatus.ACHIEVED)
        missed = sum(1 for c in checkins if c.status == CheckinStatus.MISSED)

        return ChallengeCalendarResponse(
            user_challenge_id=user_challenge_id,
            template_name=uc.template.name,
            entries=entries,
            total_days=uc.target_days,
            achieved_days=achieved,
            missed_days=missed,
        )

    async def _get_recommended(
        self,
        user_id: int,
        user_group: str,
        checked_today_template_ids: set[int] | None = None,
    ) -> list[ChallengeRecommendedItem]:
        """추천 챌린지 목록."""
        # 이미 진행중인 템플릿 ID
        active_ids = await UserChallenge.filter(
            user_id=user_id, status=ChallengeStatus.ACTIVE,
        ).values_list("template_id", flat=True)

        blocked = checked_today_template_ids or set()
        templates = await ChallengeTemplate.filter(is_active=True)
        recommended: list[ChallengeRecommendedItem] = []

        for t in templates:
            if t.id in active_ids:
                continue
            if user_group not in t.for_groups:
                continue
            recommended.append(ChallengeRecommendedItem(
                template_id=t.id,
                name=t.name,
                emoji=t.emoji,
                category=t.category,
                description=t.description,
                default_duration_days=t.default_duration_days,
                blocked_today=t.id in blocked,
            ))

        return recommended[:5]

    async def _get_catalog(
        self,
        user_id: int,
        user_group: str,
        recommended: list[ChallengeRecommendedItem],
        checked_today_template_ids: set[int] | None = None,
    ) -> list[ChallengeCatalogItem]:
        recommended_ids = {item.template_id for item in recommended}
        blocked = checked_today_template_ids or set()
        templates = await ChallengeTemplate.filter(is_active=True).order_by("category", "id")

        catalog: list[ChallengeCatalogItem] = []
        for template in templates:
            if user_group not in template.for_groups:
                continue
            catalog.append(
                ChallengeCatalogItem(
                    template_id=template.id,
                    code=template.code,
                    name=template.name,
                    emoji=template.emoji,
                    category=template.category,
                    description=template.description,
                    default_duration_days=template.default_duration_days,
                    is_recommended=template.id in recommended_ids,
                    blocked_today=template.id in blocked,
                )
            )

        return catalog

    @staticmethod
    def _update_streak(uc: UserChallenge, checkin_status: CheckinStatus) -> None:
        """스트릭 업데이트."""
        if checkin_status == CheckinStatus.ACHIEVED:
            uc.current_streak += 1
            if uc.current_streak > uc.best_streak:
                uc.best_streak = uc.current_streak
        elif checkin_status == CheckinStatus.MISSED:
            uc.current_streak = 0
