"""content_filter 전용 reason code enum."""

from enum import Enum


class FilterReasonCode(Enum):
    CRISIS_INTENT = "crisis_intent"
    MEDICAL_REFUSAL = "medical_refusal"
    SEVERE_PROFANITY = "severe_profanity"
    MILD_PROFANITY = "mild_profanity"
    HEALTH_FRUSTRATION = "health_frustration"


def reason_code_values(codes: list[FilterReasonCode]) -> list[str]:
    """문서/스냅샷 직렬화용 문자열 목록."""
    return [code.value for code in codes]
