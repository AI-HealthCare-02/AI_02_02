"""FINDRISC 당뇨 위험도 점수 계산 서비스.

핀란드 당뇨 위험 점수표(Finnish Diabetes Risk Score) 기반.
8개 변수로 0-26점을 계산하고 5단계 위험도로 분류한다.

Null 처리 규칙 (보수적 원칙):
- activity: None → 2점 (운동 안 한 것으로 간주)
- vegetable: None → 1점 (채소 안 먹는 것으로 간주)
- hypertension: None → 0점 (복약 여부를 절대 가정하지 않음)
"""

from pydantic import BaseModel

from app.models.enums import RiskLevel


class FindriscResult(BaseModel):
    """FINDRISC 계산 결과."""

    total_score: int
    risk_level: RiskLevel
    score_breakdown: dict[str, int]


# ──────────────────────────────────────────────
# 8변수 개별 점수 계산
# ──────────────────────────────────────────────


def _score_age(age: int) -> int:
    """<45→0, 45-54→2, 55-64→3, 65+→4 (최대 4점)."""
    if age < 45:
        return 0
    if age <= 54:
        return 2
    if age <= 64:
        return 3
    return 4


def _score_bmi(bmi: float) -> int:
    """<25→0, 25-30→1, >30→3 (최대 3점)."""
    if bmi < 25:
        return 0
    if bmi <= 30:
        return 1
    return 3


def _score_waist(waist_cm: float | None, is_male: bool) -> int:
    """허리둘레 — 성별별 기준 (최대 4점). None→0."""
    if waist_cm is None:
        return 0
    if is_male:
        if waist_cm < 94:
            return 0
        if waist_cm <= 102:
            return 3
        return 4
    else:
        if waist_cm < 80:
            return 0
        if waist_cm <= 88:
            return 3
        return 4


def _score_activity(is_physically_active: bool | None) -> int:
    """매일 30분+ 운동 여부 (최대 2점). None→2 (보수적)."""
    if is_physically_active is None or not is_physically_active:
        return 2
    return 0


def _score_vegetable(eats_vegetables_daily: bool | None) -> int:
    """매일 채소/과일 섭취 여부 (최대 1점). None→1 (보수적)."""
    if eats_vegetables_daily is None or not eats_vegetables_daily:
        return 1
    return 0


def _score_hypertension(has_hypertension: bool | None) -> int:
    """고혈압약 복용 여부 (최대 2점). None→0 (절대 가정 안 함)."""
    if has_hypertension:
        return 2
    return 0


def _score_glucose_history(has_high_glucose_history: bool) -> int:
    """고혈당 판정 이력 (최대 5점)."""
    if has_high_glucose_history:
        return 5
    return 0


def _score_family(family_history: str | None) -> int:
    """가족력 — parents/siblings/both→5(1촌), none/unknown→0 (최대 5점)."""
    if family_history in ("parents", "siblings", "both"):
        return 5
    return 0


# ──────────────────────────────────────────────
# 위험도 분류
# ──────────────────────────────────────────────


def _classify_risk(score: int) -> RiskLevel:
    """0-3→low, 4-8→slight, 9-12→moderate, 13-20→high, 21-26→very_high."""
    if score <= 3:
        return RiskLevel.LOW
    if score <= 8:
        return RiskLevel.SLIGHT
    if score <= 12:
        return RiskLevel.MODERATE
    if score <= 20:
        return RiskLevel.HIGH
    return RiskLevel.VERY_HIGH


# ──────────────────────────────────────────────
# 공개 API
# ──────────────────────────────────────────────


def calculate_findrisc(
    *,
    age: int,
    bmi: float,
    waist_cm: float | None,
    is_male: bool,
    is_physically_active: bool | None,
    eats_vegetables_daily: bool | None,
    has_hypertension: bool | None,
    has_high_glucose_history: bool,
    family_history: str | None,
) -> FindriscResult:
    """FINDRISC 8변수로 당뇨 위험 점수(0-26)를 계산한다."""
    breakdown = {
        "age": _score_age(age),
        "bmi": _score_bmi(bmi),
        "waist": _score_waist(waist_cm, is_male),
        "activity": _score_activity(is_physically_active),
        "vegetable": _score_vegetable(eats_vegetables_daily),
        "hypertension": _score_hypertension(has_hypertension),
        "glucose_history": _score_glucose_history(has_high_glucose_history),
        "family": _score_family(family_history),
    }

    total = sum(breakdown.values())

    return FindriscResult(
        total_score=total,
        risk_level=_classify_risk(total),
        score_breakdown=breakdown,
    )


def calculate_initial_findrisc(
    *,
    age: int,
    bmi: float,
    is_male: bool,
    exercise_frequency: str | None,
    eats_vegetables_daily: bool | None,
    has_hypertension: bool,
    has_high_glucose_history: bool,
    family_history: str | None,
) -> FindriscResult:
    """온보딩 시 초기 FINDRISC 점수를 계산한다.

    온보딩에서는 waist_cm이 없으므로 0점으로 처리.
    exercise_frequency를 FINDRISC의 '매일 30분 운동' 기준에 매핑.
    """
    # 주 3-4회 이상 ≈ 매일 30분 운동
    is_active = exercise_frequency in ("3_4_per_week", "5_plus_per_week")

    return calculate_findrisc(
        age=age,
        bmi=bmi,
        waist_cm=None,
        is_male=is_male,
        is_physically_active=is_active,
        eats_vegetables_daily=eats_vegetables_daily,
        has_hypertension=has_hypertension,
        has_high_glucose_history=has_high_glucose_history,
        family_history=family_history,
    )
