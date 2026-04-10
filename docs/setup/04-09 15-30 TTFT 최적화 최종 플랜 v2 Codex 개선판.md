# 다나아 TTFT 최적화 최종 플랜 v2 (Codex 병합판 → 2차 검증 개선판)

> **출처 체인**
> - v0: Claude 1라운드 초안 (27개 병목, 5 Phase, Round 1~3 검증)
> - v1: Codex 병합판 (`다나아 TTFT 최적화 Claude 비동기 SSE 호환 최종PLAN.md`) — SSE/비동기 호환 관점으로 재정렬
> - **v2 (본 문서)**: v1을 2개 에이전트(구조 정합성 + Gap Analysis)로 교차 검증하여 내부 모순 3건 수정 + 안전한 고가치 항목 7개 편입 + 명시 강화



## Context — v2에서 무엇이 바뀌었나

### v1 (Codex 병합판) 대비 v2 변경점 한눈에

| 구분 | 변경 내용 | 근거 |
|---|---|---|
| 🔴 **내부 모순 수정 3건** | Stage 2에 `error` event 수신 경로 신규 추가 명시 / Gate 3 비교 baseline을 "Stage 0 off baseline"으로 못박음 / Frontend kill switch를 빌드타임 → 런타임 토글로 교체 | 구조 정합성 검토 결과 실행 불가 지점 3건 식별 |
| ➕ **반드시 추가 7건** | (1) 1-토큰 eager warmup (2) `max_retries=0` SDK+httpx 이중 명시 (3) SSE 프록시 헤더(`X-Accel-Buffering`) (4) Tortoise ORM pool 확대 (5) `paint_ttft_ms` 3축 완성 (6) `prep_breakdown` nested Sentry span (7) Baseline 프로토콜 구체화 | Gap Analysis에서 v1에 없지만 원칙(외부 의존성 無·계약 보존·prep-only) 훼손 없이 추가 가능하다고 판단 |
| 📌 **명시 강화 4건** | `_sha256_messages` hot path → background 이동 명시 / `_prompt_policy_instruction` import hoist 명시 / `HistoryTurnSnapshot` 공유 시 str() 캐스팅 동작 문서화 / Stage 1b "완전 분리 함수" 명시 | v1 Stage 3a "dict/hash 중복 제거"와 "import hoist"를 구현자가 절반만 적용할 리스크 |
| ✨ **Stage 3c 신설** | 조건부 고급 최적화 (uvloop, QueueHandler, Messages LRU stdlib) | v1에 없지만 Phase 0 측정 결과에 따라 조건부 적용 가능한 항목 별도 단계로 분리 |
| 🚫 **v1 원칙 유지 (변경 없음)** | shell 계약, SSE wire shape, branch precedence, crisis/block/consent 의미, prep-only LangGraph, partial 5% 끝점, 25% 이상 금지, `stream_options.include_usage` 제외, `history 10→6` 제외, prompt caching 제외, `flushSync`/`useSyncExternalStore` 제외 | v1의 보수적 판단 수용 |

### v2의 전제 (변경 없음, v1 계승)
- 최우선 목표: **TTFT 단축**
- 구현 수단: **현재 스택의 기존 라이브러리 내장 기능만** (외부 의존성 0, 모델 변경 0)
- 안전 계약: `validation → content_filter → crisis/block/consent early return → cooldown → session/user save → prep → stream → save → done` shell 유지
- LangGraph: prep-only, topology 변경 금지, node 내부 `gather` 금지 (Phase 0 근거 생기기 전까지)
- 성공 기준: **TTFT 개선 + 5% canary까지 무회귀 증명**

---

## Final Scope (v1 그대로 + v2 명시 항목)

### 이번 플랜에서 **구현한다**
- server-side TTFT 계측(3축: server/wire/**paint**)과 correlation id 추가
- shared `AsyncOpenAI` + shared `httpx.AsyncClient` 도입 + **1-토큰 warmup** + **max_retries=0 이중 명시**
- LangGraph `off` truly-off fast path (**ChatPrepInputs 생성 전 분리**)
- 프론트 SSE 수신 상태기계 정리 (+**`error` 이벤트 수신 경로 신규** + **런타임 토글 kill switch**)
- backend prep 경로의 비의미 변경 최적화 (**`_sha256_messages` background**, **지연 import hoist**)
- **Tortoise ORM pool 확대**
- **SSE 응답 헤더 `X-Accel-Buffering: no` / `Cache-Control: no-cache`**
- **`prep_breakdown` nested Sentry spans**
- rollout / kill-switch / gate 정리

### 이번 플랜에서 **절대 안 바꾼다**
- 모델, OpenAI API 종류, SSE wire shape, branch 우선순위, crisis/block/consent 의미, user/assistant 저장 의미, LangGraph graph 범위

### 이번 플랜에서 **명시적으로 제외한다** (v1 수용)
- Responses API 전환
- `aiohttp` backend 추가
- WebSocket / EventSource 재설계
- LangGraph conditional edge, topology v2, node 내부 `gather`
- `history 10 → 6` 축소 (단, Appendix에 조건부 축소 아이디어 기록)
- fire-and-forget USER save
- prompt caching 구조 개편
- `flushSync`, `useSyncExternalStore`, virtualization, markdown 실시간 렌더
- rollout 25% 이상
- `orjson` 도입 (원칙 위반 — 외부 의존성 0 유지)
- `cachetools` 도입 (Messages LRU 필요 시 stdlib `functools.lru_cache` + 수동 TTL)

---

## Implementation Changes

### Stage 0. Baseline · 계약 · 게이트 고정 (선행 필수, 1~2일)

#### 0.1 베이스라인 측정 프로토콜 (v2 구체화)
- 수행 환경: **staging**(prod 동일 Docker Compose, Linux 런타임), 로컬 개발 환경 측정 금지
- 측정 시간대: **평일 10:00–12:00 KST 고정** (OpenAI us-east 야간 여유 구간)
- 입력 셋: `scripts/ttft_benchmark_inputs.json` **20개 고정**
  - 구성: 짧은 질문 5 / 긴 질문 5 / 감정 우선 3 / 증상 질의 4 / crisis 인접 2 / block 인접 1
  - 팀 3인 각자 제안 후 교집합 선택, 해시 커밋(`git add -f` + commit sha)
- 샘플 분리: **Cold 100 + Warm 400 (= 500건/회)**
  - Cold: 각 요청 전 2분 idle (TLS/DNS 캐시 증발 확보)
  - Warm: 200ms 간격 연속 (keepalive pool 채워진 상태)
- 실행 스크립트: `scripts/bench_ttft_ab.py --cold 100 --warm 400 --interleave`
  - 인터리브 A/B (`baseline` vs `candidate` 교대 실행)로 OpenAI 서버 부하 변동 분리
  - 통계 검정: `scipy.stats.mannwhitneyu` + bootstrap 95% CI
- 결과 저장: `docs/benchmarks/baseline/YYYY-MM-DD.json`
  - 필드: p50/p95/p99, sample count, flags digest, git sha, model, region, env snapshot
- 수용 기준: run 간 p95 stddev < 10%, 아니면 재측정
- 동반 측정: `/v1/models` latency (region probe)
- **`off` 모드 baseline임을 명시**: 이후 모든 gate의 비교 기준
- 갱신 주기: 매 Stage 진입 전 + 주 1회 정기 (월요일 오전)

#### 0.2 100% 수집 Metric (server + client + v2 추가)

**Server-side** (v1 + v2 추가):
- `chat_request_total`
- `chat_terminal_total{outcome, first_token_emitted}`
- `chat_prep_ms`
- `chat_openai_first_content_ms`
- `chat_server_ttft_ms`
- `chat_stream_tail_ms`
- `chat_stream_error_total`
- `chat_openai_timeout_total`
- `chat_langgraph_fallback_total`
- **(v2 신규) `chat_prep_breakdown_ms` nested Sentry spans** — 6개 하위:
  - `validate_ms / filter_ms / bundles_ms / history_ms / prompt_build_ms / first_yield_ms`
  - `sentry_sdk.start_span(op="chat.validate")` 등 6개 nested span 추가
  - 외부 의존성 0 (Sentry SDK 이미 프로젝트에 있음)

**Client-side** (v1 + v2 추가):
- `chat_wire_ttft_ms`
- **(v2 신규) `chat_paint_ttft_ms`** — 첫 SSE chunk 수신 → DOM paint 완료
  - `performance.mark('ttft_wire')`, `performance.mark('ttft_paint')`, `performance.measure(...)`로 구현
  - React reconciliation 병목 관찰 유일 수단
- `chat_sse_parse_error_rate`
- `chat_client_abort_total`

#### 0.3 Correlation ID
- `chat_req_id` 하나로 고정
- `/chat/send` 응답 헤더에 `X-Chat-Request-ID` 추가
- Sentry scope에 tag로 부착
- raw message / raw prompt / raw context는 로그에 **절대 남기지 않는다**

#### 0.4 기준선 비교 Cohort (v1 유지)
- `model`
- `langgraph_mode`
- `prep_path`
- `had_rag`
- `had_user_context`

#### 0.5 (v2 신규) OpenAI Region Probe
- 목적: 한국 → us-east RTT 상시 포함 여부 확인 (**단일 최대 레버 가능성**)
- 방법: staging에서 `GET /v1/models` 5회, p50/p95 기록
- 판정: p50 > 150ms이면 **Stage 1a에 `AsyncOpenAI(base_url=...)` 1줄 추가 티켓 발행** (원칙 유지, 코드 1줄)
- 결과 문서: `docs/benchmarks/baseline/region-probe.md`

#### 0.6 (v2 신규) 재질문 패턴 분석
- 목적: Messages LRU 캐시(Stage 3c)의 기대 hit rate 측정
- 방법: 직전 7일 `ChatMessage` 로그에서 같은 `user_id`가 60초 내 유사 질문 반복 비율
- 판정: hit 예상 rate ≥ 40%이면 Stage 3c 진입 조건 충족
- 결과: `scripts/analyze_repeat_rate.py` 산출

---

### Stage 1a. Shared OpenAI Client Lifecycle 분리 (v2 확장)

#### 1a.1 Shared Client 도입 (v1)
- 파일: `backend/services/chat/openai_client.py` 신설
- shared `AsyncOpenAI` + shared `httpx.AsyncClient` 모듈 레벨 싱글톤
- FastAPI `lifespan` 에서 startup 생성, shutdown close
- `streaming` 경로만 이 shared client 사용
- 실패 시: per-request fallback **금지**, startup warning + stage 중단(= 이전 tag로 재배포)
- Kill switch 시나리오: `CHAT_OPENAI_SHARED_CLIENT_ENABLED=false`로 요청별 인스턴스 legacy path 복귀 (이 flag 기본값은 Stage 1a 완료 후 `true`, 이전엔 `false`)

#### 1a.2 (v2 신규) `max_retries=0` 이중 명시
- Codex v1의 `CHAT_OPENAI_STREAM_MAX_RETRIES=0` 환경변수를 **실제 SDK/httpx 파라미터로 강제 반영**
- 구현:
  ```python
  transport = httpx.AsyncHTTPTransport(retries=0)
  http_client = httpx.AsyncClient(
      transport=transport,
      limits=httpx.Limits(max_connections=20, max_keepalive_connections=10, keepalive_expiry=120),
      timeout=httpx.Timeout(connect=3.0, pool=2.0, read=None, write=5.0),
  )
  client = AsyncOpenAI(api_key=..., max_retries=0, http_client=http_client)
  ```
- 근거: OpenAI SDK default `max_retries=2` + httpx transport 독립 retry 가능성 → 이중 재시도 차단
- 이득: tail latency 40~120ms

#### 1a.3 (v2 신규) 1-토큰 Eager Warmup
- 목적: shared client 도입 후 첫 요청의 TLS/DNS/OpenAI 라우팅 캐시 warming
- 위치: FastAPI `lifespan` startup, shared client 생성 직후
- 구현:
  ```python
  try:
      await asyncio.wait_for(
          client.chat.completions.create(
              model=OPENAI_MODEL,
              messages=[{"role": "user", "content": "."}],
              max_tokens=1,
              stream=False,
              user="warmup",
          ),
          timeout=5.0,
      )
  except Exception as exc:
      logger.warning("chat_openai_warmup_failed", exc_info=True)
      # 실패해도 startup 중단하지 않음 (warmup 실패는 1a.1 "stage 중단"과 구분)
  ```
- 리스크: 0 (실패 시 경고만, client.close() 유발 없음, 원칙 위반 없음)
- 이득: Cold TTFT 150~300ms

#### 1a.4 (v2 신규) SSE 프록시 헤더 추가
- 파일: `backend/apis/v1/chat_routers.py`
- StreamingResponse에 추가:
  ```python
  headers={
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
  }
  media_type="text/event-stream; charset=utf-8"
  ```
- 근거: nginx/Docker 프록시 경유 시 첫 토큰 버퍼링 방지
- 리스크: 0 (SSE wire shape 변경 아님, 메타데이터만)
- 이득: 프록시 환경에서 결정적, 아니면 0

#### 1a.5 (v2 신규) Tortoise ORM Pool 확대
- 파일: `.env` 또는 `backend/db/databases.py`
- 변경: `minsize=5, maxsize=20`
- 근거: 기본 pool 작아 동시 요청 시 pool wait → prep 경로 지연
- 이득: warm p95 20~80ms (부하 상황)
- 리스크: 0 (DB 계약 무관)

#### 1a.6 (조건부) OpenAI `base_url` 명시
- **Stage 0.5 region probe 결과 p50 > 150ms일 때만 적용**
- `AsyncOpenAI(base_url="https://<closer-region>.api.openai.com/v1")` 또는 OpenAI가 제공하는 region routing param
- 이득: 100~180ms (cold/warm 모두)

#### 1a.7 테스트 (merge gate)
- shared client lifecycle 테스트
- startup/shutdown 중 in-flight stream 안전성
- warmup 실패 시 startup 계속 (별도 시나리오)
- pool 확대 후 회귀 없음 확인

---

### Stage 1b. LangGraph `off` Truly-off Fast Path (v2 구현 위치 명시)

#### 1b.1 목표 (v1)
- `mode=off`, `force_fallback=true`, `graph ineligible`인 경우 입력 snapshot / parity 준비 / hash 계산 **전에** 즉시 legacy prep로 분기
- `off`에서 graph state build / shadow audit / parity hash **0건** 보장

#### 1b.2 (v2 구현 위치 명시)
- 현재 `adapter.py:354-373` `prepare_openai_messages`는 mode 분기 **이전에** `_build_inputs`를 호출하고, 그 안에서 `_history_snapshots` + `_profile_context_snapshot`이 이미 실행된다 → **매 요청마다 dead work 발생**
- v2 수정: **`prepare_openai_messages` 최상단에서 mode + force_fallback 먼저 체크**
- off path는 **`ChatPrepInputs` 자체를 만들지 않는 완전 분리 함수** (`_run_legacy_prep_off_path`) 를 신설해 호출
- off path는 기존 legacy helper (`build_openai_messages_legacy`)를 **직접 호출**
- Progression gate `1b→2` 테스트: "`off` 모드에서 graph 입력 생성 횟수 == 0" 단위 테스트 추가

#### 1b.3 유지되는 것 (v1)
- `shadow`, `partial`, bucket semantics, `mode_selected` 로그 의미는 그대로

---

### Stage 2. Frontend SSE Correctness/Compat 선행 (v2 error event 신규 + runtime kill switch)

#### 2.1 상태기계 고정 (v1)
- `idle → streaming → completed | failed | aborted`
- terminal event 이후 추가 이벤트는 무시
- `token`만 assistant draft 증가
- `done`은 content 생성 금지, 완료만 확정

#### 2.2 Error / Abort 처리 규칙 (v1)
- `error`:
  - token 없으면 placeholder를 에러 메시지로 교체
  - token 일부 있으면 partial content 유지 + `failed/incomplete` 상태
- `abort`:
  - token 없으면 draft 제거
  - token 있으면 partial content 유지 + `aborted` 상태

#### 2.3 (v2 신규) `error` 이벤트 수신 경로 신규 추가
- 현재 `page.js:127-155`는 `parseSSE` 후 `done`만 분기, **`error` event 수신 분기 없음**
- Stage 2는 "정리"가 아니라 **신규 분기 추가**로 재정의
- pre-step: `grep -n "last.streaming\|last.isError\|streaming:" frontend/app/app/chat/page.js` 로 영향 범위 확인
- 백엔드가 실제로 `error` event를 emit하는지 Stage 0에서 사전 확인

#### 2.4 Parser 증분화 (v1)
- 전체 버퍼 재파싱 금지 → `indexOf('\n\n')` 기반 incremental 파서로 교체
- 같은 chunk 안의 `token → done`은 순서대로 처리, `token` 렌더가 `done` 확정보다 먼저
- 토큰당 전체 `messages` 배열 재생성 금지, 마지막 assistant draft 전용 상태로만 갱신
- streaming 중 `smooth` auto-scroll 금지, 바닥 근처일 때만 조건부 follow

#### 2.5 (v2 수정) Kill Switch 런타임 토글 가능 형태로 교체
- v1의 `NEXT_PUBLIC_CHAT_SSE_RECEIVER_V2_ENABLED`는 **빌드 타임 상수**라 재빌드 없이는 토글 불가 → 진짜 kill switch 아님
- v2: 다음 중 택 1
  - (A) 서버 `/api/v1/config` 엔드포인트에서 `chat_sse_receiver_version` 반환 → 페이지 로드 시 fetch, 런타임 분기
  - (B) 두 파서(v1/v2)를 빌드에 함께 포함하고 URL query param(`?sse_v=1`) 또는 쿠키로 토글
- (A) 권장: 서버 측 제어로 즉시 kill 가능
- 플래그 이름: `CHAT_FRONTEND_SSE_RECEIVER_VERSION` (server-side, `config.py`에 추가)

#### 2.6 (v2 신규) Paint TTFT 측정 훅
- 첫 SSE chunk 수신 즉시 `performance.mark('ttft_paint_start')`
- 해당 chunk가 DOM에 렌더된 직후 (`requestAnimationFrame` callback) `performance.mark('ttft_paint_end')`
- `performance.measure('paint_ttft_ms', ...)` 로 값 산출
- `/api/v1/metrics/client` POST (또는 Sentry breadcrumb) 로 전송

#### 2.7 (v2 pre-step) 영향 범위 grep
- `page.js`의 `streaming` / `isError` 필드 참조 지점 확인 → 상태기계 도입 시 변경 범위 예측
- `messages.map(...)` 의 last-element 의존 지점 점검

---

### Stage 3a. Safe Backend Prep Trims (v2 명시 강화, 비의미 변경만)

#### 3a.1 허용 (v1 + v2 명시)
- side-effect 없는 **import hoist**
  - **(v2 명시)** `prompting.py::_prompt_policy_instruction` 의 `from backend.services.content_filter_patterns import WARN_PROMPT_INSTRUCTION` 최상단 이동 (warm 1~5ms, cold 30ms)
  - 이동 전 순환 import 여부 확인 필수
- history 조회 경량화
  - `ChatMessage.filter(...).values("role", "content")` 로 dict list 반환 (ORM hydration 비용 제거)
  - DB 조회 직후 `HistoryTurnSnapshot` 내부 정규 타입으로 한 번만 변환
  - legacy prep과 graph prep 둘 다 해당 타입을 공유
- 불필요한 dict/hash 중복 계산 제거
  - **(v2 명시)** `chat_graph/adapter.py::_sha256_messages` 를 **hot path에서 제거하고 background audit 경로로만 이동**
  - `_sha256_text(final_system_prompt)`만 hot path에 유지 (parity critical)
  - 이득: 3~10ms

#### 3a.2 금지 (v1 유지)
- history window 축소
- prompt ordering 변경
- branch semantics 관련 I/O 순서 변경
- parity / debug payload slimming

#### 3a.3 (v2 리스크 완화) HistoryTurnSnapshot 공유 사전 검증
- 현재 legacy prep이 ORM row의 `message.role`, `message.content`를 직접 참조하는지 vs `HistoryTurnSnapshot` 경유인지 확인
- `message.content`가 None/whitespace/enum인 경우의 `str()` 캐스팅 동작을 legacy/graph 양쪽에서 **동일하게 처리**하는지 단위 테스트로 잠금
- `_build_openai_messages_from_base_prompt`가 기대하는 입력 타입을 **Stage 3a 진입 직전에 문서화**
- Progression gate `3a→3b`: "prompt layer hash / role sequence / parity **unchanged**" 테스트 통과 필수

---

### Stage 3b. Explicit Timeout/Retry Tuning + Idle Watchdog (v2 idle watchdog 추가)

#### 3b.1 Timeout / Retry (v1)
- `CHAT_OPENAI_SHARED_CLIENT_ENABLED=true`
- `CHAT_OPENAI_STREAM_MAX_RETRIES=0`
- `CHAT_OPENAI_STREAM_CONNECT_TIMEOUT_MS=3000`
- `CHAT_OPENAI_STREAM_POOL_TIMEOUT_MS=2000`
- `CHAT_OPENAI_STREAM_READ_TIMEOUT_MS`: **설정하지 않음** (mid-stream regression 방지)
- `CHAT_OPENAI_STREAM_MAX_CONNECTIONS=20`
- `CHAT_OPENAI_STREAM_MAX_KEEPALIVE_CONNECTIONS=10`

#### 3b.2 (v2 신규) Idle Watchdog — Read Timeout의 대안
- 목적: `READ_TIMEOUT` 미설정으로 생길 수 있는 **서버 측 태스크 leak** 방지
- 구현: `asyncio.wait_for` 기반
  - **Total stream deadline**: 90초 (대화 상한)
  - **Inter-token stall timeout**: 첫 토큰 수신 후 15초 동안 토큰 없으면 abort
- 구현 위치: `backend/services/chat/streaming.py::_stream_openai`
  ```python
  async def _stream_openai_with_watchdog(messages):
      stream_iter = client.chat.completions.create(...)
      first_token_received = False
      async def guarded():
          nonlocal first_token_received
          async for chunk in stream_iter:
              if not first_token_received:
                  first_token_received = True
              yield chunk
      # total deadline
      deadline_task = asyncio.wait_for(collect_all(guarded()), timeout=90)
      # inter-token stall (별도 task로 감시)
  ```
- 에러 emit: `error` event with `code="stream_stall"` or `code="stream_deadline"`

#### 3b.3 `stream=True` 유지
- `chat.completions.create(stream=True)` 그대로
- `stream_options.include_usage` 제외 (TTFT core 아님, 별도 관측 트랙)

#### 3b.4 (v2 선택적) `parallel_tool_calls=False` + `user=` 파라미터
- `chat.completions.create(..., parallel_tool_calls=False, user=f"u_{sha256(str(user_id))[:16]}")`
- 이득: 3~8ms (parallel_tool_calls 기본값 resolution 1단계 생략) + OpenAI 내부 bucket affinity (비공식)
- 리스크: 0

---

### Stage 3c. 조건부 고급 최적화 (v2 신설, Phase 0 측정 결과 기반)

**진입 조건**: Stage 0 측정 결과 + Stage 1~3b 완료 + Gate 3 통과 후에만 진행

#### 3c.1 uvicorn Runtime Tuning (조건: Linux 배포 확정)
- 파일: `docker-compose.yml` 또는 `backend/Dockerfile`의 CMD
- 변경: `uvicorn backend.main:app --loop uvloop --http httptools --no-access-log --backlog 2048`
- 이득: warm 5~25ms (uvloop await 오버헤드 감소)
- 리스크: Windows dev 로컬과 런타임 환경 차이 → staging 부하 테스트 필수

#### 3c.2 QueueHandler 로깅 전환 (조건: Phase 0 jitter 측정에서 prep_ms와 span 합 불일치 5ms+)
- 파일: `backend/core/logger.py`
- 현재: `logging.StreamHandler(sys.stdout)` 단일 sync handler
- 변경: `logging.handlers.QueueHandler` + `QueueListener` 패턴 (stdlib, 외부 의존성 0)
- 이득: 5~30ms (편차 큼)

#### 3c.3 Messages LRU 캐시 (조건: Stage 0.6 재질문 hit rate ≥ 40%)
- 목적: 같은 user_id가 짧은 간격에 유사 질문 반복 시 messages 재조립 생략
- 구현: **stdlib `functools.lru_cache` + 수동 TTL** (외부 의존성 0)
  ```python
  from functools import lru_cache
  import time

  _CACHE_TTL = 45  # seconds

  def _cache_key(user_id, history_tail_sha, current_msg_sha, filter_verdict):
      return (user_id, history_tail_sha, current_msg_sha, filter_verdict)

  class TTLCache:
      def __init__(self, maxsize=256, ttl=45):
          self._maxsize = maxsize
          self._ttl = ttl
          self._store = {}  # key -> (value, expire_at)

      def get(self, key):
          entry = self._store.get(key)
          if entry and entry[1] > time.monotonic():
              return entry[0]
          return None

      def set(self, key, value):
          if len(self._store) >= self._maxsize:
              # evict oldest by expire_at
              oldest = min(self._store.items(), key=lambda x: x[1][1])
              del self._store[oldest[0]]
          self._store[key] = (value, time.monotonic() + self._ttl)
  ```
- 캐시 키: `sha256(system_hash || last_2_history_sha || current_msg_normalized || filter_verdict)`
- shadow 모드와 상호작용: 캐시 hit 시에도 parity 기록은 원본 입력 기준 (자기참조 방지)
- 이득: hit 시 100~300ms warm, miss 시 0ms
- 플래그: `CHAT_MESSAGES_CACHE_ENABLED`

#### 3c.4 Graceful Degradation
- LRU 캐시 메모리 초과 방어: `psutil` RSS > 80% (이미 프로젝트에 psutil 없으면 스킵) → 자동 `cache_enabled=False` + 알람

---

### Stage 4. Rollout Activation (v2 gate 기준 명확화)

#### 4.1 LangGraph Rollout 플래그 (v1 유지)
- `CHAT_LANGGRAPH_MODE=off|shadow|partial`
- `CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE`
- `CHAT_LANGGRAPH_PARTIAL_PERCENT`
- `CHAT_LANGGRAPH_PREP_TIMEOUT_MS`
- `CHAT_LANGGRAPH_FORCE_FALLBACK`

#### 4.2 Backend TTFT 플래그 (v1 + v2, LangGraph와 분리)
- `CHAT_OPENAI_SHARED_CLIENT_ENABLED` (Stage 1a)
- `CHAT_OPENAI_STREAM_MAX_RETRIES=0`
- `CHAT_OPENAI_STREAM_CONNECT_TIMEOUT_MS=3000`
- `CHAT_OPENAI_STREAM_POOL_TIMEOUT_MS=2000`
- `CHAT_OPENAI_STREAM_MAX_CONNECTIONS=20`
- `CHAT_OPENAI_STREAM_MAX_KEEPALIVE_CONNECTIONS=10`
- `CHAT_OPENAI_IDLE_WATCHDOG_ENABLED` (Stage 3b.2)
- `CHAT_MESSAGES_CACHE_ENABLED` (Stage 3c.3 조건부)

#### 4.3 Frontend TTFT 플래그 (v2 runtime toggle)
- `CHAT_FRONTEND_SSE_RECEIVER_VERSION=v1|v2` (server-side config, runtime toggleable)

#### 4.4 Shadow 정책 (v1 + v2 구체화)
- Shadow는 반드시 **bounded / non-blocking**
- Unbounded `create_task` **금지**
- **(v2 구현)** `adapter.py::_schedule_background_audit`를 다음 중 하나로 교체:
  - (A) `asyncio.Semaphore(N)` 로 동시 audit 제한
  - (B) bounded `asyncio.Queue(maxsize=100)` + worker consumer, `put_nowait` → `QueueFull` → drop + counter
- (B) 권장: 명시적 drop 정책
- Overload 시 audit drop, live path는 **절대 기다리지 않는다**

#### 4.5 Partial 정책 (v1 유지)
- Partial은 반드시 sticky bucket (`user_id` 키)
- Partial fallback은 **first token 이전에만** 허용, mid-stream fallback 금지

---

### Stage 5. Post-rollout 후순위 (v1 유지)
- parity / debug payload slimming
- sampled hash payload 축소
- 운영 대시보드 정리
- 본선 merge 기준에 포함하지 않음

---

## Test Plan And Gates (v2 수정)

### Merge Gate (v1 + v2)
- `docs/setup/04-07 15-04 PR 리뷰 게이트.md` 템플릿 적용
- 기존 green 유지:
  - branch / SSE / unit / integration 기존 테스트 전체
  - LangGraph parity / mode / logging 기존 테스트 전체
- 신규 필수 테스트:
  - shared client lifecycle
  - startup / shutdown 중 in-flight stream 안전성
  - (v2) warmup 실패 시 startup 계속 시나리오
  - `off` fast path에서 `ChatPrepInputs` 생성 0건 (**v2 강화**)
  - frontend 증분 parser fuzz
  - `token + done same chunk`, `token + error same chunk`, split event across chunks
  - (v2) SSE `error` event 수신 분기 UI state
  - `error`, `abort`, partial+error, partial+abort UI state
  - timeout / graph exception 시 same-request legacy fallback
  - **(v2)** shadow audit bounded / drop 정책 테스트 (Semaphore 또는 Queue overflow)
  - **(v2)** idle watchdog (total deadline + inter-token stall)
  - **(v2)** `_sha256_messages` hot path 미실행 확인
  - **(v2)** `HistoryTurnSnapshot` role/content str 캐스팅 parity
  - **(v2)** SSE 응답 헤더 `X-Accel-Buffering: no` 포함 확인
- Merge Blocker:
  - branch precedence 변경
  - SSE `token/error/done` shape 변경
  - `done` payload shape 변경
  - user/assistant save semantics 변경
  - graph topology 변경
  - history window 축소가 같이 들어오는 것

### Progression Gate
- **Stage 1a → 1b**: shared client concurrent stream smoke green / shutdown race 없음 / warmup 실패 시 동작 확인
- **Stage 1b → 2**: `off` 모드에서 `ChatPrepInputs` 생성 0건 (단위 테스트)
- **Stage 2 → 3a**: frontend explicit `error/done/abort` 처리 + chunk-boundary fuzz green + **`chat_paint_ttft_ms` 수집 coverage ≥ 50%**
- **Stage 3a → 3b**: prompt hash / role sequence / parity **unchanged** / `_sha256_messages` background 이동 확인
- **Stage 3b → 4**: connect timeout / timeout fallback 테스트 green / `chat_server_ttft_ms` 재측정 완료 / idle watchdog 동작 / zero-token terminal 증가 없음
  - **(v2 명확화)** 재측정 baseline은 "Stage 0 off baseline"이 아니라 "Stage 1a~3b 적용 후의 관측치". Gate 3(partial 1%)의 `baseline * 0.95` 비교 기준은 **Stage 0 off baseline** (shared client/timeout 미적용 상태) 임을 못박는다.

### Rollout Gate (v1 + v2 parity 계층화)
- `docs/setup/04-09 10-50 LangGraph 릴리즈 게이트 템플릿.md` 적용
- **Gate 0**: `off` baseline 확보
  - **(v2 완화)** 24h OR normal-flow 1,000건 OR **합성 부하 500건 (cold 100 + warm 400)**
  - 학생/소규모 프로젝트 현실 고려
- **Gate 1**: `shadow 1%` sticky 24h
  - **(v2 parity 계층화)** parity mismatch:
    - **Critical fields** (role_sequence, final_system_prompt_sha, openai_message_count): **0건**
    - **Soft fields** (rag_hit_count, user_context_has_context 등): **< 0.1%**
  - legacy TTFT p95 drift `≤ 3%`
  - graph exception `< 0.1%`
- **Gate 2**: `shadow 5%` sticky 24h
  - backlog 없음
  - audit drop rate `< 1%`
  - event-loop contention 없음
  - `shadow 10%`는 표본 부족 시에만 선택적 허용
- **Gate 3**: `partial 1%` sticky 24h
  - **`chat_server_ttft_ms p95 ≤ Stage0_baseline × 0.95`** (**v2 명시**: Stage 0 off baseline 기준)
  - `chat_server_ttft_ms p99 ≤ Stage0_baseline × 1.00`
  - `chat_stream_tail_ms p95 ≤ Stage0_baseline × 1.05`
  - `stream_error_rate ≤ Stage0_baseline + 0.10%p`
  - `openai_timeout_rate ≤ Stage0_baseline + 0.05%p`
  - `zero-token terminal rate ≤ Stage0_baseline + 0.05%p` and absolute cap `0.20%`
  - `langgraph_fallback_rate ≤ 0.50%`
- **Gate 4**: `partial 5%` sticky 48h (**이번 플랜의 기본 종료점**)
- **Gate 5**: `partial 10%` (기본 skip, 5% 72h 무사고 + 별도 승인)
- **25% 이상 금지**

### Client Metric Rule (v1 + v2 추가)
- `chat_wire_ttft_ms`: coverage `≥ 80%` AND matched sample `≥ 200`일 때만 gate
- **(v2)** `chat_paint_ttft_ms`: 같은 규칙 적용
- client gate 사용 시:
  - `chat_wire_ttft_ms p95 ≤ Stage0_baseline × 0.97`
  - `chat_paint_ttft_ms p95 ≤ Stage0_baseline × 1.00` (paint는 TTFT 단축 목표 아님, 회귀 방지)

---

## Kill Switch (v1 + v2 수정)

### LangGraph Rollout Kill Switch (v1)
- `CHAT_LANGGRAPH_FORCE_FALLBACK=true`
- 필요 시 `CHAT_LANGGRAPH_MODE=off`
- 발동 조건: SSE contract mismatch / `done` payload mismatch / audited prompt parity mismatch (critical field) / graph exception burst

### Partial Stop Switch (v1)
- `CHAT_LANGGRAPH_PARTIAL_PERCENT=0`
- 발동: fallback rate 초과, TTFT regression 초과

### Shadow Stop Switch (v1)
- `CHAT_LANGGRAPH_SHADOW_SAMPLE_RATE=0`
- 발동: audit backlog, event-loop contention, shadow가 baseline을 흔듦

### Frontend Kill Switch (v2 수정 — runtime toggle)
- ~~`NEXT_PUBLIC_CHAT_SSE_RECEIVER_V2_ENABLED`~~ (빌드 타임, 토글 불가)
- **v2**: `CHAT_FRONTEND_SSE_RECEIVER_VERSION=v1|v2` (server-side config)
  - `/api/v1/config` 엔드포인트에서 반환
  - 페이지 로드 시 fetch 후 런타임 분기
  - 배포 없이 즉시 v1 복귀 가능

### Backend TTFT Feature Flags (v1 분리 원칙 유지)
- shared client, timeout/retry, idle watchdog, LRU cache는 LangGraph rollout과 **분리**
- 하나의 거친 `CHAT_TTFT_KILL_SWITCH`로 묶지 않는다 (축별 실패 모드가 다름)
- 각 플래그 독립 on/off
- 플래그 조합 실제 운영 경로는 5~6개로 수렴 (2^N 폭발 아님)

### Graceful Degradation (v2 신규)
- OpenAI API 실패율 5분 창 > 30% → circuit breaker open 60s → half-open 10%
- LRU 캐시 메모리 초과 → 자동 off + 알람

---

## Assumptions (v1 + v2)
- 외부 API 계약 유지. `/chat/send` SSE event shape 불변.
- 이 플랜은 **TTFT core 최적화**. FCP / paint optimization / 폰트 / 렌더 장식은 별도 트랙.
- LangGraph는 prep-only. graph 내부 병렬화는 profiling 근거 생기기 전까지 금지.
- 성공 기준: 그래프를 더 많이 켜는 것이 아니라 **TTFT 단축 + 5% canary까지 무회귀 증명**.
- **(v2)** staging 환경은 prod와 동일 Docker Compose, Linux 런타임. 로컬 dev는 측정·검증 제외.
- **(v2)** Sentry SDK가 이미 설치돼 있어 nested span 측정은 외부 의존성 0.
- **(v2)** 의존성 추가는 `orjson`/`cachetools` 모두 거부. 모든 최적화는 stdlib + 기존 패키지 내장 기능만.

---

## Appendix A. v2에서 별도 트랙으로 분리한 것
- **Frontend FCP / paint / 폰트 최적화**: TTFT 지표와 분리. 별도 "체감 품질" 트랙.
- **history 10→6 조건부 축소 (crisis 키워드 시 10 유지)**: 의미론적 리스크 낮으나 v1 원칙 존중해 제외. 향후 후속 PR로 분리 가능.
- **컴포넌트 분할 (935줄 page.js)**: 별도 프런트 아키텍처 리팩토링 티켓.
- **prompt caching 구조화**: HIGH 리스크, A/B 복잡도. 장기 트랙.
- **OpenAI Responses API 전환**: 범위 외.
- **`stream_options.include_usage`**: 비용/토큰 분석 별도 트랙.

---

## Appendix B. v2 추가 항목의 원칙 준수 체크

| v2 추가 항목 | 외부 의존성 추가 | 계약 변경 | 원칙 준수 |
|---|---|---|---|
| 1-토큰 warmup | 0 | 없음 | ✅ |
| max_retries=0 이중 명시 | 0 | 없음 | ✅ |
| SSE 프록시 헤더 | 0 | 응답 메타데이터만 | ✅ |
| ORM pool 확대 | 0 | DB 계약 무관 | ✅ |
| `paint_ttft_ms` | 0 (performance API) | 없음 | ✅ |
| `prep_breakdown` span | 0 (Sentry SDK 기존) | 없음 | ✅ |
| Baseline 프로토콜 | 0 (scipy는 dev only) | 없음 | ✅ |
| `_sha256_messages` background | 0 | parity 해시 불변 | ✅ |
| 지연 import hoist | 0 | 없음 | ✅ |
| Idle watchdog | 0 (asyncio stdlib) | SSE error event 추가 | ⚠️ (`error` code 신규) |
| uvloop (Stage 3c) | 0 (uvloop는 배포 이미지에 이미 가능) | 없음 | ✅ |
| QueueHandler (Stage 3c) | 0 (stdlib) | 없음 | ✅ |
| LRU stdlib (Stage 3c) | 0 (functools) | 없음 | ✅ |
| frontend runtime kill switch | 0 | 없음 | ✅ |

**Idle watchdog의 `error` code 신규** — 이것만 SSE wire에 `code="stream_stall"` / `code="stream_deadline"`를 추가하므로 엄격히는 계약 확장. Merge gate의 "SSE `token/error/done` shape 변경" 항목과 충돌 여부 확인 필요. v2 판정: **`error` event의 **값** 확장은 shape 변경이 아니므로 허용**. 기존 `error` event에 새 `code` enum 값 추가만 있을 뿐, event type 자체는 불변.

---

## Appendix C. 실행 순서 요약 (2주 축소판)

### Week 1
| Day | 작업 | Gate |
|---|---|---|
| D1 (월) | Stage 0.1~0.4 baseline 인프라 + 0.5 region probe + 0.6 재질문 분석 | 측정 기반 |
| D2 (화) | Stage 0 baseline 500샘플 (cold 100 + warm 400) | Gate 0 |
| D3 (수) | Stage 1a shared client + warmup + SSE 헤더 + pool 확대 (+조건부 base_url) | 1a 테스트 green |
| D4 (목) | Stage 1b off fast path | 1b→2 gate |
| D5 (금) | Stage 2 frontend parser + error event + paint 측정 + runtime kill switch | 2→3a gate |

### Week 2
| Day | 작업 | Gate |
|---|---|---|
| D6 (월) | Stage 3a import hoist + sha256 background + history dict 전환 | 3a→3b gate (parity unchanged) |
| D7 (화) | Stage 3b timeout tuning + idle watchdog + parallel_tool_calls | 3b→4 gate |
| D8 (수) | Stage 4 shadow 1% 활성 (bounded audit) | Gate 1 |
| D9 (목) | shadow 5% → partial 1% | Gate 2, Gate 3 |
| D10 (금) | partial 5% → 멘토 회의 최종 데모 | Gate 4 (끝점) |

Stage 3c (uvloop, QueueHandler, LRU)는 시간 남으면 추가 트랙.

---

## 예상 누적 TTFT 단축 (v2 재추정)

| 구간 | Cold | Warm | 주요 기여 |
|---|---|---|---|
| Stage 0 | 0 | 0 | 측정 인프라만 |
| Stage 1a | 180~480ms | 50~150ms | shared client + warmup + retries=0 + pool + 조건부 region |
| Stage 1b | 10~30ms | 10~30ms | off fast path dead work 제거 |
| Stage 2 | 체감만 | 지터 제거 | parser + error event + paint 측정 |
| Stage 3a | 10~25ms | 10~25ms | import hoist + sha256 background + history dict |
| Stage 3b | 0 (tail 개선) | 0 (tail 개선) | timeout + idle watchdog (TTFT 직접 아님) |
| Stage 3c (조건부) | 50~150ms | 50~150ms | uvloop + QueueHandler + LRU hit |
| **누적 (3c 제외)** | **200~535ms** | **70~205ms** | 보수적 추정 |
| **누적 (3c 포함)** | **250~685ms** | **120~355ms** | 낙관적 추정 |

> 실측 없이 믿지 않는다. Stage 0 baseline 필수.

---

## 한 줄 결론

> **v2는 Codex v1의 "SSE/비동기 호환 중심 안전성"을 그대로 계승하면서, 구조적 실행 불가 지점 3건을 수정하고 안전한 고가치 항목 7건을 편입한 최종 실행판이다. `orjson`/`cachetools` 같은 원칙 위반 항목은 배제했고, 모든 추가는 stdlib + 기존 패키지 내장 기능만 사용한다. 성공 기준은 변함없이 "TTFT 단축 + 5% canary까지 무회귀 증명"이다.**

---

**플랜 파일 체인**:
- Claude v0 (초안): `docs/setup/04-09 15-00 LLM TTFT 최적화 종합 플랜.md`
- Codex v1 (병합): `c:/Users/mal03/Downloads/다나아 TTFT 최적화 Claude 비동기 SSE 호환 최종PLAN.md`
- **v2 (본 문서)**: `docs/setup/04-09 15-30 TTFT 최적화 최종 플랜 v2 Codex 개선판.md`

**승인 후 다음 단계**: Stage 0 착수 → D1 region probe + baseline 인프라 작성
