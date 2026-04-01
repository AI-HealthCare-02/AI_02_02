from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_token_payload
from app.domains.health.schemas import (
    AnalysisActivityRing,
    AnalysisCoachResponse,
    AnalysisDietResponse,
    AnalysisHabitsResponse,
    AnalysisHeatmap,
    AnalysisScorecard,
    AnalysisSummaryResponse,
    DietTimelineItem,
    NutritionRadar,
    RiskTrendItem,
)

analysis_router = APIRouter(prefix="/analysis", tags=["analysis"])


@analysis_router.get("/summary", response_model=AnalysisSummaryResponse, status_code=status.HTTP_200_OK)
async def get_analysis_summary(
    period: int = Query(default=7),
    _: Annotated[dict, Depends(get_request_token_payload)] = None,
) -> Response:
    response = AnalysisSummaryResponse(
        period=period,
        scorecard=AnalysisScorecard(
            overall_score=72,
            sleep_score=78,
            diet_score=65,
            exercise_score=82,
            lifestyle_score=70,
            change_from_previous=3,
        ),
        activity_ring=AnalysisActivityRing(
            exercise_minutes_total=120,
            exercise_target=150,
            exercise_pct=0.80,
            veggie_days=5,
            veggie_target=7,
            veggie_pct=0.71,
            sleep_avg_hours=7.2,
            water_avg_cups=6.5,
        ),
        heatmap=AnalysisHeatmap(
            dates=[date.fromisoformat(f"2026-03-{day:02d}") for day in range(26, 32)]
            + [date.fromisoformat("2026-04-01")],
            completion_rates=[0.82, 0.91, 0.73, 1.0, 0.55, 0.64, 0.55],
        ),
        risk_trend=[
            RiskTrendItem(date=date.fromisoformat("2026-03-25"), findrisc_score=13),
            RiskTrendItem(date=date.fromisoformat("2026-04-01"), findrisc_score=12),
        ],
        nutrition_radar=NutritionRadar(
            veggie=0.71,
            breakfast_regularity=0.86,
            sugar_control=0.80,
            meal_balance=0.60,
            water=0.81,
        ),
        glucose_summary=None,
        cached_at=datetime.fromisoformat("2026-04-01T10:30:00+09:00"),
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@analysis_router.get("/diet", response_model=AnalysisDietResponse, status_code=status.HTTP_200_OK)
async def get_analysis_diet(
    period: int = Query(default=7),
    _: Annotated[dict, Depends(get_request_token_payload)] = None,
) -> Response:
    response = AnalysisDietResponse(
        period=period,
        timeline=[
            DietTimelineItem(
                date=date.fromisoformat("2026-04-01"),
                breakfast="hearty",
                lunch=None,
                dinner=None,
                veggie=True,
                sweetdrink="none",
                foodcomp="balanced",
            )
        ],
        weekly_pattern={
            "breakfast_rate": 0.86,
            "lunch_rate": 0.71,
            "dinner_rate": 0.57,
            "veggie_rate": 0.71,
            "sugar_free_rate": 0.80,
        },
        scores={
            "regularity": 72,
            "balance": 65,
            "veggie": 71,
            "sugar_control": 80,
            "overall_diet": 72,
        },
        cached_at=datetime.fromisoformat("2026-04-01T10:30:00+09:00"),
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@analysis_router.get("/habits", response_model=AnalysisHabitsResponse, status_code=status.HTTP_200_OK)
async def get_analysis_habits(
    period: int = Query(default=7),
    _: Annotated[dict, Depends(get_request_token_payload)] = None,
) -> Response:
    response = AnalysisHabitsResponse(
        period=period,
        cards={
            "exercise": {"avg_minutes_per_day": 17, "total_minutes": 120, "target": 150, "pct": 0.80},
            "sleep": {"avg_hours": 7.2, "good_or_above_rate": 0.71},
            "water": {"avg_cups": 6.5, "target": 8, "pct": 0.81},
            "walk": {"days_walked": 5, "total_days": 7, "pct": 0.71},
        },
        weekly_calendar=[
            {
                "date": date.fromisoformat("2026-04-01"),
                "exercise": True,
                "sleep_quality": "good",
                "water_cups": 5,
                "walked": True,
            }
        ],
        exercise_chart=[
            {"date": date.fromisoformat("2026-04-01"), "minutes": 30, "type": "walking"},
            {"date": date.fromisoformat("2026-03-31"), "minutes": 0, "type": None},
        ],
        cached_at=datetime.fromisoformat("2026-04-01T10:30:00+09:00"),
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@analysis_router.get("/coach", response_model=AnalysisCoachResponse, status_code=status.HTTP_200_OK)
async def get_analysis_coach(_: Annotated[dict, Depends(get_request_token_payload)]) -> Response:
    response = AnalysisCoachResponse(
        coach_card={
            "title": "이번 주 운동 시간이 조금 부족해요",
            "body": "주 150분 목표 중 120분을 달성했어요. 30분만 더 채우면 목표 달성!",
            "category": "exercise",
            "action_suggestion": "오늘 30분 산책을 추천해요",
            "disclaimer": "이 정보는 교육 목적이며, 전문가 상담을 대체할 수 없습니다.",
        },
        weekly_report={
            "highlights": ["수면 평균 7.2시간으로 양호해요", "채소 섭취를 5일 실천했어요"],
            "improvements": ["운동 시간을 조금 더 늘려보는 것을 권장합니다", "수분 섭취가 목표에 조금 못 미쳐요"],
            "findrisc_change": -1,
            "period_summary": "전반적으로 좋은 한 주였어요!",
        },
    )
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)
