from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse as Response

from app.dependencies.security import get_request_token_payload
from app.domains.health.enums import RiskLevel
from app.domains.health.schemas import RiskLatestResponse

risk_router = APIRouter(prefix="/risk", tags=["risk"])


def _risk_response() -> RiskLatestResponse:
    return RiskLatestResponse(
        findrisc_score=12,
        risk_level=RiskLevel.MODERATE,
        sleep_score=78,
        diet_score=65,
        exercise_score=82,
        lifestyle_score=70,
        score_breakdown={
            "age": 2,
            "bmi": 1,
            "waist": 3,
            "activity": 0,
            "vegetable": 1,
            "hypertension": 2,
            "glucose_history": 0,
            "family": 3,
        },
        top_positive_factors=["good_sleep", "regular_walk"],
        top_risk_factors=["carb_heavy_meals"],
        assessed_at=datetime.fromisoformat("2026-03-31T00:00:00+09:00"),
        assessment_period="weekly",
    )


@risk_router.get("/latest", response_model=RiskLatestResponse, status_code=status.HTTP_200_OK)
async def get_latest_risk_assessment(_: Annotated[dict, Depends(get_request_token_payload)]) -> Response:
    response = _risk_response()
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)


@risk_router.post("/recalculate", response_model=RiskLatestResponse, status_code=status.HTTP_200_OK)
async def recalculate_risk(_: Annotated[dict, Depends(get_request_token_payload)]) -> Response:
    response = _risk_response()
    return Response(response.model_dump(mode="json"), status_code=status.HTTP_200_OK)
