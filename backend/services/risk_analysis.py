"""위험도 분석 서비스 — FINDRISC 재계산, 생활습관 점수, 요인 분석.

생활습관 점수 (0-100):
  수면 점수: sleep_quality 평균 + sleep_duration 보정
  식단 점수: 채소·균형·단음료·야식 합산 정규화
  운동 점수: 운동빈도 + 시간 + 걷기
  종합 점수: 수면25% + 식단30% + 운동30% + 음주15%
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from backend.core import config
from backend.core.logger import setup_logger
from backend.dtos.analysis import (
    AnalysisSummaryResponse,
    CategoryComparisonItem,
    ImpactAnalysisItem,
    RiskBrief,
    ScorecardResponse,
)
from backend.dtos.dashboard import RiskDetailResponse
from backend.dtos.risk import RiskHistoryPoint, RiskHistoryResponse
from backend.models.assessments import RiskAssessment
from backend.models.enums import PeriodType
from backend.models.health import DailyHealthLog, HealthProfile, PeriodicMeasurement
from backend.services.prediction import calculate_findrisc
from backend.services.report_coaching import ReportCoachingService

logger = setup_logger(__name__)

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

SLEEP_HOURS = {
    "under_5": 4.5,
    "between_5_6": 5.5,
    "between_6_7": 6.5,
    "between_7_8": 7.5,
    "over_8": 8.5,
}

ANALYSIS_LABELS = {
    "sleep": "수면",
    "exercise": "운동",
    "diet": "식습관",
    "hydration": "수분",
}


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

    async def recalculate_risk(self, user_id: int) -> RiskDetailResponse | None:
        """위험도 수동 재계산."""
        profile = await HealthProfile.get_or_none(user_id=user_id)
        if not profile:
            return None

        today = date.today()
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
        assessment = await RiskAssessment.get_or_none(
            user_id=user_id,
            period_type=PeriodType.WEEKLY,
            period_start=period_start,
            period_end=today,
        )
        if assessment:
            await RiskAssessment.filter(id=assessment.id).update(**payload)
            assessment = await RiskAssessment.get(id=assessment.id)
        else:
            assessment = await RiskAssessment.create(
                user_id=user_id,
                period_type=PeriodType.WEEKLY,
                period_start=period_start,
                period_end=today,
                **payload,
            )
        result = self._assessment_to_detail(assessment)
        result.ai_coaching_lines = detail.ai_coaching_lines
        return result

    async def get_risk_history(self, user_id: int, weeks: int = 12) -> RiskHistoryResponse:
        """최근 주간 위험도 이력 조회."""
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
        return RiskHistoryResponse(history=history)

    async def get_analysis_summary(
        self, user_id: int, period: int = 7
    ) -> AnalysisSummaryResponse | None:
        """기간별 분석 요약."""
        today = date.today()
        current_start = today - timedelta(days=period - 1)
        previous_end = current_start - timedelta(days=1)
        previous_start = previous_end - timedelta(days=period - 1)

        logs = await DailyHealthLog.filter(
            user_id=user_id,
            log_date__gte=previous_start,
            log_date__lte=today,
        ).order_by("log_date")

        current_logs = [log for log in logs if current_start <= log.log_date <= today]
        previous_logs = [log for log in logs if previous_start <= log.log_date <= previous_end]

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
            current_logs, sleep_score, diet_score, exercise_score,
        )

        comparisons = self._build_category_comparisons(
            current_logs=current_logs,
            previous_logs=previous_logs,
        )
        impact_analysis = self._build_impact_analysis(
            comparisons=comparisons,
            period=period,
        )
        summary_message = self._build_summary_message(
            impact_analysis=impact_analysis,
            comparisons=comparisons,
        )

        return AnalysisSummaryResponse(
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
                predicted_score_pct=assessment.predicted_score_pct if assessment else None,
                predicted_risk_level=assessment.predicted_risk_level if assessment else None,
                predicted_stage_label=assessment.predicted_stage_label if assessment else None,
                model_enabled=assessment.predicted_score_pct is not None if assessment else False,
            ),
            summary_message=summary_message,
            impact_analysis=impact_analysis,
            comparisons=comparisons,
            top_positive_factors=positive,
            top_risk_factors=risk_factors,
            cached_at=datetime.now(tz=config.TIMEZONE),
        )

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
            day_score = 0
            has_data = False

            if log.vegetable_intake_level:
                day_score += VEGETABLE_SCORE.get(log.vegetable_intake_level, 0)
                has_data = True
            if log.meal_balance_level:
                day_score += BALANCE_SCORE.get(log.meal_balance_level, 0)
                has_data = True
            if log.sweetdrink_level:
                day_score += SWEETDRINK_SCORE.get(log.sweetdrink_level, 0)
                has_data = True
            if log.nightsnack_level:
                day_score += NIGHTSNACK_SCORE.get(log.nightsnack_level, 0)
                has_data = True

            if has_data:
                total += day_score
                count += 1

        if count == 0:
            return 0

        # 만점 = 30+30+20+20 = 100
        return max(0, min(100, round(total / count)))

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
    def _average(values: list[float | int | None]) -> float | None:
        valid = [float(value) for value in values if value is not None]
        if not valid:
            return None
        return round(sum(valid) / len(valid), 1)

    @staticmethod
    def _safe_delta_pct(current: float | int | None, previous: float | int | None) -> int | None:
        if current is None or previous in (None, 0):
            return None
        return round(((float(current) - float(previous)) / float(previous)) * 100)

    @staticmethod
    def _sleep_hours(log: DailyHealthLog) -> float | None:
        return SLEEP_HOURS.get(log.sleep_duration_bucket)

    @staticmethod
    def _daily_diet_score(log: DailyHealthLog) -> float | None:
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

    @classmethod
    def _build_category_comparisons(
        cls,
        *,
        current_logs: list[DailyHealthLog],
        previous_logs: list[DailyHealthLog],
    ) -> list[CategoryComparisonItem]:
        current_sleep = cls._average([cls._sleep_hours(log) for log in current_logs])
        previous_sleep = cls._average([cls._sleep_hours(log) for log in previous_logs])

        current_exercise = sum(
            1 for log in current_logs
            if log.exercise_done or (log.exercise_minutes or 0) > 0
        )
        previous_exercise = sum(
            1 for log in previous_logs
            if log.exercise_done or (log.exercise_minutes or 0) > 0
        )

        current_diet = cls._average([cls._daily_diet_score(log) for log in current_logs])
        previous_diet = cls._average([cls._daily_diet_score(log) for log in previous_logs])

        current_water_cups = cls._average([log.water_cups for log in current_logs])
        previous_water_cups = cls._average([log.water_cups for log in previous_logs])
        current_water_liters = round(current_water_cups * 0.2, 1) if current_water_cups is not None else None
        previous_water_liters = round(previous_water_cups * 0.2, 1) if previous_water_cups is not None else None

        return [
            CategoryComparisonItem(
                key="sleep",
                label=ANALYSIS_LABELS["sleep"],
                current_value=current_sleep,
                previous_value=previous_sleep,
                current_display=f"{current_sleep:.1f}h" if current_sleep is not None else "-",
                previous_display=f"{previous_sleep:.1f}h" if previous_sleep is not None else "-",
                delta_pct=cls._safe_delta_pct(current_sleep, previous_sleep),
                score=round(min(100, (current_sleep / 7) * 100)) if current_sleep is not None else 0,
            ),
            CategoryComparisonItem(
                key="exercise",
                label=ANALYSIS_LABELS["exercise"],
                current_value=float(current_exercise),
                previous_value=float(previous_exercise),
                current_display=f"{current_exercise}회",
                previous_display=f"{previous_exercise}회",
                delta_pct=cls._safe_delta_pct(current_exercise, previous_exercise),
                score=min(100, round((current_exercise / max(1, len(current_logs))) * 100)),
            ),
            CategoryComparisonItem(
                key="diet",
                label=ANALYSIS_LABELS["diet"],
                current_value=current_diet,
                previous_value=previous_diet,
                current_display=f"{round(current_diet)}점" if current_diet is not None else "-",
                previous_display=f"{round(previous_diet)}점" if previous_diet is not None else "-",
                delta_pct=cls._safe_delta_pct(current_diet, previous_diet),
                score=round(current_diet) if current_diet is not None else 0,
            ),
            CategoryComparisonItem(
                key="hydration",
                label=ANALYSIS_LABELS["hydration"],
                current_value=current_water_liters,
                previous_value=previous_water_liters,
                current_display=f"{current_water_liters:.1f}L" if current_water_liters is not None else "-",
                previous_display=f"{previous_water_liters:.1f}L" if previous_water_liters is not None else "-",
                delta_pct=cls._safe_delta_pct(current_water_liters, previous_water_liters),
                score=min(100, round((current_water_cups / 6) * 100)) if current_water_cups is not None else 0,
            ),
        ]

    @staticmethod
    def _build_impact_analysis(
        *,
        comparisons: list[CategoryComparisonItem],
        period: int,
    ) -> list[ImpactAnalysisItem]:
        comparison_map = {item.key: item for item in comparisons}
        targets = {
            "sleep": 7.0,
            "exercise": float(max(1, round((period / 7) * 3))),
            "diet": 70.0,
        }
        labels = {
            "sleep": ANALYSIS_LABELS["sleep"],
            "exercise": ANALYSIS_LABELS["exercise"],
            "diet": ANALYSIS_LABELS["diet"],
        }
        current_values = {
            key: float(comparison_map[key].current_value or 0)
            for key in targets
            if key in comparison_map
        }
        deficiencies = {
            key: max(0.0, (targets[key] - current_values.get(key, 0.0)) / targets[key])
            for key in targets
        }
        total_deficiency = sum(deficiencies.values())

        ordered_keys = sorted(deficiencies, key=lambda key: deficiencies[key], reverse=True)
        items: list[ImpactAnalysisItem] = []
        allocated = 0.0
        for index, key in enumerate(ordered_keys):
            if total_deficiency <= 0:
                contribution = 0
            elif index == len(ordered_keys) - 1:
                contribution = int(round(100 - allocated))
            else:
                contribution = int(round((deficiencies[key] / total_deficiency) * 100))
                allocated += contribution
            items.append(
                ImpactAnalysisItem(
                    key=key,
                    label=labels[key],
                    contribution_pct=contribution,
                    current_score=int(round(current_values.get(key, 0.0))),
                    target_score=int(round(targets[key])),
                )
            )
        return items

    @staticmethod
    def _build_summary_message(
        *,
        impact_analysis: list[ImpactAnalysisItem],
        comparisons: list[CategoryComparisonItem],
    ) -> str:
        if not impact_analysis:
            return "최근 기록이 아직 충분하지 않아 영향 분석을 만들지 못했어요."

        top_item = impact_analysis[0]
        if top_item.contribution_pct <= 0:
            return "현재 안정적인 상태를 유지하고 있습니다."

        comparison_map = {item.key: item for item in comparisons}
        comparison = comparison_map.get(top_item.key)

        if comparison and comparison.delta_pct is not None:
            if comparison.delta_pct < 0:
                return f"{top_item.label} 감소가 최근 위험도에 가장 큰 영향을 미쳤어요."
            if comparison.delta_pct > 0:
                return f"{top_item.label} 변화가 현재 위험도 흐름에서 가장 큰 비중을 차지해요."

        return f"{top_item.label} 관리가 현재 위험도에서 가장 우선순위가 높은 항목이에요."

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
