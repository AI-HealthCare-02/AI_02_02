# Codex 전달 프롬프트 — TTFT 0.8초 목표 Pivot 방향 검토

아래 프롬프트를 Codex에 붙여넣어 주세요.

---

## 프롬프트 시작

```
# 다나아 TTFT 0.8초 목표 — 코드 최적화 한계 도달, 네트워크/인프라 Pivot 방향 검토 요청

## 배경

다나아(만성질환 건강관리 AI 웹서비스)의 `/chat/send` SSE 경로에서 TTFT(첫 토큰까지 시간)를 0.8초 이하로 낮추는 작업을 진행했다.

### 기술 스택
- 백엔드: FastAPI + Tortoise ORM + PostgreSQL + Redis
- LLM: OpenAI `gpt-4o-mini` (고정)
- 운영 조건: `CHAT_LANGGRAPH_MODE=shadow`, `SHADOW_SAMPLE_RATE=0.05`, `AUDIT_SAMPLE_RATE=0.0`
- 프론트: Next.js 14

### 공식 측정 가이드 기준
- 측정: interleaved 벤치 (off/shadow0/shadow5/shadow100 × 조건당 50회, OpenAI 시간대 편향 제거)
- 판정: shadow5 TTFT median 기준 (강한 성공 ≤0.80초 / 목표 ≤0.82초 / 1차 ≤0.85초)

### 이번 라운드에서 적용한 코드 최적화 5건
1. tiktoken encoding 모듈 레벨 캐시 (매 요청 재초기화 제거)
2. SSE `_sse_event` 에서 `json.dumps` → `orjson.dumps` 교체
3. OpenAI 공유 클라이언트 warmup에 `stream=True` 더미 추가 (스트리밍 경로 TLS/핸드쉐이크 캐시)
4. `ChatMessage.create(USER)` + `bundles_task` + `history_awaitable` 3작업 asyncio 병렬화
5. 토큰 추정(`estimate_message_tokens`)을 `yield done` 이후로 이동 + `CHAT_BENCH_BUDGET_ENABLED` gate (이미 이전 라운드 적용)

### 실측 결과 (interleaved, 조건당 n=49)

| 조건 | BEFORE TTFT median | AFTER TTFT median | Δ | 95% CI (AFTER) |
|---|---|---|---|---|
| off | 1.148초 | 1.107초 | −0.041초 | [1.071, 1.149] |
| shadow0 | 1.081초 | 1.094초 | +0.013초 | [1.002, 1.141] |
| **shadow5** | **1.096초** | **1.098초** | **+0.002초** | **[1.020, 1.145]** |
| shadow100 | 1.102초 | 1.139초 | +0.037초 | [1.074, 1.211] |

**핵심 관측:**
- shadow5 before/after 차이 +0.002초 → 95% CI 완전 겹침 → **통계적으로 유의미한 변화 없음**
- 코드 경로 최적화(예상 −65~120ms)의 기여가 OpenAI 첫 토큰 변동 폭(±300ms)에 완전히 묻힘
- shadow0~shadow100 간 차이 0.045초로 일정 → shadow adapter 자체 비용은 미미

### 결론
**코드 micro-opt으로는 0.85초 도달 불가능.** TTFT의 지배적 요인은 OpenAI API 네트워크 RTT + 서버 내부 스케줄링이다.

---

## 요청사항

위 맥락을 바탕으로 아래 4가지 방향에 대해 각각 분석해줘:

### 1. OpenAI API 네트워크 RTT 실측 및 최적화
- 한국 서버(Seoul region) → OpenAI API 서버(미국)까지 TCP connect + TLS handshake + first byte 시간을 어떻게 정확히 측정할 수 있는지
- 현재 `httpx.AsyncClient` 사용 중. connection pooling/keepalive 최적화 여지가 있는지
- 측정 명령 예시 (curl, httpx, 또는 Python 스크립트)

### 2. Azure OpenAI 한국 리전 전환 비용/효과 분석
- Azure OpenAI Service의 Korea Central 리전에서 `gpt-4o-mini` (또는 동급) 사용 가능 여부
- 전환 시 코드 변경 범위: `openai` 파이썬 SDK의 `base_url` 변경만으로 되는지, 아니면 인증/엔드포인트 구조가 다른지
- 예상 RTT 절감: 한국→미국(~150~250ms) vs 한국→한국(~10~30ms)
- 비용 차이: OpenAI 직접 vs Azure OpenAI (gpt-4o-mini 기준 input/output 토큰 단가)
- Azure 전환 시 주의할 점 (rate limit, API 버전, 모델 배포 방식 차이)

### 3. 출력 길이 최적화로 done 시간 단축
- 현재 `max_tokens=1024`, 실측 평균 응답 70~100 토큰
- `max_tokens` 줄이면 OpenAI 서버 측 최적화가 일어나는지 (prefill 단축, 스케줄링 우선)
- 프롬프트 간결화로 input token 줄이면 TTFT에 영향이 있는지 (현재 평균 ~394 토큰)
- 안전한 `max_tokens` 하한 (응답이 잘리지 않을 수준)

### 4. 대안 모델 검토 (장기)
- `gpt-4o-mini` 대비 TTFT가 빠른 OpenAI 모델이 있는지 (gpt-3.5-turbo, gpt-4o 등과의 TTFT 비교 데이터)
- 오픈소스 모델(Llama 3, Mistral 등) self-hosting 시 예상 TTFT (한국 리전 GPU 서버 기준)
- 각 대안의 한국어 품질 trade-off

### 출력 형식
각 방향에 대해:
- **실행 난이도** (쉬움/보통/어려움)
- **예상 TTFT 절감 폭** (ms 단위, 근거 포함)
- **비용 영향** (증가/감소/동일, 구체적 금액이면 더 좋음)
- **구현 시 주의사항**
- **우선순위 권고** (1~4위, 이유 포함)

마지막에 "다나아 프로젝트가 0.8초 목표를 달성하기 위한 최적 전략"을 한 문단으로 요약해줘.
```

## 프롬프트 끝

---

## 사용 안내

1. 위 프롬프트를 Codex(또는 ChatGPT/Claude 등 다른 AI)에 통째로 복사+붙여넣기
2. 응답에서 4방향 분석 + 우선순위 권고를 받음
3. 가장 유망한 방향(예: Azure Korea 리전)을 선택한 뒤 다나아 프로젝트에서 구체적 실행 플랜을 수립

## 추가 맥락 파일 (필요 시 같이 전달)

| 파일 | 내용 |
|---|---|
| `docs/setup/04-10 02-50 TTFT 공식 interleaved 실측 및 pivot 권고.md` | 이번 라운드 상세 결과 |
| `테스트 환경.txt` | 공식 측정 가이드 |
| `backend/services/chat/openai_client.py` | OpenAI 클라이언트 설정 (timeout, pool, warmup) |
| `backend/core/config.py` | 전체 설정값 (CHAT_OPENAI_STREAM_* 등) |
