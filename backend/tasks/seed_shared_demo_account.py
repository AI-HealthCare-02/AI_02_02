"""Seed shared comparison accounts with 100 days of health data."""

from __future__ import annotations

import asyncio
import sys
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal

sys.path.insert(0, ".")

from tortoise import Tortoise

from backend.core import config
from backend.db.databases import TORTOISE_ORM
from backend.models.assessments import RiskAssessment, UserEngagement
from backend.models.challenges import ChallengeCheckin, ChallengeTemplate, UserChallenge
from backend.models.consents import UserConsent
from backend.models.enums import (
    AgeRange,
    AiConsent,
    AlcoholAmountLevel,
    AlcoholFrequency,
    ChallengeCategory,
    ChallengeStatus,
    CheckinStatus,
    DataSource,
    ExerciseFrequency,
    ExerciseType,
    FamilyHistory,
    FastingGlucoseRange,
    HbA1cRange,
    MealBalanceLevel,
    MealStatus,
    MeasurementSource,
    MoodLevel,
    NightsnackLevel,
    PeriodType,
    Relation,
    RiskLevel,
    SelectionSource,
    SleepDurationBucket,
    SleepQuality,
    SmokingStatus,
    SweetdrinkLevel,
    UserGroup,
    VegetableIntakeLevel,
)
from backend.models.health import DailyHealthLog, HealthProfile, PeriodicMeasurement
from backend.models.settings import UserSettings
from backend.models.users import Gender, User
from backend.services.prediction import calculate_findrisc
from backend.services.risk_analysis import RiskAnalysisService
from backend.utils.security import hash_password

TOTAL_DAYS = 100
HISTORY_WEEKS = 12
LEGACY_SHARED_EMAILS = ["shared-demo@danaa.local", "danaa123@danaa.com"]

AGE_NUMERIC = {
    AgeRange.UNDER_45: 40,
    AgeRange.BETWEEN_45_54: 50,
    AgeRange.BETWEEN_55_64: 60,
    AgeRange.OVER_65: 70,
}

CHALLENGE_TEMPLATES = [
    {
        "code": "daily_walk_30min",
        "name": "매일 30분 걷기",
        "emoji": "walk",
        "category": ChallengeCategory.EXERCISE,
        "description": "하루 30분 이상 걸어요.",
        "goal_criteria": {"field": "walk_done", "daily_target": True},
        "default_duration_days": 14,
        "evidence_summary": "공유 데모 검증용 간단 걷기 목표.",
        "for_groups": ["A", "B", "C"],
    },
    {
        "code": "sleep_7h",
        "name": "7시간 숙면",
        "emoji": "sleep",
        "category": ChallengeCategory.SLEEP,
        "description": "하루 7시간 이상 자요.",
        "goal_criteria": {
            "field": "sleep_duration_bucket",
            "daily_target": [SleepDurationBucket.BETWEEN_7_8.value, SleepDurationBucket.OVER_8.value],
        },
        "default_duration_days": 14,
        "evidence_summary": "리포트·챌린지 테스트용 수면 일관성 목표.",
        "for_groups": ["A", "B", "C"],
    },
    {
        "code": "water_6cups",
        "name": "물 6잔 마시기",
        "emoji": "water",
        "category": ChallengeCategory.HYDRATION,
        "description": "하루 물 6잔 이상 마셔요.",
        "goal_criteria": {"field": "water_cups", "daily_target": 6},
        "default_duration_days": 14,
        "evidence_summary": "완료 사례 예시용 수분 섭취 목표.",
        "for_groups": ["A", "B", "C"],
    },
]


def get_shared_password() -> str:
    password = config.SHARED_DEMO_PASSWORD.strip()
    if password:
        return password

    raise RuntimeError(
        "SHARED_DEMO_PASSWORD is not set. Add it to your local .env before running the shared demo seed."
    )


@dataclass(frozen=True)
class MeasurementPlan:
    weight_start: float
    weight_end: float
    waist_start: float
    waist_end: float
    systolic_start: int
    systolic_end: int
    diastolic_start: int
    diastolic_end: int
    glucose_start: int | None
    glucose_end: int | None
    hba1c_start: float | None
    hba1c_end: float | None


@dataclass(frozen=True)
class SeedAccountConfig:
    email: str
    name: str
    nickname: str
    phone_number: str
    gender: Gender
    birthday: date
    relation: Relation
    user_group: UserGroup
    age_range: AgeRange
    height_cm: float
    current_weight_kg: float
    bmi: float
    family_history: FamilyHistory
    has_hypertension: bool
    has_high_glucose_history: bool
    hba1c_range: HbA1cRange
    fasting_glucose_range: FastingGlucoseRange
    exercise_frequency: ExerciseFrequency
    diet_habits: list[str]
    sleep_duration_bucket: SleepDurationBucket
    alcohol_frequency: AlcoholFrequency
    smoking_status: SmokingStatus
    conditions: list[str]
    treatments: list[str]
    goals: list[str]
    initial_findrisc_score: int
    initial_risk_level: RiskLevel
    scenario: str
    engagement_response_rate: str
    total_responses: int
    measurement_plan: MeasurementPlan


@dataclass
class MeasurementSnapshot:
    measured_at: datetime
    measurement_type: str
    numeric_value: Decimal
    numeric_value_2: Decimal | None = None
    unit: str = ""


SEED_ACCOUNTS = [
    SeedAccountConfig(
        email="danaa1@danaa.com",
        name="DANAA Risk Demo",
        nickname="risk-demo",
        phone_number="01010000001",
        gender=Gender.MALE,
        birthday=date(1972, 3, 18),
        relation=Relation.DIAGNOSED,
        user_group=UserGroup.A,
        age_range=AgeRange.BETWEEN_45_54,
        height_cm=171.0,
        current_weight_kg=92.0,
        bmi=31.5,
        family_history=FamilyHistory.BOTH,
        has_hypertension=True,
        has_high_glucose_history=True,
        hba1c_range=HbA1cRange.OVER_7,
        fasting_glucose_range=FastingGlucoseRange.OVER_126,
        exercise_frequency=ExerciseFrequency.NONE,
        diet_habits=["carb_heavy", "sugary_drink", "late_snack", "irregular_meals"],
        sleep_duration_bucket=SleepDurationBucket.BETWEEN_5_6,
        alcohol_frequency=AlcoholFrequency.OFTEN,
        smoking_status=SmokingStatus.CURRENT,
        conditions=["hypertension", "high_glucose"],
        treatments=["oral_med"],
        goals=["risk_assessment", "diet_improvement", "exercise_habit"],
        initial_findrisc_score=23,
        initial_risk_level=RiskLevel.VERY_HIGH,
        scenario="risk_diabetic",
        engagement_response_rate="0.786",
        total_responses=81,
        measurement_plan=MeasurementPlan(
            weight_start=88.0,
            weight_end=92.0,
            waist_start=101.0,
            waist_end=108.0,
            systolic_start=142,
            systolic_end=155,
            diastolic_start=92,
            diastolic_end=101,
            glucose_start=132,
            glucose_end=168,
            hba1c_start=6.8,
            hba1c_end=7.6,
        ),
    ),
    SeedAccountConfig(
        email="danaa2@danaa.com",
        name="DANAA Compare Demo",
        nickname="compare-demo",
        phone_number="01010000002",
        gender=Gender.FEMALE,
        birthday=date(1991, 7, 12),
        relation=Relation.PREVENTION,
        user_group=UserGroup.C,
        age_range=AgeRange.UNDER_45,
        height_cm=164.0,
        current_weight_kg=58.5,
        bmi=21.8,
        family_history=FamilyHistory.NONE,
        has_hypertension=False,
        has_high_glucose_history=False,
        hba1c_range=HbA1cRange.UNDER_5_7,
        fasting_glucose_range=FastingGlucoseRange.UNDER_100,
        exercise_frequency=ExerciseFrequency.FIVE_PLUS,
        diet_habits=["veggies_daily"],
        sleep_duration_bucket=SleepDurationBucket.BETWEEN_7_8,
        alcohol_frequency=AlcoholFrequency.SOMETIMES,
        smoking_status=SmokingStatus.NON_SMOKER,
        conditions=[],
        treatments=["nothing"],
        goals=["health_tracking", "exercise_habit"],
        initial_findrisc_score=4,
        initial_risk_level=RiskLevel.LOW,
        scenario="healthy_prevention",
        engagement_response_rate="0.943",
        total_responses=96,
        measurement_plan=MeasurementPlan(
            weight_start=60.0,
            weight_end=58.5,
            waist_start=76.0,
            waist_end=73.0,
            systolic_start=116,
            systolic_end=111,
            diastolic_start=75,
            diastolic_end=71,
            glucose_start=95,
            glucose_end=90,
            hba1c_start=5.5,
            hba1c_end=5.3,
        ),
    ),
]


def aware_datetime(target_date: date, *, hour: int = 9, minute: int = 0) -> datetime:
    return datetime.combine(target_date, time(hour=hour, minute=minute), tzinfo=config.TIMEZONE)


def lerp(start: float, end: float, ratio: float) -> float:
    return start + ((end - start) * ratio)


def rolling_bool(index: int, *, cycle: int, threshold: int) -> bool:
    return (index % cycle) < threshold


def build_daily_log_payload(*, log_date: date, index: int, scenario: str) -> dict:
    if scenario == "risk_diabetic":
        if index >= 80:
            sleep_duration = SleepDurationBucket.UNDER_5 if index % 3 == 0 else SleepDurationBucket.BETWEEN_5_6
            sleep_quality = SleepQuality.BAD if index % 4 else SleepQuality.VERY_BAD
            vegetable = VegetableIntakeLevel.NONE if index % 3 else VegetableIntakeLevel.LITTLE
            meal_balance = MealBalanceLevel.CARB_HEAVY
            sweetdrink = SweetdrinkLevel.TWO_PLUS
            nightsnack = NightsnackLevel.HEAVY if index % 2 == 0 else NightsnackLevel.LIGHT
            exercise_done = False
            walk_done = index % 10 == 0
            exercise_minutes = None
            water_cups = 2 if index % 2 == 0 else 3
            mood = MoodLevel.VERY_STRESSED if index % 3 == 0 else MoodLevel.STRESSED
            alcohol_today = index % 2 == 0
            alcohol_amount = AlcoholAmountLevel.HEAVY if alcohol_today else None
        elif index >= 45:
            sleep_duration = SleepDurationBucket.BETWEEN_5_6
            sleep_quality = SleepQuality.BAD if index % 5 else SleepQuality.NORMAL
            vegetable = VegetableIntakeLevel.LITTLE
            meal_balance = MealBalanceLevel.CARB_HEAVY
            sweetdrink = SweetdrinkLevel.TWO_PLUS if index % 2 == 0 else SweetdrinkLevel.ONE
            nightsnack = NightsnackLevel.LIGHT if index % 3 else NightsnackLevel.HEAVY
            exercise_done = rolling_bool(index, cycle=7, threshold=1)
            walk_done = rolling_bool(index, cycle=7, threshold=2)
            exercise_minutes = 20 if exercise_done else None
            water_cups = 3 if index % 2 == 0 else 4
            mood = MoodLevel.STRESSED
            alcohol_today = index % 3 == 0
            alcohol_amount = AlcoholAmountLevel.MODERATE if alcohol_today else None
        else:
            sleep_duration = SleepDurationBucket.BETWEEN_6_7 if index % 3 else SleepDurationBucket.BETWEEN_5_6
            sleep_quality = SleepQuality.NORMAL
            vegetable = VegetableIntakeLevel.LITTLE
            meal_balance = MealBalanceLevel.CARB_HEAVY if index % 4 else MealBalanceLevel.BALANCED
            sweetdrink = SweetdrinkLevel.ONE if index % 4 else SweetdrinkLevel.TWO_PLUS
            nightsnack = NightsnackLevel.LIGHT
            exercise_done = rolling_bool(index, cycle=7, threshold=2)
            walk_done = rolling_bool(index, cycle=7, threshold=3)
            exercise_minutes = 25 if exercise_done else None
            water_cups = 4
            mood = MoodLevel.NORMAL if index % 4 else MoodLevel.STRESSED
            alcohol_today = index % 5 == 0
            alcohol_amount = AlcoholAmountLevel.MODERATE if alcohol_today else None
    else:
        if index >= 70:
            sleep_duration = SleepDurationBucket.BETWEEN_7_8 if index % 6 else SleepDurationBucket.OVER_8
            sleep_quality = SleepQuality.GOOD if index % 5 else SleepQuality.VERY_GOOD
            vegetable = VegetableIntakeLevel.ENOUGH
            meal_balance = MealBalanceLevel.BALANCED if index % 4 else MealBalanceLevel.PROTEIN_VEG_HEAVY
            sweetdrink = SweetdrinkLevel.NONE if index % 7 else SweetdrinkLevel.ONE
            nightsnack = NightsnackLevel.NONE if index % 5 else NightsnackLevel.LIGHT
            exercise_done = rolling_bool(index, cycle=7, threshold=5)
            walk_done = rolling_bool(index, cycle=7, threshold=6)
            exercise_minutes = 45 if exercise_done and index % 3 else 30 if exercise_done else None
            water_cups = 7 if index % 3 else 8
            mood = MoodLevel.GOOD if index % 6 else MoodLevel.VERY_GOOD
            alcohol_today = index % 12 == 0
            alcohol_amount = AlcoholAmountLevel.LIGHT if alcohol_today else None
        else:
            sleep_duration = SleepDurationBucket.BETWEEN_6_7 if index % 5 == 0 else SleepDurationBucket.BETWEEN_7_8
            sleep_quality = SleepQuality.NORMAL if index % 7 == 0 else SleepQuality.GOOD
            vegetable = VegetableIntakeLevel.ENOUGH if index % 4 else VegetableIntakeLevel.LITTLE
            meal_balance = MealBalanceLevel.BALANCED if index % 5 else MealBalanceLevel.PROTEIN_VEG_HEAVY
            sweetdrink = SweetdrinkLevel.NONE if index % 5 else SweetdrinkLevel.ONE
            nightsnack = NightsnackLevel.NONE if index % 4 else NightsnackLevel.LIGHT
            exercise_done = rolling_bool(index, cycle=7, threshold=4)
            walk_done = rolling_bool(index, cycle=7, threshold=5)
            exercise_minutes = 30 if exercise_done else None
            water_cups = 6 if index % 3 else 7
            mood = MoodLevel.NORMAL if index % 6 == 0 else MoodLevel.GOOD
            alcohol_today = index % 14 == 0
            alcohol_amount = AlcoholAmountLevel.LIGHT if alcohol_today else None

    exercise_type = ExerciseType.WALKING if walk_done else ExerciseType.HOME_WORKOUT if exercise_done else None
    source = DataSource.DIRECT
    breakfast = MealStatus.SIMPLE if scenario == "risk_diabetic" and index % 4 == 0 else MealStatus.HEARTY
    lunch = MealStatus.SIMPLE if scenario == "risk_diabetic" and index % 6 == 0 else MealStatus.HEARTY
    dinner = MealStatus.SIMPLE if scenario == "healthy_prevention" and index % 9 == 0 else MealStatus.HEARTY

    return {
        "log_date": log_date,
        "sleep_quality": sleep_quality,
        "sleep_duration_bucket": sleep_duration,
        "breakfast_status": breakfast,
        "lunch_status": lunch,
        "dinner_status": dinner,
        "vegetable_intake_level": vegetable,
        "meal_balance_level": meal_balance,
        "sweetdrink_level": sweetdrink,
        "exercise_done": exercise_done,
        "exercise_type": exercise_type,
        "exercise_minutes": exercise_minutes,
        "walk_done": walk_done,
        "water_cups": water_cups,
        "nightsnack_level": nightsnack,
        "took_medication": scenario == "risk_diabetic",
        "mood_level": mood,
        "alcohol_today": alcohol_today,
        "alcohol_amount_level": alcohol_amount,
        "sleep_quality_source": source,
        "breakfast_status_source": source,
        "lunch_status_source": source,
        "dinner_status_source": source,
        "vegetable_intake_level_source": source,
        "meal_balance_level_source": source,
        "sweetdrink_level_source": source,
        "exercise_done_source": source,
        "walk_done_source": source,
        "water_cups_source": source,
        "nightsnack_level_source": source,
        "took_medication_source": source,
        "mood_level_source": source,
        "alcohol_today_source": source,
    }


def build_measurements(*, start_date: date, plan: MeasurementPlan) -> list[MeasurementSnapshot]:
    measurements: list[MeasurementSnapshot] = []

    for offset in range(0, TOTAL_DAYS, 14):
        target_date = start_date + timedelta(days=offset)
        ratio = offset / max(TOTAL_DAYS - 1, 1)
        weight = round(lerp(plan.weight_start, plan.weight_end, ratio), 1)
        waist = round(lerp(plan.waist_start, plan.waist_end, ratio), 1)
        measurements.append(
            MeasurementSnapshot(
                measured_at=aware_datetime(target_date, hour=8),
                measurement_type="weight",
                numeric_value=Decimal(str(weight)),
                unit="kg",
            )
        )
        measurements.append(
            MeasurementSnapshot(
                measured_at=aware_datetime(target_date, hour=8, minute=30),
                measurement_type="waist",
                numeric_value=Decimal(str(waist)),
                unit="cm",
            )
        )

    for offset in range(0, TOTAL_DAYS, 21):
        target_date = start_date + timedelta(days=offset)
        ratio = offset / max(TOTAL_DAYS - 1, 1)
        systolic = round(lerp(plan.systolic_start, plan.systolic_end, ratio))
        diastolic = round(lerp(plan.diastolic_start, plan.diastolic_end, ratio))
        measurements.append(
            MeasurementSnapshot(
                measured_at=aware_datetime(target_date, hour=7, minute=40),
                measurement_type="blood_pressure",
                numeric_value=Decimal(str(systolic)),
                numeric_value_2=Decimal(str(diastolic)),
                unit="mmHg",
            )
        )

    if plan.glucose_start is not None and plan.glucose_end is not None:
        for offset in range(0, TOTAL_DAYS, 30):
            target_date = start_date + timedelta(days=offset)
            ratio = offset / max(TOTAL_DAYS - 1, 1)
            glucose = round(lerp(plan.glucose_start, plan.glucose_end, ratio))
            measurements.append(
                MeasurementSnapshot(
                    measured_at=aware_datetime(target_date, hour=7),
                    measurement_type="fasting_glucose",
                    numeric_value=Decimal(str(glucose)),
                    unit="mg/dL",
                )
            )

    if plan.hba1c_start is not None and plan.hba1c_end is not None:
        for offset in range(0, TOTAL_DAYS, 45):
            target_date = start_date + timedelta(days=offset)
            ratio = offset / max(TOTAL_DAYS - 1, 1)
            hba1c = round(lerp(plan.hba1c_start, plan.hba1c_end, ratio), 1)
            measurements.append(
                MeasurementSnapshot(
                    measured_at=aware_datetime(target_date, hour=7, minute=20),
                    measurement_type="hba1c",
                    numeric_value=Decimal(str(hba1c)),
                    unit="%",
                )
            )

    return sorted(measurements, key=lambda item: item.measured_at)


def compute_streaks(statuses: list[str]) -> tuple[int, int]:
    current = 0
    best = 0
    rolling = 0
    for status in statuses:
        if status == CheckinStatus.ACHIEVED:
            rolling += 1
            best = max(best, rolling)
        else:
            rolling = 0
    for status in reversed(statuses):
        if status == CheckinStatus.ACHIEVED:
            current += 1
        else:
            break
    return current, best


async def ensure_challenge_templates() -> dict[str, ChallengeTemplate]:
    templates_by_code: dict[str, ChallengeTemplate] = {}
    for payload in CHALLENGE_TEMPLATES:
        template, _created = await ChallengeTemplate.get_or_create(code=payload["code"], defaults=payload)
        templates_by_code[payload["code"]] = template
    return templates_by_code


async def recreate_seed_user(account: SeedAccountConfig) -> User:
    existing = await User.get_or_none(email=account.email)
    if existing:
        await existing.delete()

    now = datetime.now(tz=config.TIMEZONE)
    user = await User.create(
        email=account.email,
        email_verified=True,
        email_verified_at=now,
        hashed_password=hash_password(get_shared_password()),
        name=account.name,
        gender=account.gender,
        birthday=account.birthday,
        phone_number=account.phone_number,
        onboarding_completed=True,
        onboarding_completed_at=now,
        is_active=True,
    )

    await UserConsent.create(
        user=user,
        terms_of_service=True,
        privacy_policy=True,
        health_data_consent=True,
        disclaimer_consent=True,
        marketing_consent=False,
        consented_at=now,
    )

    await UserSettings.create(
        user=user,
        nickname=account.nickname,
        chat_notification=True,
        challenge_reminder=True,
        weekly_report=True,
        preferred_times=["morning", "evening"],
    )

    await UserEngagement.create(
        user=user,
        state="ACTIVE",
        seven_day_response_rate=Decimal(account.engagement_response_rate),
        consecutive_missed_days=0,
        state_since=now,
        total_responses=account.total_responses,
        today_bundle_count=1,
        last_bundle_key=account.nickname,
        last_response_at=now,
    )

    await HealthProfile.create(
        user=user,
        relation=account.relation,
        user_group=account.user_group,
        gender=account.gender,
        age_range=account.age_range,
        height_cm=account.height_cm,
        weight_kg=account.current_weight_kg,
        bmi=account.bmi,
        family_history=account.family_history,
        conditions=account.conditions,
        has_hypertension=account.has_hypertension,
        has_high_glucose_history=account.has_high_glucose_history,
        treatments=account.treatments,
        hba1c_range=account.hba1c_range,
        fasting_glucose_range=account.fasting_glucose_range,
        exercise_frequency=account.exercise_frequency,
        diet_habits=account.diet_habits,
        sleep_duration_bucket=account.sleep_duration_bucket,
        alcohol_frequency=account.alcohol_frequency,
        smoking_status=account.smoking_status,
        goals=account.goals,
        ai_consent=AiConsent.AGREED,
        initial_findrisc_score=account.initial_findrisc_score,
        initial_risk_level=account.initial_risk_level,
    )

    return user


async def seed_daily_logs(user: User, account: SeedAccountConfig) -> list[dict]:
    start_date = date.today() - timedelta(days=TOTAL_DAYS - 1)
    created_logs: list[dict] = []
    for index in range(TOTAL_DAYS):
        log_date = start_date + timedelta(days=index)
        payload = build_daily_log_payload(log_date=log_date, index=index, scenario=account.scenario)
        await DailyHealthLog.create(user=user, **payload)
        created_logs.append(payload)
    return created_logs


async def seed_measurements(user: User, account: SeedAccountConfig, start_date: date) -> list[MeasurementSnapshot]:
    measurements = build_measurements(start_date=start_date, plan=account.measurement_plan)
    for item in measurements:
        await PeriodicMeasurement.create(
            user=user,
            measurement_type=item.measurement_type,
            measured_at=item.measured_at,
            numeric_value=item.numeric_value,
            numeric_value_2=item.numeric_value_2,
            unit=item.unit,
            source=MeasurementSource.MANUAL,
        )
    return measurements


def latest_waist_before(measurements: list[MeasurementSnapshot], target_date: date) -> float | None:
    waist_values = [
        float(item.numeric_value)
        for item in measurements
        if item.measurement_type == "waist" and item.measured_at.date() <= target_date
    ]
    return waist_values[-1] if waist_values else None


async def seed_risk_history(user: User, account: SeedAccountConfig, measurements: list[MeasurementSnapshot]) -> None:
    service = RiskAnalysisService()
    today = date.today()
    is_male = account.gender == Gender.MALE
    age = AGE_NUMERIC[account.age_range]

    for week_index in range(HISTORY_WEEKS - 1, 0, -1):
        period_end = today - timedelta(days=week_index * 7)
        period_start = period_end - timedelta(days=6)
        logs = list(
            await DailyHealthLog.filter(
                user_id=user.id,
                log_date__gte=period_start,
                log_date__lte=period_end,
            ).order_by("log_date")
        )
        if not logs:
            continue

        sleep_score = service._calc_sleep_score(logs)
        diet_score = service._calc_diet_score(logs)
        exercise_score = service._calc_exercise_score(logs)
        lifestyle_score = service._calc_lifestyle_score(sleep_score, diet_score, exercise_score, logs)
        positive, risk_factors = service._identify_factors(logs, sleep_score, diet_score, exercise_score)

        waist_cm = latest_waist_before(measurements, period_end)
        exercise_days = sum(1 for log in logs if log.exercise_done)
        veg_days = sum(1 for log in logs if log.vegetable_intake_level == VegetableIntakeLevel.ENOUGH)

        findrisc = calculate_findrisc(
            age=age,
            bmi=account.bmi,
            waist_cm=waist_cm,
            is_male=is_male,
            is_physically_active=exercise_days >= 4,
            eats_vegetables_daily=veg_days >= 5,
            has_hypertension=account.has_hypertension,
            has_high_glucose_history=account.has_high_glucose_history,
            family_history=account.family_history,
        )

        await RiskAssessment.create(
            user=user,
            period_type=PeriodType.WEEKLY,
            period_start=period_start,
            period_end=period_end,
            findrisc_score=findrisc.total_score,
            risk_level=findrisc.risk_level,
            sleep_score=sleep_score,
            diet_score=diet_score,
            exercise_score=exercise_score,
            lifestyle_score=lifestyle_score,
            score_age=findrisc.score_breakdown["age"],
            score_bmi=findrisc.score_breakdown["bmi"],
            score_waist=findrisc.score_breakdown["waist"],
            score_activity=findrisc.score_breakdown["activity"],
            score_vegetable=findrisc.score_breakdown["vegetable"],
            score_hypertension=findrisc.score_breakdown["hypertension"],
            score_glucose_history=findrisc.score_breakdown["glucose_history"],
            score_family=findrisc.score_breakdown["family"],
            top_positive_factors=positive,
            top_risk_factors=risk_factors,
            assessed_at=aware_datetime(period_end, hour=21),
        )

    await service.recalculate_risk(user.id)


async def seed_challenge_progress(
    user: User,
    templates: dict[str, ChallengeTemplate],
    logs: list[dict],
    account: SeedAccountConfig,
) -> None:
    today = date.today()

    active_walk = await UserChallenge.create(
        user=user,
        template=templates["daily_walk_30min"],
        selection_source=SelectionSource.USER_SELECTED,
        status=ChallengeStatus.ACTIVE,
        started_at=aware_datetime(today - timedelta(days=13), hour=8),
        target_days=14,
    )
    active_sleep = await UserChallenge.create(
        user=user,
        template=templates["sleep_7h"],
        selection_source=SelectionSource.SYSTEM_RECOMMENDED,
        status=ChallengeStatus.ACTIVE,
        started_at=aware_datetime(today - timedelta(days=13), hour=8, minute=10),
        target_days=14,
    )
    completed_water = await UserChallenge.create(
        user=user,
        template=templates["water_6cups"],
        selection_source=SelectionSource.USER_SELECTED,
        status=ChallengeStatus.COMPLETED,
        started_at=aware_datetime(today - timedelta(days=28), hour=8, minute=20),
        completed_at=aware_datetime(today - timedelta(days=15), hour=20),
        target_days=14,
        progress_pct=Decimal("1.000"),
        days_completed=14,
        today_checked=False,
    )

    historical_completed_specs = (
        [
            ("water_6cups", 10, 42),
            ("daily_walk_30min", 3, 21),
        ]
        if account.scenario == "risk_diabetic"
        else [
            ("sleep_7h", 11, 35),
            ("daily_walk_30min", 6, 21),
        ]
    )

    walk_statuses: list[str] = []
    sleep_statuses: list[str] = []

    for offset in range(14):
        log = logs[TOTAL_DAYS - 14 + offset]
        checkin_date = today - timedelta(days=13 - offset)

        walk_status = CheckinStatus.ACHIEVED if log["walk_done"] else CheckinStatus.MISSED
        sleep_status = (
            CheckinStatus.ACHIEVED
            if log["sleep_duration_bucket"] in {SleepDurationBucket.BETWEEN_7_8, SleepDurationBucket.OVER_8}
            else CheckinStatus.MISSED
        )
        walk_statuses.append(walk_status)
        sleep_statuses.append(sleep_status)

        await ChallengeCheckin.create(
            user_challenge=active_walk,
            checkin_date=checkin_date,
            status=walk_status,
            source_field_keys=["walk_done"],
            source_period="daily",
        )
        await ChallengeCheckin.create(
            user_challenge=active_sleep,
            checkin_date=checkin_date,
            status=sleep_status,
            source_field_keys=["sleep_duration_bucket"],
            source_period="daily",
        )

    completed_statuses = [CheckinStatus.ACHIEVED] * 14
    for offset in range(14):
        checkin_date = today - timedelta(days=28 - offset)
        await ChallengeCheckin.create(
            user_challenge=completed_water,
            checkin_date=checkin_date,
            status=CheckinStatus.ACHIEVED,
            source_field_keys=["water_cups"],
            source_period="daily",
        )

    walk_current, walk_best = compute_streaks(walk_statuses)
    sleep_current, sleep_best = compute_streaks(sleep_statuses)
    completed_current, completed_best = compute_streaks(completed_statuses)
    walk_achieved = sum(1 for status in walk_statuses if status == CheckinStatus.ACHIEVED)
    sleep_achieved = sum(1 for status in sleep_statuses if status == CheckinStatus.ACHIEVED)

    active_walk.current_streak = walk_current
    active_walk.best_streak = walk_best
    active_walk.days_completed = walk_achieved
    active_walk.progress_pct = Decimal(f"{walk_achieved / 14:.3f}")
    active_walk.today_checked = True
    await active_walk.save()

    active_sleep.current_streak = sleep_current
    active_sleep.best_streak = sleep_best
    active_sleep.days_completed = sleep_achieved
    active_sleep.progress_pct = Decimal(f"{sleep_achieved / 14:.3f}")
    active_sleep.today_checked = True
    await active_sleep.save()

    completed_water.current_streak = completed_current
    completed_water.best_streak = completed_best
    completed_water.progress_pct = Decimal("1.000")
    await completed_water.save()

    for template_code, completion_count, gap_days in historical_completed_specs:
        template = templates[template_code]
        for sequence in range(completion_count):
            days_offset = gap_days + (sequence * 16)
            completed_at = aware_datetime(today - timedelta(days=days_offset), hour=20, minute=15)
            started_at = completed_at - timedelta(days=13)
            historical = await UserChallenge.create(
                user=user,
                template=template,
                selection_source=SelectionSource.USER_SELECTED,
                status=ChallengeStatus.COMPLETED,
                started_at=started_at,
                completed_at=completed_at,
                target_days=14,
                progress_pct=Decimal("1.000"),
                days_completed=14,
                today_checked=False,
                current_streak=14,
                best_streak=14,
            )
            for day_offset in range(14):
                await ChallengeCheckin.create(
                    user_challenge=historical,
                    checkin_date=(started_at.date() + timedelta(days=day_offset)),
                    status=CheckinStatus.ACHIEVED,
                    source_field_keys=["seed_history"],
                    source_period="daily",
                )


async def delete_legacy_accounts() -> None:
    for email in LEGACY_SHARED_EMAILS:
        existing = await User.get_or_none(email=email)
        if existing:
            await existing.delete()


async def seed_account(account: SeedAccountConfig, templates: dict[str, ChallengeTemplate]) -> None:
    user = await recreate_seed_user(account)
    logs = await seed_daily_logs(user, account)
    start_date = date.today() - timedelta(days=TOTAL_DAYS - 1)
    measurements = await seed_measurements(user, account, start_date)
    await seed_risk_history(user, account, measurements)
    await seed_challenge_progress(user, templates, logs, account)


async def seed() -> None:
    await Tortoise.init(config=TORTOISE_ORM)
    await delete_legacy_accounts()
    templates = await ensure_challenge_templates()
    for account in SEED_ACCOUNTS:
        await seed_account(account, templates)

    print()
    print("=" * 64)
    print("Shared comparison accounts seeded")
    print("=" * 64)
    for account in SEED_ACCOUNTS:
        print(f"email    : {account.email}")
        print(f"password : {get_shared_password()}")
        print(f"scenario : {account.scenario}")
        print("-" * 64)
    print(f"records  : {TOTAL_DAYS} daily logs per account")
    print(f"history  : {HISTORY_WEEKS} weekly risk points per account")
    print("path note: challenge templates ensured in local DB")
    print("=" * 64)
    print()
    await Tortoise.close_connections()


if __name__ == "__main__":
    asyncio.run(seed())
