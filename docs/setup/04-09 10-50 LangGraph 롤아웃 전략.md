# LangGraph 롤아웃 전략

## Mode 정의
| mode | 사용자 응답 소스 | graph 역할 |
|---|---|---|
| `off` | legacy | 미사용 |
| `shadow` | legacy | parity/latency 기록만 수행 |
| `partial` | graph 또는 legacy | sticky cohort만 graph 사용, 실패 시 legacy fallback |

## Sticky Bucketing
- 기준 키: `user_id`
- 목적: 같은 사용자가 요청마다 legacy/graph를 오가지 않게 유지

## Shadow 승급 기준
- eligible shadow 요청 최소 `1,000건`
- 보호 parity field mismatch `0건`
- fallback rate `< 0.1%`
- branch/SSE 회귀 `0건`
- prep median overhead `<= +15ms`
- prep p95 overhead `<= +50ms`
- first-token p95 악화 `<= 10%`

## Partial 램프
- `1% -> 5% -> 10% -> 25% -> 50% -> 100%`
- 각 단계 최소 24시간 관찰

## 즉시 롤백 조건
- crisis/block/consent 요청이 graph 경로에 들어간 증거 1건
- SSE shape 변화 1건
- branch별 DB write semantics divergence 1건
- 잘못된 `done` payload 1건

## Kill Switch
- `CHAT_LANGGRAPH_MODE=off`
- `CHAT_LANGGRAPH_FORCE_FALLBACK=true`
- `CHAT_LANGGRAPH_PARTIAL_PERCENT=0`
