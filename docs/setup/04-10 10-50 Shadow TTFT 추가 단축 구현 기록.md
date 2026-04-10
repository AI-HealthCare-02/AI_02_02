# Shadow TTFT 추가 단축 구현 기록

## 1. 목적
- 목표: `gpt-4o-mini` 고정 상태에서 실제 운영 기준인 `shadow 서버 TTFT`를 줄인다.
- 최신 신뢰 기준값:
  - `controlled/off`: TTFT `0.858초`, done `2.074초`
  - `mirror/shadow`: TTFT `1.022초`, done `2.463초`
- 이번 목표:
  - `shadow sample 5%` 기준 TTFT `0.85초 이하` 1차 도전
  - 가능하면 `0.80~0.82초` 구간 도전

## 2. 이번 구현 범위
- `content_filter`, crisis/block/consent precedence, DB 저장 순서, SSE `token/error/done`, `done` payload는 변경하지 않았다.
- `shadow` 모드에서 모든 요청이 LangGraph adapter에 들어가던 구조를 줄였다.
- `shadow sample`에 걸린 요청만 LangGraph adapter와 parity 준비를 수행한다.
- `shadow sample`에 걸리지 않은 요청은 `off`와 같은 legacy prep fast path를 탄다.
- `/chat/send`, `/chat/history`, `/chat/health-answer`에서 `ChatService`를 요청마다 새로 만들지 않고 라우터 단위 singleton dependency로 재사용한다.
- `USER` 메시지 저장 이후 `history` 조회와 `eligible_bundles` 조회를 병렬화했다.
- history 조회는 ORM 객체 전체 대신 `role`, `content` 중심 lightweight snapshot으로 줄였다.
- prompt/completion token 추정은 `CHAT_BENCH_BUDGET_ENABLED=true`일 때만 수행한다.
- token 추정은 `done` 이벤트 이후에 수행하도록 옮겨 TTFT/done 측정을 오염시키지 않게 했다.
- 로컬 `.env`의 운영 미러 기준을 `CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE=0.05`, `CHAT_LANGGRAPH_AUDIT_SAMPLE_RATE=0.0`으로 맞췄다.

## 3. 주요 변경 파일
- `backend/services/chat_graph/adapter.py`
  - `should_enter_langgraph_adapter()` 추가
  - `shadow` sample 미선택 요청은 adapter 진입 전 차단
  - `partial`도 실제 partial bucket 대상일 때만 adapter 진입
- `backend/services/chat/service.py`
  - request validation/profile access 병렬 시작
  - USER 저장 이후 history/eligible bundle 병렬화
  - `_get_prompt_history()` lightweight projection 추가
  - LangGraph prep 진입 여부를 service 레벨에서 먼저 판단
  - benchmark token budget 계산을 일반 hot path에서 제거
- `backend/apis/v1/chat_routers.py`
  - `get_chat_service()` singleton dependency 추가
- `backend/core/config.py`
  - `CHAT_BENCH_BUDGET_ENABLED=false` 기본값 추가
- `backend/tests/unit/test_chat_langgraph_mode_switch.py`
  - `shadow sample 0%`는 adapter에 들어가지 않는 테스트 추가
  - `shadow sample 100%`는 adapter에 들어가는 테스트 추가
- `backend/tests/integration/test_bench_service_ttft.py`
  - 결과를 초 단위로 출력
  - `mode`, `shadow_sample_rate`, `audit_sample_rate`를 JSON summary에 기록
  - `prompt_tokens_estimate`, `completion_tokens_estimate`, `generate_sec` 기록

## 4. 검증 결과
- `uv run ruff check backend/services/chat_graph/adapter.py backend/services/chat/service.py backend/apis/v1/chat_routers.py backend/core/config.py backend/tests/unit/test_chat_langgraph_mode_switch.py backend/tests/integration/test_bench_service_ttft.py`
  - 결과: 통과
- `uv run python -m pytest backend/tests/unit/test_chat_branch_sse.py backend/tests/unit/test_chat_service_routing.py backend/tests/unit/test_chat_langgraph_mode_switch.py -q`
  - 결과: `20 passed`
- `uv run python -m pytest backend/tests/unit -q`
  - 결과: `200 passed`
- `DB_HOST=localhost DB_NAME=test uv run python -m pytest backend/tests/integration/test_chat_branch_flow.py -q`
  - 결과: `5 passed`
- `DB_HOST=localhost DB_NAME=test CHAT_LANGGRAPH_MODE=shadow CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE=0.05 CHAT_LANGGRAPH_AUDIT_SAMPLE_RATE=0 BENCH_ITERATIONS=1 uv run python -m pytest backend/tests/integration/test_bench_service_ttft.py -s -q`
  - 결과: 통과
  - smoke TTFT: `2.4671초`
  - smoke done: `4.7633초`
  - 주의: `n=1`이고 OpenAI 응답이 느린 순간이라 공식 성능 판단값이 아니다.

## 5. 확인된 이슈와 해석
- integration test를 병렬로 동시에 실행하면 Tortoise가 같은 `test` DB를 동시에 생성하려 해 `duplicate key value violates unique constraint "pg_database_datname_index"`가 발생할 수 있다.
- 순차 실행하면 `test_chat_branch_flow.py`는 정상 통과한다.
- `BENCH_BUDGET_ENABLED=true` 상태에서 token 추정을 stream 전에 수행하면 TTFT 측정이 오염될 수 있었다.
- 이번 수정으로 token 추정은 `done` 이후로 이동했고, 사용자가 체감하는 TTFT와 done 앞에는 끼어들지 않는다.
- `n=1` smoke 결과는 서비스 경로가 실제 OpenAI까지 정상 동작하는지 확인하는 용도다.
- 공식 판단은 플랜대로 입력 10개 x 30 pair 이상으로 다시 측정해야 한다.

## 6. 다음 공식 측정 명령 예시
```powershell
$env:DB_HOST='localhost'
$env:DB_NAME='test'
$env:OPENAI_MODEL='gpt-4o-mini'
$env:CHAT_LANGGRAPH_MODE='shadow'
$env:CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE='0.05'
$env:CHAT_LANGGRAPH_AUDIT_SAMPLE_RATE='0'
$env:CHAT_BENCH_BUDGET_ENABLED='true'
$env:BENCH_LABEL='shadow-sample-5'
$env:BENCH_ITERATIONS='30'
uv run python -m pytest backend/tests/integration/test_bench_service_ttft.py -s -q
```

## 7. 현재 판단
- 코드상으로는 shadow 오버헤드를 줄이는 핵심 변경이 반영됐다.
- 회귀 테스트 기준으로 branch/SSE/DB semantics는 유지됐다.
- 아직 공식 `shadow sample 5%` 결과는 없다.
- 다음 단계는 같은 조건에서 `off`, `shadow 0%`, `shadow 5%`, `shadow 100%`를 순차 측정해 목표 구간인 `0.85초 이하`에 접근했는지 확인하는 것이다.

## 8. 공식 측정 결과 추가
- 측정 문서: `docs/setup/04-10 11-08 Shadow TTFT 공식 측정 결과.md`
- 측정 로그: `logs/ttft-official-0410-1050/`

| 측정 세트 | TTFT 중앙값 | done 중앙값 | 판정 |
|---|---:|---:|---|
| off | 1.055초 | 2.380초 | 순수 서버 기준 |
| shadow0 | 0.994초 | 2.242초 | shadow 모드 진입 자체 비용은 작음 |
| shadow5 | 1.262초 | 2.710초 | 첫 측정, OpenAI 변동 가능성 큼 |
| shadow5-rerun | 1.071초 | 2.681초 | 목표 조건 재측정 |
| shadow100 | 1.081초 | 2.789초 | shadow adapter 최악 기준 |

- 목표였던 `shadow5 TTFT 0.80~0.85초`는 이번 측정에서 달성하지 못했다.
- `shadow0`와 `shadow100` 차이가 약 `0.087초`라서, shadow adapter 오버헤드는 줄어든 것으로 보인다.
- 현재 가장 큰 병목은 내부 코드보다 OpenAI 첫 토큰 응답 변동으로 판단된다.
- 다음에는 조건별 순차 실행이 아니라 interleaved benchmark로 시간대 편향을 줄여야 한다.

## 9. 후속 interleaved 실측 결과 (04-10 02:50)

- 후속 문서: `docs/setup/04-10 02-50 TTFT 공식 interleaved 실측 및 pivot 권고.md`
- 측정 로그: `logs/ttft-interleaved-before.log`, `logs/ttft-interleaved-after.log`

### 추가 적용한 코드 변경 (3차 최적화)
1. tiktoken encoding 모듈 레벨 캐시 (`token_budget.py`)
2. `_sse_event` orjson 교체 (`streaming.py`)
3. OpenAI 공유 클라이언트 stream warmup 추가 (`openai_client.py`)
4. `ChatMessage.create(USER)` + bundles + history 3작업 asyncio 병렬화 (`service.py`)

### interleaved 벤치 결과 (조건당 n=49, warmup 1회 제외)

| 조건 | BEFORE TTFT median | AFTER TTFT median | Δ | 95% CI (AFTER) |
|---|---:|---:|---:|---|
| off | 1.148초 | 1.107초 | −0.041초 | [1.071, 1.149] |
| shadow0 | 1.081초 | 1.094초 | +0.013초 | [1.002, 1.141] |
| **shadow5** | **1.096초** | **1.098초** | **+0.002초** | [1.020, 1.145] |
| shadow100 | 1.102초 | 1.139초 | +0.037초 | [1.074, 1.211] |

### 판정
- shadow5 TTFT 1.098초 → 목표 0.85초 미달성
- before/after 차이 +0.002초 → 95% CI 완전 겹침 → 통계적으로 유의미한 변화 없음
- **코드 micro-opt 효과가 OpenAI 첫 토큰 변동 폭(±300ms)에 완전히 묻힘**
- 가이드 10장 pivot 조건 충족 → 코드 micro-opt 종결, OpenAI 네트워크 RTT/인프라 방향 전환 권고
