"""orjson vs json 동등성 단위 테스트 — _sse_event 교체 가드."""

import json

import pytest

from backend.services.chat.streaming import _sse_event


@pytest.mark.parametrize(
    "event_type,data",
    [
        ("token", {"content": "안녕하세요 다나아입니다."}),
        ("token", {"content": "Hello, world!"}),
        ("error", {"code": "content_blocked", "message": "부적절한 표현이 포함되어 있어요."}),
        ("error", {"message": "AI 서비스가 아직 설정되지 않았어요."}),
        (
            "done",
            {
                "session_id": 42,
                "health_questions": [
                    {
                        "bundle_key": "bundle_1",
                        "name": "수면",
                        "questions": [
                            {
                                "field": "sleep_quality",
                                "text": "어젯밤 잠은 잘 잤어? 😴",
                                "options": ["very_good", "good", "normal", "bad", "very_bad"],
                                "input_type": "select",
                                "condition": None,
                            },
                        ],
                    },
                ],
            },
        ),
        ("done", {"session_id": 1}),
    ],
)
def test_sse_event_equivalence(event_type: str, data: dict):
    result = _sse_event(event_type, data)

    # SSE 프레임 형식 확인
    assert result.startswith(f"event: {event_type}\n")
    assert result.endswith("\n\n")

    # data: 줄 추출 후 JSON 역직렬화 동등성 확인
    data_line = result.split("data: ", 1)[1].rstrip("\n")
    parsed = json.loads(data_line)
    assert parsed == data

    # 기존 json.dumps(ensure_ascii=False) 결과와도 일치하는지
    old_style = json.dumps(data, ensure_ascii=False)
    old_parsed = json.loads(old_style)
    assert parsed == old_parsed
