# reason codes 인벤토리

## enum 정의
- 파일: `backend/services/content_filter_reason_codes.py`
- 타입: 순수 `Enum`

## 멤버
- `CRISIS_INTENT`
- `MEDICAL_REFUSAL`
- `SEVERE_PROFANITY`
- `MILD_PROFANITY`
- `HEALTH_FRUSTRATION`

## producer
- `backend/services/content_filter.py`
  - `_check_medical_safety()`
  - `_check_expression()`

## consumer
- `backend/services/content_filter.py`
  - `_merge_results()`
  - `_classify_routing()`
- `backend/tests/unit/test_chat_service_routing.py`
- `backend/tests/unit/test_chat_branch_sse.py`
- `backend/tests/integration/test_chat_branch_flow.py`
- `backend/tests/unit/test_normalize_characterization.py`

## 규칙
- `StrEnum` 금지
- 문자열/enum 혼용 금지
- JSON/문서 snapshot에는 `.value`로 직렬화
- 이번 라운드에서는 `set` 전환 금지
