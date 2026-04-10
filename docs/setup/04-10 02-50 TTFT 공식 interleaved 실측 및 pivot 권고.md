# TTFT 공식 Interleaved 실측 및 Pivot 권고

## 1. 목적

`테스트 환경.txt` 공식 가이드를 완전 준수하는 interleaved 벤치를 구축하고, Phase 1+2 코드 최적화의 before/after를 측정해 0.7~0.8초 목표 도달 여부를 판정한다.

## 2. 측정 환경

| 항목 | 값 |
|---|---|
| 모델 | `gpt-4o-mini` |
| DB | Docker `postgres` (healthy) + `redis` (healthy), `DB_HOST=localhost`, `DB_NAME=test` |
| 측정 도구 | `test_bench_service_ttft_interleaved.py` (service-level interleaved runner) |
| 조건 | `off`, `shadow0`, `shadow5` (**PRIMARY**), `shadow100` |
| 라운드 수 | 조건당 50회 (warmup round 1 제외 → 49회 집계) |
| 측정 순서 | **interleaved** (off→shadow0→shadow5→shadow100 반복) |
| 통계 | median, mean, p95, bootstrap 95% CI (scipy, 1000 resample) |
| 에러 처리 | error_rate + zero_token_terminal_rate 분리 리포팅 |
| 벤치 예산 | `CHAT_BENCH_BUDGET_ENABLED=true` (토큰 추정은 `yield done` 이후에만 실행) |

## 3. 적용한 코드 변경 (Phase 1+2)

### Phase 1.1 — tiktoken 모듈 레벨 캐시
- **파일**: `backend/services/chat/token_budget.py`
- **내용**: `_get_encoding()` 이 매 요청마다 `tiktoken.encoding_for_model()` 을 호출하던 것을 모듈 전역 `_ENCODING_CACHED` 에 1회만 resolve 하도록 변경
- **기대 shave**: warm −15ms

### Phase 1.2 — `_sse_event` orjson 교체
- **파일**: `backend/services/chat/streaming.py`
- **내용**: `json.dumps(data, ensure_ascii=False)` → `orjson.dumps(data).decode("utf-8")`
- **가드**: `backend/tests/unit/test_chat_sse_encoding.py` (token/error/done 3개 이벤트 동등성 검증)
- **기대 shave**: −5 to −10ms

### Phase 1.3 — warmup에 stream=True 더미 추가
- **파일**: `backend/services/chat/openai_client.py`
- **내용**: 기존 `stream=False` 1토큰 더미 이후 `stream=True` 1 chunk 소비 추가. try/finally로 `close_stream_resource` 보장. non-fatal.
- **기대 shave**: 콜드 −40~80ms, warm median 기여 낮음

### Phase 2.1 — bundles + ChatMessage.create 병렬화
- **파일**: `backend/services/chat/service.py`
- **내용**: `ChatMessage.create(USER)` 를 `asyncio.create_task` 로 떼어내 `bundles_task` + `history_awaitable` 과 병렬 실행. try/except BaseException 에서 bundles_task cancel + user_save_task await 보장.
- **기대 shave**: −20 to −40ms

### Phase 2.2 — 토큰 추정 yield done 이후 이동
- **상태**: **이전 라운드에서 이미 적용됨** (`CHAT_BENCH_BUDGET_ENABLED` gate + `yield done` 이후 계산)
- 이번 라운드에서 추가 변경 없음

### 검증 결과
- `ruff check backend`: clean
- `pytest backend/tests/unit`: **206 passed**
- `pytest backend/tests/integration/test_chat_branch_flow.py`: **5 passed**
- SSE encoding 가드: **6 passed**
- error_rate: **0%** (모든 조건, before/after 모두)
- 기능 회귀: **0건**

## 4. 실측 결과

### 4-1. TTFT median (초)

| 조건 | BEFORE | AFTER | Δ (초) | Δ (%) | BEFORE 95% CI | AFTER 95% CI |
|---|---:|---:|---:|---:|---|---|
| off | 1.1476 | 1.1069 | −0.041 | −3.5% | [1.034, 1.196] | [1.071, 1.149] |
| shadow0 | 1.0808 | 1.0940 | +0.013 | +1.2% | [0.981, 1.130] | [1.002, 1.141] |
| **shadow5** | **1.0955** | **1.0975** | **+0.002** | **+0.2%** | [1.031, 1.157] | [1.020, 1.145] |
| shadow100 | 1.1019 | 1.1385 | +0.037 | +3.3% | [1.057, 1.162] | [1.074, 1.211] |

### 4-2. done median (초)

| 조건 | BEFORE | AFTER | Δ (초) |
|---|---:|---:|---:|
| off | 2.415 | 2.190 | −0.225 |
| shadow0 | 2.384 | 2.354 | −0.030 |
| **shadow5** | **2.373** | **2.354** | **−0.019** |
| shadow100 | 2.307 | 2.395 | +0.088 |

### 4-3. 에러 및 이상치

| 항목 | BEFORE | AFTER |
|---|---|---|
| error_rate (모든 조건) | 0% | 0% |
| zero_token_terminal_rate | 0% | 0% |
| set_invalid | 해당 없음 | 해당 없음 |

### 4-4. 참고값 비교

| 출처 | shadow5 TTFT median |
|---|---:|
| 가이드 9장 (04-09 순차 측정) | 1.071초 |
| 이번 라운드 BEFORE (interleaved) | 1.096초 |
| 이번 라운드 AFTER (interleaved) | 1.098초 |

## 5. 판정

### 공식 목표 (shadow5 기준)

| 판정 | 조건 | 결과 |
|---|---|---|
| 강한 성공 (≤0.80초) | 1.098초 | ❌ 미달성 |
| 목표 성공 (≤0.82초) | 1.098초 | ❌ 미달성 |
| 1차 성공 (≤0.85초) | 1.098초 | ❌ 미달성 |
| done 악화 없음 | 2.373→2.354 | ✅ |
| error_rate < 5% | 0% | ✅ |
| 기능 회귀 | 0건 | ✅ |

### 해석

1. **코드 micro-opt의 실측 효과가 통계적 노이즈 수준**: shadow5 TTFT before 1.096초 → after 1.098초, 차이 +0.002초(0.2%). 95% CI가 완전히 겹침 → 통계적으로 유의미한 변화 없음.
2. **done 시간은 off 조건에서 −0.225초 개선** 관측됨: orjson SSE + bundles 병렬화가 전체 응답 완료 시간에 기여했을 가능성이 있으나, OpenAI 출력 길이 변동에 의해 흡수될 수 있는 수준.
3. **shadow0~shadow100 간 TTFT 차이**: BEFORE 0.044초 → AFTER 0.045초 → shadow adapter 자체 부담은 미미하고 안정적.
4. **OpenAI 첫 토큰 응답 변동이 TTFT의 지배적 요인**: 전체 TTFT 분포의 min~max가 0.76~2.08초 범위로, OpenAI 네트워크 RTT + 서버 스케줄링 변동이 코드 경로 최적화 폭(예상 65~120ms)을 완전히 흡수함.

## 6. Pivot 권고 (가이드 10장 발동)

**조건 충족**: Phase 1+2 적용 후 shadow5 median이 여전히 **1.098초 > 1.0초** → 가이드 10장 기준 코드 micro-opt 중단 권고.

### 다음 방향 (우선순위 순)

| 순위 | 방향 | 기대 효과 | 비고 |
|---|---|---|---|
| 1 | **OpenAI API 네트워크 RTT 측정 및 최적화** | RTT 100~200ms 절감 | `curl -w "%{time_connect} %{time_starttransfer}\n"` 으로 실측 |
| 2 | **Azure OpenAI 한국 리전 검토** | RTT 200~400ms 절감 가능 | base_url 변경만으로 적용 |
| 3 | **출력 길이 최적화** | done 시간 단축 | max_tokens 조정, 프롬프트 간결화 |
| 4 | **gpt-4o-mini 대안 모델 검토** | 근본적 TTFT 변경 | 현재 "모델 고정" 제약이지만 향후 논의 대상 |

### 이번 라운드 코드 변경 유지 권장 이유

TTFT 직접 개선이 노이즈 수준이지만:
- tiktoken cache: 프로덕션 CPU overhead 절감 (hot path에서 tiktoken init 반복 제거)
- orjson SSE: per-event 직렬화 성능 개선 (프로덕션 `CHAT_BENCH_BUDGET_ENABLED=false` 환경에서 체감)
- stream warmup: cold 첫 사용자 체감 개선
- bundles 병렬화: done 시간 소폭 개선 관측
- 기능 회귀 0건, error_rate 0%

## 7. 신규/수정 파일 목록

| 파일 | 변경 유형 | Phase |
|---|---|---|
| `backend/services/chat/token_budget.py` | Edit | 1.1 |
| `backend/services/chat/streaming.py` | Edit | 1.2 |
| `backend/services/chat/openai_client.py` | Edit | 1.3 |
| `backend/services/chat/service.py` | Edit | 2.1 |
| `backend/tests/unit/test_chat_sse_encoding.py` | 신규 | 1.2 가드 |
| `backend/tests/integration/test_bench_service_ttft.py` | Edit | 3.1 |
| `backend/tests/integration/test_bench_service_ttft_interleaved.py` | 신규 | 3.2 |

## 8. 벤치 JSON 로그 위치

| 파일 | 내용 |
|---|---|
| `logs/ttft-interleaved-before.log` | Phase 1+2 적용 전 interleaved 200 iter 전체 로그 |
| `logs/ttft-interleaved-after.log` | Phase 1+2 적용 후 interleaved 200 iter 전체 로그 |

## 9. 한 줄 결론

코드 경로 최적화 5건의 TTFT 기여는 OpenAI 첫 토큰 변동 폭 안에 묻혀 통계적으로 유의미하지 않았다. 0.85초 이하 달성을 위해서는 OpenAI 네트워크 RTT 최적화(Azure 한국 리전 등)가 필수적이며, 코드 micro-opt은 이번 라운드로 종결을 권고한다.
