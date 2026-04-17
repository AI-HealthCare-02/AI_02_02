"""Challenge service for overview, join, check-in, and badge progression."""

from __future__ import annotations

from datetime import date, datetime

from fastapi import HTTPException, status

from backend.core import config
from backend.core.cache import delete_cached
from backend.dtos.challenges import (
    CalendarDayEntry,
    ChallengeBadgeItem,
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
CHALLENGE_DURATION_DAYS = 7
BADGE_TIERS = (
    ("challenger", "Challenger", 365),
    ("master", "Master", 200),
    ("diamond", "Diamond", 100),
    ("gold", "Gold", 50),
    ("silver", "Silver", 30),
    ("bronze", "Bronze", 10),
)


class ChallengeService:
    """Business logic for challenge participation and progression."""

    @staticmethod
    async def _invalidate_user_caches(user_id: int) -> None:
        await delete_cached(f"dash:challenge:{user_id}")

    async def get_overview(self, user_id: int) -> ChallengeOverviewResponse:
        user_challenges = await UserChallenge.filter(user_id=user_id).prefetch_related("template").order_by("-created_at")
        templates = await ChallengeTemplate.filter(is_active=True).order_by("category", "id")
        completion_counts = await self._get_completion_counts(user_id=user_id)

        active: list[ChallengeOverviewItem] = []
        completed: list[ChallengeOverviewItem] = []

        for user_challenge in user_challenges:
            badge_progress = self._build_badge_progress(completion_counts.get(user_challenge.template_id, 0))
            item = ChallengeOverviewItem(
                user_challenge_id=user_challenge.id,
                template_id=user_challenge.template_id,
                name=user_challenge.template.name,
                emoji=user_challenge.template.emoji,
                category=user_challenge.template.category,
                status=user_challenge.status,
                is_fixed=user_challenge.selection_source == SelectionSource.SYSTEM_RECOMMENDED,
                current_streak=user_challenge.current_streak,
                best_streak=user_challenge.best_streak,
                progress_pct=float(user_challenge.progress_pct),
                started_at=user_challenge.started_at,
                target_days=user_challenge.target_days,
                days_completed=user_challenge.days_completed,
                today_checked=user_challenge.today_checked,
                selection_source=user_challenge.selection_source,
                lifetime_completed_count=badge_progress["completed_count"],
                badge_tier=badge_progress["badge_tier"],
                badge_label=badge_progress["badge_label"],
                next_badge_tier=badge_progress["next_badge_tier"],
                next_badge_label=badge_progress["next_badge_label"],
                remaining_to_next_badge=badge_progress["remaining_to_next_badge"],
            )
            if user_challenge.status == ChallengeStatus.ACTIVE:
                active.append(item)
            elif user_challenge.status == ChallengeStatus.COMPLETED:
                completed.append(item)

        from backend.models.health import HealthProfile

        profile = await HealthProfile.get_or_none(user_id=user_id)
        user_group = profile.user_group.value if profile and hasattr(profile.user_group, "value") else (profile.user_group if profile else "C")

        recommended = await self._get_recommended(
            user_id=user_id,
            user_group=user_group,
            templates=templates,
            completion_counts=completion_counts,
        )
        catalog = self._get_catalog(
            user_group=user_group,
            templates=templates,
            recommended=recommended,
            completion_counts=completion_counts,
        )
        badges = self._build_badges(templates=templates, completion_counts=completion_counts)

        return ChallengeOverviewResponse(
            active=active,
            completed=completed,
            recommended=recommended,
            catalog=catalog,
            badges=badges,
            stats={
                "active_count": len(active),
                "completed_count": len(completed),
                "earned_badge_count": len(badges),
                "max_active_count": MAX_ACTIVE_CHALLENGES,
                "remaining_active_slots": max(0, MAX_ACTIVE_CHALLENGES - len(active)),
            },
        )

    async def join_challenge(self, user_id: int, template_id: int) -> ChallengeJoinResponse:
        template = await ChallengeTemplate.get_or_none(id=template_id, is_active=True)
        if not template:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found.")

        active_count = await UserChallenge.filter(user_id=user_id, status=ChallengeStatus.ACTIVE).count()
        if active_count >= MAX_ACTIVE_CHALLENGES:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Too many active challenges.")

        existing = await UserChallenge.get_or_none(
            user_id=user_id,
            template_id=template_id,
            status=ChallengeStatus.ACTIVE,
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Challenge is already active.")

        now = datetime.now(tz=config.TIMEZONE)
        user_challenge = await UserChallenge.create(
            user_id=user_id,
            template_id=template_id,
            selection_source=SelectionSource.USER_SELECTED,
            status=ChallengeStatus.ACTIVE,
            started_at=now,
            target_days=CHALLENGE_DURATION_DAYS,
        )
        await self._invalidate_user_caches(user_id)
        return ChallengeJoinResponse(
            user_challenge_id=user_challenge.id,
            template_id=template_id,
            status=user_challenge.status,
            selection_source=user_challenge.selection_source,
            started_at=user_challenge.started_at,
            target_days=user_challenge.target_days,
        )

    async def checkin(
        self,
        user_id: int,
        user_challenge_id: int,
        data: ChallengeCheckinRequest,
    ) -> ChallengeCheckinResponse:
        user_challenge = await UserChallenge.get_or_none(id=user_challenge_id, user_id=user_id)
        if not user_challenge:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found.")
        if user_challenge.status != ChallengeStatus.ACTIVE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge is not active.")

        today = date.today()
        existing = await ChallengeCheckin.get_or_none(user_challenge_id=user_challenge_id, checkin_date=today)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Challenge already checked in today.")

        checkin = await ChallengeCheckin.create(
            user_challenge_id=user_challenge_id,
            checkin_date=today,
            status=data.status,
        )

        self._update_streak(user_challenge, data.status)
        user_challenge.days_completed += 1
        user_challenge.today_checked = True
        user_challenge.progress_pct = round(user_challenge.days_completed / user_challenge.target_days, 3)

        if user_challenge.progress_pct >= 1.0:
            user_challenge.status = ChallengeStatus.COMPLETED
            user_challenge.completed_at = datetime.now(tz=config.TIMEZONE)

        await user_challenge.save()
        await self._invalidate_user_caches(user_id)

        return ChallengeCheckinResponse(
            checkin_id=checkin.id,
            checkin_date=today,
            status=data.status,
            current_streak=user_challenge.current_streak,
            best_streak=user_challenge.best_streak,
            progress_pct=float(user_challenge.progress_pct),
            days_completed=user_challenge.days_completed,
        )

    async def cancel_challenge(self, user_id: int, user_challenge_id: int) -> None:
        user_challenge = await UserChallenge.get_or_none(id=user_challenge_id, user_id=user_id)
        if not user_challenge:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found.")
        if user_challenge.status != ChallengeStatus.ACTIVE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge is not active.")

        user_challenge.status = ChallengeStatus.FAILED
        user_challenge.ends_at = datetime.now(tz=config.TIMEZONE)
        user_challenge.today_checked = False
        await user_challenge.save()
        await self._invalidate_user_caches(user_id)

    async def get_calendar(self, user_id: int, user_challenge_id: int) -> ChallengeCalendarResponse:
        user_challenge = await UserChallenge.get_or_none(id=user_challenge_id, user_id=user_id).prefetch_related("template")
        if not user_challenge:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found.")

        checkins = await ChallengeCheckin.filter(user_challenge_id=user_challenge_id).order_by("checkin_date")
        entries = [CalendarDayEntry(date=checkin.checkin_date, status=checkin.status) for checkin in checkins]
        achieved = sum(1 for checkin in checkins if checkin.status == CheckinStatus.ACHIEVED)
        missed = sum(1 for checkin in checkins if checkin.status == CheckinStatus.MISSED)

        return ChallengeCalendarResponse(
            user_challenge_id=user_challenge_id,
            template_name=user_challenge.template.name,
            entries=entries,
            total_days=user_challenge.target_days,
            achieved_days=achieved,
            missed_days=missed,
        )

    async def _get_recommended(
        self,
        *,
        user_id: int,
        user_group: str,
        templates: list[ChallengeTemplate],
        completion_counts: dict[int, int],
    ) -> list[ChallengeRecommendedItem]:
        active_ids = await UserChallenge.filter(user_id=user_id, status=ChallengeStatus.ACTIVE).values_list("template_id", flat=True)
        active_id_set = set(active_ids)
        reason_by_category = {
            "exercise": "Recommended to improve activity consistency.",
            "diet": "Recommended to support better meal balance.",
            "sleep": "Recommended to stabilize sleep routine.",
            "hydration": "Recommended to build water intake habit.",
            "medication": "Recommended to strengthen medication routine.",
            "lifestyle": "Recommended to improve lifestyle rhythm.",
        }

        recommended: list[ChallengeRecommendedItem] = []
        for template in templates:
            if template.id in active_id_set or user_group not in template.for_groups:
                continue

            badge_progress = self._build_badge_progress(completion_counts.get(template.id, 0))
            recommended.append(
                ChallengeRecommendedItem(
                    template_id=template.id,
                    code=template.code,
                    name=template.name,
                    emoji=template.emoji,
                    category=template.category,
                    description=template.description,
                    default_duration_days=CHALLENGE_DURATION_DAYS,
                    recommendation_reason=reason_by_category.get(str(template.category), "Recommended for the current user state."),
                    lifetime_completed_count=badge_progress["completed_count"],
                    badge_tier=badge_progress["badge_tier"],
                    badge_label=badge_progress["badge_label"],
                    next_badge_tier=badge_progress["next_badge_tier"],
                    next_badge_label=badge_progress["next_badge_label"],
                    remaining_to_next_badge=badge_progress["remaining_to_next_badge"],
                )
            )

        return recommended[:5]

    def _get_catalog(
        self,
        *,
        user_group: str,
        templates: list[ChallengeTemplate],
        recommended: list[ChallengeRecommendedItem],
        completion_counts: dict[int, int],
    ) -> list[ChallengeCatalogItem]:
        recommended_ids = {item.template_id for item in recommended}
        catalog: list[ChallengeCatalogItem] = []

        for template in templates:
            if user_group not in template.for_groups:
                continue
            badge_progress = self._build_badge_progress(completion_counts.get(template.id, 0))
            catalog.append(
                ChallengeCatalogItem(
                    template_id=template.id,
                    code=template.code,
                    name=template.name,
                    emoji=template.emoji,
                    category=template.category,
                    description=template.description,
                    default_duration_days=CHALLENGE_DURATION_DAYS,
                    is_recommended=template.id in recommended_ids,
                    lifetime_completed_count=badge_progress["completed_count"],
                    badge_tier=badge_progress["badge_tier"],
                    badge_label=badge_progress["badge_label"],
                    next_badge_tier=badge_progress["next_badge_tier"],
                    next_badge_label=badge_progress["next_badge_label"],
                    remaining_to_next_badge=badge_progress["remaining_to_next_badge"],
                )
            )

        return catalog

    async def _get_completion_counts(self, user_id: int) -> dict[int, int]:
        completed_rows = await UserChallenge.filter(user_id=user_id, status=ChallengeStatus.COMPLETED).values("template_id")
        counts: dict[int, int] = {}
        for row in completed_rows:
            template_id = int(row["template_id"])
            counts[template_id] = counts.get(template_id, 0) + 1
        return counts

    def _build_badges(
        self,
        *,
        templates: list[ChallengeTemplate],
        completion_counts: dict[int, int],
    ) -> list[ChallengeBadgeItem]:
        badges: list[ChallengeBadgeItem] = []
        for template in templates:
            completed_count = completion_counts.get(template.id, 0)
            if completed_count <= 0:
                continue

            badge_progress = self._build_badge_progress(completed_count)
            if badge_progress["badge_tier"] == "unranked":
                continue

            badges.append(
                ChallengeBadgeItem(
                    template_id=template.id,
                    code=template.code,
                    name=template.name,
                    emoji=template.emoji,
                    category=template.category,
                    completed_count=completed_count,
                    badge_tier=badge_progress["badge_tier"],
                    badge_label=badge_progress["badge_label"],
                    badge_goal_count=badge_progress["badge_goal_count"],
                    next_badge_tier=badge_progress["next_badge_tier"],
                    next_badge_label=badge_progress["next_badge_label"],
                    next_badge_goal_count=badge_progress["next_badge_goal_count"],
                    remaining_to_next_badge=badge_progress["remaining_to_next_badge"],
                )
            )

        return sorted(badges, key=lambda item: (-item.badge_goal_count, -item.completed_count, item.name))

    @staticmethod
    def _build_badge_progress(completed_count: int) -> dict[str, int | str | None]:
        for index, (tier_key, tier_label, threshold) in enumerate(BADGE_TIERS):
            if completed_count >= threshold:
                next_tier = BADGE_TIERS[index - 1] if index > 0 else None
                return {
                    "completed_count": completed_count,
                    "badge_tier": tier_key,
                    "badge_label": tier_label,
                    "badge_goal_count": threshold,
                    "next_badge_tier": next_tier[0] if next_tier else None,
                    "next_badge_label": next_tier[1] if next_tier else None,
                    "next_badge_goal_count": next_tier[2] if next_tier else None,
                    "remaining_to_next_badge": max(0, next_tier[2] - completed_count) if next_tier else 0,
                }

        bronze_threshold = BADGE_TIERS[-1][2]
        return {
            "completed_count": completed_count,
            "badge_tier": "unranked",
            "badge_label": "Unranked",
            "badge_goal_count": 0,
            "next_badge_tier": BADGE_TIERS[-1][0],
            "next_badge_label": BADGE_TIERS[-1][1],
            "next_badge_goal_count": bronze_threshold,
            "remaining_to_next_badge": max(0, bronze_threshold - completed_count),
        }

    @staticmethod
    def _update_streak(user_challenge: UserChallenge, checkin_status: CheckinStatus) -> None:
        if checkin_status == CheckinStatus.ACHIEVED:
            user_challenge.current_streak += 1
            if user_challenge.current_streak > user_challenge.best_streak:
                user_challenge.best_streak = user_challenge.current_streak
        elif checkin_status == CheckinStatus.MISSED:
            user_challenge.current_streak = 0
