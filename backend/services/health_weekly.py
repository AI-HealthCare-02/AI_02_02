from __future__ import annotations

from datetime import date, timedelta

from backend.dtos.health import HealthWeeklyResponse, WeeklyCategoryResponse, WeeklySeriesPoint
from backend.models.health import DailyHealthLog

SLEEP_QUALITY_SCORE = {
    "very_good": 100,
    "good": 80,
    "normal": 60,
    "bad": 30,
    "very_bad": 10,
}
SLEEP_DURATION_BONUS = {
    "between_7_8": 10,
    "over_8": 5,
    "between_6_7": 0,
    "between_5_6": -10,
    "under_5": -20,
}
VEGETABLE_SCORE = {"enough": 30, "little": 15, "none": 0}
BALANCE_SCORE = {"balanced": 30, "protein_veg_heavy": 20, "carb_heavy": 10}
SWEETDRINK_SCORE = {"none": 20, "one": 10, "two_plus": 0}
NIGHTSNACK_SCORE = {"none": 20, "light": 10, "heavy": 0}

CATEGORY_GOALS = {
    "sleep": 80.0,
    "diet": 80.0,
    "exercise": 80.0,
    "hydration": 100.0,
}


def _avg(values: list[float | None]) -> float | None:
    valid = [value for value in values if value is not None]
    if not valid:
        return None
    return round(sum(valid) / len(valid), 1)


def _sleep_score(log: DailyHealthLog | None) -> float | None:
    if not log:
        return None
    if not log.sleep_quality and not log.sleep_duration_bucket:
        return None
    base = SLEEP_QUALITY_SCORE.get(log.sleep_quality, 60 if log.sleep_duration_bucket else 0)
    bonus = SLEEP_DURATION_BONUS.get(log.sleep_duration_bucket, 0)
    return float(max(0, min(100, round(base + bonus))))


def _diet_score(log: DailyHealthLog | None) -> float | None:
    if not log:
        return None
    has_any = any(
        getattr(log, field) is not None
        for field in (
            "vegetable_intake_level",
            "meal_balance_level",
            "sweetdrink_level",
            "nightsnack_level",
        )
    )
    if not has_any:
        return None
    score = (
        VEGETABLE_SCORE.get(log.vegetable_intake_level, 0)
        + BALANCE_SCORE.get(log.meal_balance_level, 0)
        + SWEETDRINK_SCORE.get(log.sweetdrink_level, 0)
        + NIGHTSNACK_SCORE.get(log.nightsnack_level, 0)
    )
    return float(max(0, min(100, score)))


def _exercise_score(log: DailyHealthLog | None) -> float | None:
    if not log:
        return None
    if log.exercise_done is None and log.walk_done is None and log.exercise_minutes is None:
        return None
    score = 0
    if log.exercise_done:
        score += 50
    if log.exercise_minutes:
        score += min(30, round((log.exercise_minutes / 30) * 30))
    if log.walk_done:
        score += 20
    return float(max(0, min(100, score)))


def _hydration_score(log: DailyHealthLog | None) -> float | None:
    if not log or log.water_cups is None:
        return None
    return float(max(0, min(100, round((log.water_cups / 8) * 100))))


class HealthWeeklyService:
    async def get_weekly_summary(self, user_id: int) -> HealthWeeklyResponse:
        today = date.today()
        week_end = today
        week_start = today - timedelta(days=6)
        previous_week_end = week_start - timedelta(days=1)
        previous_week_start = previous_week_end - timedelta(days=6)

        logs = await DailyHealthLog.filter(
            user_id=user_id,
            log_date__gte=previous_week_start,
            log_date__lte=week_end,
        ).order_by("log_date")
        log_map = {log.log_date: log for log in logs}

        current_dates = [week_start + timedelta(days=offset) for offset in range(7)]
        previous_dates = [previous_week_start + timedelta(days=offset) for offset in range(7)]
        categories = {
            "sleep": _sleep_score,
            "diet": _diet_score,
            "exercise": _exercise_score,
            "hydration": _hydration_score,
        }

        response_categories: dict[str, WeeklyCategoryResponse] = {}
        for name, scorer in categories.items():
            current_values = [scorer(log_map.get(day)) for day in current_dates]
            previous_values = [scorer(log_map.get(day)) for day in previous_dates]
            current_avg = _avg(current_values)
            previous_avg = _avg(previous_values)
            change = None
            if current_avg is not None and previous_avg is not None:
                change = round(current_avg - previous_avg, 1)

            response_categories[name] = WeeklyCategoryResponse(
                current_value=current_avg,
                previous_value=previous_avg,
                change=change,
                goal_value=CATEGORY_GOALS[name],
                series=[
                    WeeklySeriesPoint(
                        date=day,
                        value=value,
                        goal_value=CATEGORY_GOALS[name],
                    )
                    for day, value in zip(current_dates, current_values, strict=True)
                ],
            )

        return HealthWeeklyResponse(
            week_start=week_start,
            week_end=week_end,
            previous_week_start=previous_week_start,
            previous_week_end=previous_week_end,
            categories=response_categories,
        )
