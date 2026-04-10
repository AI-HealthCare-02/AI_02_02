# LangGraph 회귀 및 성능 검증

## 기존 유지 테스트
- `backend/tests/unit/test_content_filter.py`
- `backend/tests/unit/test_chat_branch_sse.py`
- `backend/tests/unit/test_chat_service_routing.py`
- `backend/tests/unit/test_sse_format.py`
- `backend/tests/integration/test_chat_branch_flow.py`

## 신규 테스트
- `backend/tests/unit/test_chat_langgraph_parity.py`
- `backend/tests/unit/test_chat_langgraph_prompt_layers.py`
- `backend/tests/unit/test_chat_langgraph_mode_switch.py`
- `backend/tests/unit/test_chat_langgraph_logging.py`
- `scripts/bench_chat_prep_langgraph.py`

## 보호 parity 필드
- `should_run_rag`
- `should_build_user_context`
- `topic_hint`
- `message_route`
- `emotional_priority`
- `rag_hit_count`
- `rag_has_context`
- `user_context_has_context`
- `system_prompt_sha256`
- `openai_messages_sha256`
- `openai_role_sequence`
- `filter_instruction_present`

## 성능 기준
- prep median overhead `<= +15ms`
- prep p95 overhead `<= +50ms`
- prep p99 overhead `<= +100ms`
- first-token p95 악화 `<= 10%` 그리고 `<= +150ms`

## 현재 실행 결과 메모
- unit: 로컬 실행 가능
- integration:
  - `backend/tests/integration/test_chat_branch_flow.py` 는 현재 로컬 `postgres:5432` 호스트 부재로 실행 불가
  - rollout 전에는 환경에서 반드시 재검증 필요
