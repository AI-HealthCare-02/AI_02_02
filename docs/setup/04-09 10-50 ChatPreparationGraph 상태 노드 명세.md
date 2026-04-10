# ChatPreparationGraph 상태 노드 명세

## Graph Input
| 필드 | 설명 |
|---|---|
| `user_id` | sticky bucketing / user context 기준 |
| `message_text` | 현재 사용자 메시지 |
| `base_system_prompt` | `eligible_bundles`를 반영한 기본 시스템 프롬프트 |
| `history_turns` | role/content만 가진 읽기 전용 스냅샷 |
| `route` | `MessageRoute | None` |
| `emotional_priority` | 감정 우선 응답 여부 |
| `prompt_policy` | `NONE / WARN / MEDICAL_NOTE` |
| `flags` | rag/user_context/routing apply 관련 feature flag |
| `profile_context` | raw ORM이 아닌 얇은 요약 스냅샷 |

## Graph Output
| 필드 | 설명 |
|---|---|
| `openai_messages` | 최종 OpenAI 입력 |
| `should_run_rag` | parity/logging용 |
| `should_build_user_context` | parity/logging용 |
| `topic_hint` | user context 힌트 |
| `rag_hit_count` | parity/logging용 |
| `rag_has_context` | parity/logging용 |
| `user_context_has_context` | parity/logging용 |
| `user_context_layer` | hash 비교용 |
| `route_layer` | hash 비교용 |
| `rag_layer` | hash 비교용 |
| `filter_instruction_layer` | hash 비교용 |
| `final_system_prompt` | 최종 프롬프트 hash 기준 |

## Node 책임
| 노드 | 책임 |
|---|---|
| `decide_rag` | route/emotion/policy/flags 기준으로 RAG 필요 여부 판단 |
| `run_rag` | safe lexical RAG 실행 |
| `decide_user_context` | user context 생성 필요 여부 판단 |
| `build_user_context` | profile snapshot 기반 요약 생성 |
| `assemble_prompt_layers` | base prompt 위에 user_context/route/rag/filter 레이어를 순서대로 조립 |

## Non-goals
- `content_filter`를 그래프로 옮기지 않음
- session/message DB write를 그래프에서 수행하지 않음
- `_stream_openai`, `_sse_event`를 그래프로 옮기지 않음
- `checkpointer`, `memory`, `graph streaming`, `human approval` 도입 안 함

## Anti-patterns
- `FilterResult` 전체를 state에 넣기
- raw `profile` 또는 ORM 객체를 state에 넣기
- routing/emotion을 graph 안에서 재계산하기
- `eligible_bundles`까지 graph에 넣어 책임을 키우기

## Fallback 규칙
- graph compile 실패 시 `mode=off`
- node 예외 / timeout / invalid output 시 요청 단위 legacy fallback
