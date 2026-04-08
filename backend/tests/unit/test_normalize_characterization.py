"""normalize option C characterization tests."""

import json
from pathlib import Path

import pytest

from backend.services.content_filter import ContentFilterService, _normalize_text
from backend.services.content_filter_reason_codes import reason_code_values

_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "normalize_golden.json"


@pytest.fixture
def routing_service(monkeypatch: pytest.MonkeyPatch) -> ContentFilterService:
    monkeypatch.setenv("CONTENT_FILTER_ROUTING_ENABLED", "true")
    return ContentFilterService()


class TestNormalizeOptionC:
    @pytest.mark.parametrize(
        ("raw_text", "expected"),
        [
            ("당화혈색소 6.5%", "당화혈색소 6.5%"),
            ("혈당 100-120", "혈당 100-120"),
            ("혈압 140/90이에요", "혈압 140/90이에요"),
            ("공복혈당 95mg/dL", "공복혈당 95mg/dL"),
            ("죽고...싶다", "죽고 싶다"),
            ("약. 끊을 거예요", "약 끊을 거예요"),
        ],
    )
    def test_normalize_protects_numbers_and_cleans_bypass_punctuation(self, raw_text: str, expected: str):
        assert _normalize_text(raw_text) == expected

    def test_golden_snapshot(self, routing_service: ContentFilterService):
        cases = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))

        for case in cases:
            result = routing_service.check_message(case["input"])
            assert result.medical_action.value == case["expected_medical_action"], case["input"]
            assert result.expression_verdict.value == case["expected_expression_verdict"], case["input"]
            route_value = None if result.message_route is None else result.message_route.value
            assert route_value == case["expected_message_route"], case["input"]
            assert result.emotional_priority is case["expected_emotional_priority"], case["input"]
            assert reason_code_values(result.reason_codes) == case["expected_reason_codes"], case["input"]
