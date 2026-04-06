"""주기적 측정값 서비스 — 체중·허리둘레·혈압·HbA1c·공복혈당."""

from __future__ import annotations

from backend.dtos.health import (
    MeasurementCreateRequest,
    MeasurementListResponse,
    MeasurementResponse,
)
from backend.models.health import PeriodicMeasurement

_UNIT_MAP: dict[str, str] = {
    "weight": "kg",
    "waist": "cm",
    "blood_pressure": "mmHg",
    "hba1c": "%",
    "fasting_glucose": "mg/dL",
}


class MeasurementService:
    """주기적 측정값 CRUD."""

    async def create(self, user_id: int, data: MeasurementCreateRequest) -> MeasurementResponse:
        """측정값 저장."""
        unit = _UNIT_MAP.get(data.measurement_type, "")
        m = await PeriodicMeasurement.create(
            user_id=user_id,
            measurement_type=data.measurement_type,
            numeric_value=data.numeric_value,
            numeric_value_2=data.numeric_value_2,
            unit=unit,
            source=data.source,
            measured_at=data.measured_at,
        )
        return MeasurementResponse(
            id=m.id,
            measurement_type=m.measurement_type,
            numeric_value=m.numeric_value,
            numeric_value_2=m.numeric_value_2,
            source=m.source,
            measured_at=m.measured_at,
            created_at=m.created_at,
        )

    async def list_measurements(
        self,
        user_id: int,
        measurement_type: str | None = None,
        limit: int = 20,
    ) -> MeasurementListResponse:
        """측정값 목록 조회."""
        qs = PeriodicMeasurement.filter(user_id=user_id)
        if measurement_type:
            qs = qs.filter(measurement_type=measurement_type)
        records = await qs.order_by("-measured_at").limit(limit)

        items = [
            MeasurementResponse(
                id=m.id,
                measurement_type=m.measurement_type,
                numeric_value=m.numeric_value,
                numeric_value_2=m.numeric_value_2,
                source=m.source,
                measured_at=m.measured_at,
                created_at=m.created_at,
            )
            for m in records
        ]
        return MeasurementListResponse(measurements=items)
