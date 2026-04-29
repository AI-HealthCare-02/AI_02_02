"""위험도 분석 서비스 — FINDRISC 재계산, 생활습관 점수, 요인 분석.

생활습관 점수 (0-100):
  수면 점수: sleep_quality 평균 + sleep_duration 보정
  식단 점수: 채소·균형·단음료·야식 합산 정규화
  운동 점수: 운동빈도 + 시간 + 걷기
  종합 점수: 수면25% + 식단30% + 운동30% + 음주15%
"""

from __future__ import annotations

import asyncio
from datetime import date, datetime, timedelta

from backend.core import config
from backend.core.cache import delete_cached, get_cached, set_cached
from backend.core.logger import setup_logger
from backend.dtos.analysis import AnalysisSummaryResponse, RiskBrief, ScorecardResponse
from backend.dtos.dashboard import RiskDetailResponse
from backend.dtos.risk import RiskHistoryPoint, RiskHistoryResponse
from backend.models.assessments import RiskAssessment
from backend.models.enums import PeriodType
from backend.models.health import DailyHealthLog, HealthProfile, PeriodicMeasurement
from backend.services.prediction import calculate_findrisc
from backend.services.report_coaching import ReportCoachingService

logger = setup_logger(__name__)


# ── 리포트 캐시 키·TTL ──
# 네임스페이스 `report:*` — 대시보드용 `dash:*`와 분리.
CACHE_TTL_RISK_SECONDS = 3600            # 상세 위험도 1시간
CACHE_TTL_HISTORY_SECONDS = 1800         # 이력 30분
CACHE_TTL_SUMMARY_SECONDS = 600          # 분석 요약 10분


def risk_current_cache_key(user_id: int) -> str:
    return f"report:risk:{user_id}"


def risk_history_cache_key(user_id: int, weeks: int) -> str:
    return f"report:history:{user_id}:{weeks}"


def risk_summary_cache_key(user_id: int, period: int) -> str:
    return f"report:summary:{user_id}:{period}"


async def invalidate_report_caches(user_id: int, *, include_coaching: bool = False) -> None:
    """건강 기록·측정·프로필 변경 시 호출되는 리포트 캐시 일괄 무효화.

    - 기본: 위험도/이력/분석요약만 무효화 (일상 체크인 시점)
    - include_coaching=True: 프로필 변경 등 AI 코칭 입력이 달라질 때 코칭도 함께 제거

    대시보드 요약(`dash:risk:*`)은 소유가 `dashboard.py`라 건드리지 않는다.
    필요한 경우 각 저장 경로에서 명시적으로 별도 무효화한다.
    """
    keys = [
        risk_current_cache_key(user_id),
        risk_history_cache_key(user_id, 7),
        risk_history_cache_key(user_id, 12),
        risk_summary_cache_key(user_id, 7),
        risk_summary_cache_key(user_id, 30),
    ]
    if include_coaching:
        keys.append(f"report:coaching:{user_id}")
    for key in keys:
        try:
            await delete_cached(key)
        except Exception:
            # Redis 장애 시에도 저장 자체는 성공해야 함
            logger.exception("report_cache_invalidate_failed", key=key)

# ── 점수 매핑 상수 ──

SLEEP_QUALITY_SCORE = {
    "very_good": 100, "good": 80, "normal": 60, "bad": 30, "very_bad": 10,
}

SLEEP_DURATION_BONUS = {
    "between_7_8": 10, "over_8": 5, "between_6_7": 0,
    "between_5_6": -10, "under_5": -20,
}

VEGETABLE_SCORE = {"enough": 30, "little": 15, "none": 0}
BALANCE_SCORE = {"balanced": 30, "protein_veg_heavy": 20, "carb_heavy": 10}
SWEETDRINK_SCORE = {"none": 20, "one": 10, "two_plus": 0}
NIGHTSNACK_SCORE = {"none": 20, "light": 10, "heavy": 0}
MEAL_REGULARITY_SCORE = {"hearty": 100, "simple": 100, "skipped": 0}


def _detail_factors(
    logs: list[DailyHealthLog],
) -> tuple[list[str], list[str]]:
    """세부 긍정·위험 요인 식별 (데이터 기반)."""
    positive: list[str] = []
    risk: list[str] = []
    n = len(logs)

    walk_rate = sum(1 for log in logs if log.walk_done) / n
    if walk_rate >= 0.7:
        positive.append("regular_walk")

    veg_rate = sum(
        1 for log in logs if log.vegetable_intake_level == "enough"
    ) / n
    if veg_rate >= 0.7:
        positive.append("good_vegetable_intake")
    elif veg_rate < 0.3:
        risk.append("low_vegetable_intake")

    carb_rate = sum(
        1 for log in logs if log.meal_balance_level == "carb_heavy"
    ) / n
    if carb_rate >= 0.5:
        risk.append("carb_heavy_meals")

    drink_rate = sum(1 for log in logs if log.alcohol_today) / n
    if drink_rate >= 0.5:
        risk.append("frequent_alcohol")

    return positive, risk


class RiskAnalysisService:
    """위험도 분석."""

    def __init__(self) -> None:
        self.model_inference = None
        self.report_coaching = ReportCoachingService()
        try:
            from backend.services.model_inference import ModelInferenceService

            self.model_inference = ModelInferenceService()
        except Exception:
            logger.warning("model_inference_disabled")

    async def get_latest_risk(self, user_id: int) -> RiskDetailResponse | None:
        """최신 위험도 조회."""
        assessment = await RiskAssessment.filter(
            user_id=user_id,
        ).order_by("-assessed_at").first()

        if not assessment:
            return None

        detail = self._assessment_to_detail(assessment)
        detail = await self._attach_model_prediction(user_id=user_id, detail=detail)
        return await self._attach_ai_coaching(user_id=user_id, detail=detail)

    async def get_current_risk(
        self, user_id: int, *, stale_after_hours: int = 24
    ) -> RiskDetailResponse | None:
        """리포트 페이지용 "빠른" 위험도 조회.

        1. Redis 캐시 HIT → 즉시 반환 (수십 ms)
        2. MISS → 최신 ``RiskAssessment``를 조회 → 캐시 SET 후 반환
        3. assessment가 ``stale_after_hours`` 이상 오래됐으면 백그라운드 재계산을 fire-and-forget
           (응답은 이미 나간 뒤에 DB upsert)

        AI 코칭은 포함하지 않는다 — 별도 `/risk/coaching` 엔드포인트가 소유한다.
        """
        cache_key = risk_current_cache_key(user_id)
        cached = await get_cached(cache_key)
        if cached is not None:
            try:
                return RiskDetailResponse.model_validate(cached)
            except Exception:
                logger.exception("risk_current_cache_invalid", user_id=user_id)
                await delete_cached(cache_key)

        assessment = await RiskAssessment.filter(
            user_id=user_id,
        ).order_by("-assessed_at").first()

        if assessment is None:
            # 최초 진입 — 동기 재계산 1회 수행 (코칭 제외로 빠름)
            detail = await self.recalculate_risk(user_id=user_id, generate_coaching=False)
            if detail is None:
                return None
            await set_cached(
                cache_key, detail.model_dump(mode="json"), ttl_seconds=CACHE_TTL_RISK_SECONDS,
            )
            return detail

        detail = self._assessment_to_detail(assessment)
        detail = await self._attach_model_prediction(user_id=user_id, detail=detail)

        await set_cached(
            cache_key, detail.model_dump(mode="json"), ttl_seconds=CACHE_TTL_RISK_SECONDS,
        )

        # stale이면 백그라운드 재계산 (응답은 즉시 반환, DB는 곧 갱신)
        now = datetime.now(tz=config.TIMEZONE)
        stale_threshold = now - timedelta(hours=stale_after_hours)
        if assessment.assessed_at < stale_threshold:
            asyncio.create_task(self._background_recalculate(user_id))

        return detail

    async def _background_recalculate(self, user_id: int) -> None:
        """fire-and-forget 재계산. 예외 삼키고 로깅만 한다 (응답은 이미 나감)."""
        try:
            await self.recalculate_risk(user_id=user_id, generate_coaching=False)
            # 재계산 결과로 캐시 프리워밍
            latest = await RiskAssessment.filter(
                user_id=user_id,
            ).order_by("-assessed_at").first()
            if latest:
                detail = self._assessment_to_detail(latest)
                detail = await self._attach_model_prediction(user_id=user_id, detail=detail)
                await set_cached(
                    risk_current_cache_key(user_id),
                    detail.model_dump(mode="json"),
                    ttl_seconds=CACHE_TTL_RISK_SECONDS,
                )
        except Exception:
            logger.exception("background_recalculate_failed", user_id=user_id)

    async def recalculate_risk(
        self,
        user_id: int,
        for_date: date | None = None,
        *,
        generate_coaching: bool = True,
    ) -> RiskDetailResponse | None:
        """위험도 수동 재계산. ``for_date``를 주면 해당 날짜 기준 7일 창으로 재계산 (백필용).

        ``generate_coaching=False``로 호출하면 OpenAI 동기 호출을 생략해 ~5초 단축.
        daily_cron/weekly_cron/백그라운드 경로에서 False로 호출한다.
        """
        profile = await HealthProfile.get_or_none(user_id=user_id)
        if not profile:
            return None

        today = for_date or date.today()
        period_start = today - timedelta(days=7)

        # 최근 7일 건강 기록
        logs = await DailyHealthLog.filter(
            user_id=user_id,
            log_date__gte=period_start,
            log_date__lte=today,
        ).order_by("log_date")

        # 최신 허리둘레 측정
        waist_m = await PeriodicMeasurement.filter(
            user_id=user_id, measurement_type="waist",
        ).order_by("-measured_at").first()
        waist_cm = waist_m.numeric_value if waist_m else None

        # 운동 활동 여부 (최근 7일 중 4일 이상 운동 → 활동적)
        exercise_days = sum(1 for log in logs if log.exercise_done)
        is_active = exercise_days >= 4 if logs else None

        # 채소 매일 섭취 여부
        veg_days = sum(
            1 for log in logs if log.vegetable_intake_level == "enough"
        )
        eats_veg = veg_days >= 5 if logs else None

        is_male = profile.gender == "MALE"

        from backend.services.onboarding import AGE_RANGE_TO_NUMERIC
        age = AGE_RANGE_TO_NUMERIC.get(profile.age_range, 50)

        # FINDRISC 계산
        findrisc = calculate_findrisc(
            age=age,
            bmi=profile.bmi,
            waist_cm=waist_cm,
            is_male=is_male,
            is_physically_active=is_active,
            eats_vegetables_daily=eats_veg,
            has_hypertension=profile.has_hypertension,
            has_high_glucose_history=profile.has_high_glucose_history,
            family_history=profile.family_history,
        )

        # 생활습관 점수
        sleep_score = self._calc_sleep_score(logs)
        diet_score = self._calc_diet_score(logs)
        exercise_score = self._calc_exercise_score(logs)
        lifestyle_score = self._calc_lifestyle_score(
            sleep_score, diet_score, exercise_score, logs,
        )

        # 요인 분석
        positive, risk_factors = self._identify_factors(
            logs, sleep_score, diet_score, exercise_score,
        )

        now = datetime.now(tz=config.TIMEZONE)

        detail_payload = {
            "findrisc_score": findrisc.total_score,
            "risk_level": findrisc.risk_level,
            "sleep_score": sleep_score,
            "diet_score": diet_score,
            "exercise_score": exercise_score,
            "lifestyle_score": lifestyle_score,
            "assessed_at": now,
            "score_breakdown": {
                "age": findrisc.score_breakdown["age"],
                "bmi": findrisc.score_breakdown["bmi"],
                "waist": findrisc.score_breakdown["waist"],
                "activity": findrisc.score_breakdown["activity"],
                "vegetable": findrisc.score_breakdown["vegetable"],
                "hypertension": findrisc.score_breakdown["hypertension"],
                "glucose_history": findrisc.score_breakdown["glucose_history"],
                "family": findrisc.score_breakdown["family"],
            },
            "top_positive_factors": positive,
            "top_risk_factors": risk_factors,
        }
        detail = RiskDetailResponse(**detail_payload)
        detail = await self._attach_model_prediction(user_id=user_id, detail=detail)
        if generate_coaching:
            detail = await self._attach_ai_coaching(
                user_id=user_id,
                detail=detail,
                profile=profile,
                logs=list(logs),
            )

        payload = {
            "findrisc_score": findrisc.total_score,
            "risk_level": findrisc.risk_level,
            "predicted_score_pct": detail.predicted_score_pct,
            "predicted_risk_level": detail.predicted_risk_level,
            "predicted_risk_label": detail.predicted_risk_label,
            "predicted_stage_label": detail.predicted_stage_label,
            "model_track": detail.model_track,
            "sleep_score": sleep_score,
            "diet_score": diet_score,
            "exercise_score": exercise_score,
            "lifestyle_score": lifestyle_score,
            "score_age": findrisc.score_breakdown["age"],
            "score_bmi": findrisc.score_breakdown["bmi"],
            "score_waist": findrisc.score_breakdown["waist"],
            "score_activity": findrisc.score_breakdown["activity"],
            "score_vegetable": findrisc.score_breakdown["vegetable"],
            "score_hypertension": findrisc.score_breakdown["hypertension"],
            "score_glucose_history": findrisc.score_breakdown["glucose_history"],
            "score_family": findrisc.score_breakdown["family"],
            "top_positive_factors": positive,
            "top_risk_factors": risk_factors,
            "assessed_at": now,
        }
        # 유니크 제약 (user_id, period_type, period_start, period_end) 기반 upsert.
        # 동시 요청 2건이 있어도 DB가 중복 생성을 차단하므로 IntegrityError 발생 시 재조회.
        assessment, _ = await RiskAssessment.update_or_create(
            defaults=payload,
            user_id=user_id,
            period_type=PeriodType.WEEKLY,
            period_start=period_start,
            period_end=today,
        )
        result = self._assessment_to_detail(assessment)
        result.ai_coaching_lines = detail.ai_coaching_lines
        return result

    async def get_risk_history(self, user_id: int, weeks: int = 12) -> RiskHistoryResponse:
        """최근 주간 위험도 이력 조회. Redis 캐시 30분."""
        cache_key = risk_history_cache_key(user_id, weeks)
        cached = await get_cached(cache_key)
        if cached is not None:
            try:
                return RiskHistoryResponse.model_validate(cached)
            except Exception:
                logger.exception("risk_history_cache_invalid", user_id=user_id, weeks=weeks)
                await delete_cached(cache_key)

        assessments = await RiskAssessment.filter(
            user_id=user_id,
            period_type=PeriodType.WEEKLY,
        ).order_by("-period_end").limit(weeks)

        history = [
            RiskHistoryPoint(
                period_start=item.period_start,
                period_end=item.period_end,
                findrisc_score=item.findrisc_score,
                risk_level=item.risk_level,
                predicted_score_pct=item.predicted_score_pct,
                predicted_risk_level=item.predicted_risk_level,
                predicted_risk_label=item.predicted_risk_label,
                predicted_stage_label=item.predicted_stage_label,
                model_enabled=item.predicted_score_pct is not None,
                model_status="ready" if item.predicted_score_pct is not None else "artifacts_missing",
                model_track=item.model_track,
                assessed_at=item.assessed_at,
            )
            for item in reversed(assessments)
        ]
        response = RiskHistoryResponse(history=history)
        await set_cached(
            cache_key, response.model_dump(mode="json"), ttl_seconds=CACHE_TTL_HISTORY_SECONDS,
        )
        return response

    async def get_analysis_summary(
        self, user_id: int, period: int = 7
    ) -> AnalysisSummaryResponse | None:
        """기간별 분석 요약. Redis 캐시 10분."""
        cache_key = risk_summary_cache_key(user_id, period)
        cached = await get_cached(cache_key)
        if cached is not None:
            try:
                return AnalysisSummaryResponse.model_validate(cached)
            except Exception:
                logger.exception("analysis_summary_cache_invalid", user_id=user_id, period=period)
                await delete_cached(cache_key)

        today = date.today()
        start = today - timedelta(days=period)

        logs = await DailyHealthLog.filter(
            user_id=user_id,
            log_date__gte=start,
            log_date__lte=today,
        ).order_by("log_date")

        # 최신 위험도
        assessment = await RiskAssessment.filter(
            user_id=user_id,
        ).order_by("-assessed_at").first()

        sleep_score = self._calc_sleep_score(logs)
        diet_score = self._calc_diet_score(logs)
        exercise_score = self._calc_exercise_score(logs)
        lifestyle_score = self._calc_lifestyle_score(
            sleep_score, diet_score, exercise_score, logs,
        )

        positive, risk_factors = self._identify_factors(
            logs, sleep_score, diet_score, exercise_score,
        )

        response = AnalysisSummaryResponse(
            period=period,
            scorecard=ScorecardResponse(
                sleep_score=sleep_score,
                diet_score=diet_score,
                exercise_score=exercise_score,
                lifestyle_score=lifestyle_score,
            ),
            risk=RiskBrief(
                findrisc_score=assessment.findrisc_score if assessment else 0,
                risk_level=assessment.risk_level if assessment else "unknown",
            ),
            top_positive_factors=positive,
            top_risk_factors=risk_factors,
            cached_at=datetime.now(tz=config.TIMEZONE),
        )
        await set_cached(
            cache_key, response.model_dump(mode="json"), ttl_seconds=CACHE_TTL_SUMMARY_SECONDS,
        )
        return response

    # ── 생활습관 점수 계산 ──

    @staticmethod
    def _calc_sleep_score(logs: list[DailyHealthLog]) -> int:
        """수면 점수 (0-100)."""
        if not logs:
            return 0

        quality_scores = [
            SLEEP_QUALITY_SCORE.get(log.sleep_quality, 0)
            for log in logs if log.sleep_quality
        ]
        if not quality_scores:
            return 0

        avg = sum(quality_scores) / len(quality_scores)

        # 수면 시간 보정
        duration_bonuses = [
            SLEEP_DURATION_BONUS.get(log.sleep_duration_bucket, 0)
            for log in logs if log.sleep_duration_bucket
        ]
        if duration_bonuses:
            avg += sum(duration_bonuses) / len(duration_bonuses)

        return max(0, min(100, round(avg)))

    @staticmethod
    def _calc_diet_score(logs: list[DailyHealthLog]) -> int:
        """식단 점수 (0-100)."""
        if not logs:
            return 0

        total = 0.0
        count = 0

        for log in logs:
            day_score, has_data = RiskAnalysisService._calc_diet_day_score(log)
            if has_data:
                total += day_score
                count += 1

        if count == 0:
            return 0

        # 만점 = 30+30+20+20 = 100
        return max(0, min(100, round(total / count)))

    @staticmethod
    def _calc_diet_day_score(log: DailyHealthLog) -> tuple[int, bool]:
        day_score = 0
        has_data = False

        score_parts = (
            (log.vegetable_intake_level, VEGETABLE_SCORE),
            (log.meal_balance_level, BALANCE_SCORE),
            (log.sweetdrink_level, SWEETDRINK_SCORE),
            (log.nightsnack_level, NIGHTSNACK_SCORE),
        )

        for value, score_map in score_parts:
            if not value:
                continue
            day_score += score_map.get(value, 0)
            has_data = True

        if has_data:
            return day_score, True

        meal_values = [log.breakfast_status, log.lunch_status, log.dinner_status]
        filled_meals = [value for value in meal_values if value]
        if not filled_meals:
            return 0, False

        return (
            round(sum(MEAL_REGULARITY_SCORE.get(value, 0) for value in filled_meals) / len(meal_values)),
            True,
        )

    @staticmethod
    def _calc_exercise_score(logs: list[DailyHealthLog]) -> int:
        """운동 점수 (0-100)."""
        if not logs:
            return 0

        days = len(logs)
        exercise_days = sum(1 for log in logs if log.exercise_done)
        walk_days = sum(1 for log in logs if log.walk_done)
        total_minutes = sum(log.exercise_minutes or 0 for log in logs)

        # 운동 빈도 (최대 50점)
        freq_score = min(50, round((exercise_days / max(days, 1)) * 50))

        # 운동 시간 vs WHO 150분/주 (최대 30점)
        weekly_minutes = total_minutes * (7 / max(days, 1))
        time_score = min(30, round((weekly_minutes / 150) * 30))

        # 걷기 빈도 (최대 20점)
        walk_score = min(20, round((walk_days / max(days, 1)) * 20))

        return min(100, freq_score + time_score + walk_score)

    @staticmethod
    def _calc_lifestyle_score(
        sleep: int, diet: int, exercise: int,
        logs: list[DailyHealthLog],
    ) -> int:
        """종합 생활습관 점수 (가중 평균)."""
        # 음주 점수 (15점 만점)
        if logs:
            drinking_days = sum(1 for log in logs if log.alcohol_today)
            alcohol_score = max(0, 15 - round(drinking_days / max(len(logs), 1) * 15))
        else:
            alcohol_score = 0

        # 가중 평균: 수면25% + 식단30% + 운동30% + 음주15%
        weighted = (
            sleep * 0.25
            + diet * 0.30
            + exercise * 0.30
            + (alcohol_score / 15) * 100 * 0.15
        )
        return max(0, min(100, round(weighted)))

    @staticmethod
    def _identify_factors(
        logs: list[DailyHealthLog],
        sleep_score: int,
        diet_score: int,
        exercise_score: int,
    ) -> tuple[list[str], list[str]]:
        """긍정·위험 요인 식별."""
        positive: list[str] = []
        risk: list[str] = []

        # 점수 기반 요인
        score_factors = [
            (sleep_score, "good_sleep", "poor_sleep"),
            (diet_score, "healthy_diet", "poor_diet"),
            (exercise_score, "regular_exercise", "low_activity"),
        ]
        for score, pos_label, neg_label in score_factors:
            if score >= 70:
                positive.append(pos_label)
            elif score < 40:
                risk.append(neg_label)

        # 세부 요인 (데이터 기반)
        if logs:
            pos_detail, risk_detail = _detail_factors(logs)
            positive.extend(pos_detail)
            risk.extend(risk_detail)

        return positive[:5], risk[:5]

    @staticmethod
    def _assessment_to_detail(a: RiskAssessment) -> RiskDetailResponse:
        """RiskAssessment → RiskDetailResponse."""
        return RiskDetailResponse(
            findrisc_score=a.findrisc_score,
            risk_level=a.risk_level,
            sleep_score=a.sleep_score,
            diet_score=a.diet_score,
            exercise_score=a.exercise_score,
            lifestyle_score=a.lifestyle_score,
            assessed_at=a.assessed_at,
            model_track=a.model_track,
            predicted_score_pct=a.predicted_score_pct,
            predicted_risk_level=a.predicted_risk_level,
            predicted_risk_label=a.predicted_risk_label,
            predicted_stage_label=a.predicted_stage_label,
            model_enabled=a.predicted_score_pct is not None,
            model_status="ready" if a.predicted_score_pct is not None else "artifacts_missing",
            model_status_message=None if a.predicted_score_pct is not None else "모델 산출물 파일이 설치되지 않아 AI 예측 리포트가 비활성화되었습니다.",
            score_breakdown={
                "age": a.score_age,
                "bmi": a.score_bmi,
                "waist": a.score_waist,
                "activity": a.score_activity,
                "vegetable": a.score_vegetable,
                "hypertension": a.score_hypertension,
                "glucose_history": a.score_glucose_history,
                "family": a.score_family,
            },
            top_positive_factors=a.top_positive_factors or [],
            top_risk_factors=a.top_risk_factors or [],
        )

    async def _attach_model_prediction(
        self,
        *,
        user_id: int,
        detail: RiskDetailResponse,
    ) -> RiskDetailResponse:
        if self.model_inference is None:
            return self._mark_model_unavailable(detail)

        profile = await HealthProfile.get_or_none(user_id=user_id)
        if not profile:
            return self._mark_model_unavailable(detail)

        today = date.today()
        period_start = today - timedelta(days=7)
        logs = await DailyHealthLog.filter(
            user_id=user_id,
            log_date__gte=period_start,
            log_date__lte=today,
        ).order_by("log_date")
        measurements = await PeriodicMeasurement.filter(
            user_id=user_id,
        ).order_by("-measured_at").limit(20)

        try:
            prediction = await self.model_inference.predict_for_profile(
                profile=profile,
                logs=list(logs),
                measurements=list(measurements),
            )
        except Exception as exc:
            if exc.__class__.__name__ == "ModelArtifactsUnavailableError":
                logger.warning("model_prediction_artifacts_missing", user_id=user_id)
                return self._mark_model_unavailable(detail)
            logger.exception("model_prediction_failed", user_id=user_id)
            return self._mark_model_unavailable(detail, status="prediction_failed", message="AI 예측 모델을 불러오지 못해 생활기반 리포트만 표시합니다.")
        payload = detail.model_dump()
        payload.update(prediction)
        return RiskDetailResponse(**payload)

    @staticmethod
    def _mark_model_unavailable(
        detail: RiskDetailResponse,
        *,
        status: str = "artifacts_missing",
        message: str = "모델 산출물 파일이 설치되지 않아 AI 예측 리포트가 비활성화되었습니다.",
    ) -> RiskDetailResponse:
        payload = detail.model_dump()
        payload.update(
            {
                "model_enabled": False,
                "model_status": status,
                "model_status_message": message,
                "predicted_score_pct": None,
                "predicted_risk_level": None,
                "predicted_risk_label": None,
                "predicted_stage_label": None,
                "model_track": None,
            }
        )
        return RiskDetailResponse(**payload)

    async def _attach_ai_coaching(
        self,
        *,
        user_id: int,
        detail: RiskDetailResponse,
        profile: HealthProfile | None = None,
        logs: list[DailyHealthLog] | None = None,
    ) -> RiskDetailResponse:
        if profile is None:
            profile = await HealthProfile.get_or_none(user_id=user_id)
        if profile is None:
            return detail

        if logs is None:
            today = date.today()
            period_start = today - timedelta(days=7)
            logs = list(
                await DailyHealthLog.filter(
                    user_id=user_id,
                    log_date__gte=period_start,
                    log_date__lte=today,
                ).order_by("log_date")
            )

        lines = await self.report_coaching.generate_lines(
            profile=profile,
            logs=logs,
            detail=detail,
        )
        if not lines:
            return detail

        payload = detail.model_dump()
        payload["ai_coaching_lines"] = lines
        return RiskDetailResponse(**payload)
