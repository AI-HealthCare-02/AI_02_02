"""SSE 이벤트 포맷 단위 테스트.

_sse_event() 함수가 W3C SSE 표준 형식을 준수하는지 검증.
"""

import json

from backend.services.chat import _sse_event


class TestSseFormat:
    """_sse_event() 출력 형식 테스트."""

    def test_token_event_format(self):
        """token 이벤트 — event: token\\ndata: JSON\\n\\n."""
        result = _sse_event("token", {"content": "hello"})
        assert result.startswith("event: token\n")
        assert "data: " in result
        assert result.endswith("\n\n")

        # JSON 파싱 가능한지 확인
        data_line = result.split("\n")[1]
        assert data_line.startswith("data: ")
        parsed = json.loads(data_line[6:])
        assert parsed["content"] == "hello"

    def test_done_event_format(self):
        """done 이벤트 — session_id 포함."""
        result = _sse_event("done", {"session_id": 42})
        assert result.startswith("event: done\n")
        data_line = result.split("\n")[1]
        parsed = json.loads(data_line[6:])
        assert parsed["session_id"] == 42

    def test_error_event_format(self):
        """error 이벤트."""
        result = _sse_event("error", {"message": "에러 발생"})
        assert result.startswith("event: error\n")

    def test_korean_text_not_escaped(self):
        """한글이 유니코드 이스케이프 없이 출력되는지 확인."""
        result = _sse_event("token", {"content": "안녕하세요"})
        assert "안녕하세요" in result
        assert "\\u" not in result

    def test_no_type_key_in_json(self):
        """JSON 안에 type 키가 없어야 함 (event: 라인으로 분리됨)."""
        result = _sse_event("token", {"content": "test"})
        data_line = result.split("\n")[1]
        parsed = json.loads(data_line[6:])
        assert "type" not in parsed

    def test_error_with_code_field(self):
        """error 이벤트에 code 필드 포함 — 콘텐츠 필터 차단용."""
        result = _sse_event("error", {"code": "content_blocked", "message": "부적절한 표현"})
        data_line = result.split("\n")[1]
        parsed = json.loads(data_line[6:])
        assert parsed["code"] == "content_blocked"
        assert "message" in parsed
