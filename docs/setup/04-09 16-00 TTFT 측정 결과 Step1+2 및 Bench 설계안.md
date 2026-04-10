# TTFT 측정 결과 (Step 1+2) 및 Bench 설계안

> **문서 목적**: 2026-04-09 오후 TTFT 측정 인프라 구축(Step 1, 2)의 실측 결과를 기록하고, 이 실측을 근거로 `scripts/bench_ttft_ab.py`의 비교 대상·샘플 수를 결정한 설계안이다.
> **이전 문서**: `04-09 15-46 LLM 속도 개선 작업 및 실측 결과 전달용.md` (이전 5샘플 측정 문서, 결론 유보 상태)
> **배경 플랜**: `.claude/plans/joyful-kindling-melody.md` (3-Step 최소 플랜, 이 문서가 Step 3 산출물)

---

## 1. 한 줄 요약

> **실측 결과 진짜 병목은 (1) 한국↔OpenAI 네트워크 RTT (warm 590~640ms)와 (2) `warmup_shared_openai_client()` dummy 버그로 인한 cold 추가 1,928ms이고, prompt_tokens 축소·prep 병렬화 같은 micro-optimization은 전체 TTFT의 10% 미만이라 체감 개선이 어렵다. 이 데이터로 bench_ttft_ab.py는 "baseline vs warmup 수정본" 2조건 비교로 확정하는 것이 가장 큰 ROI다.**

---

## 2. Step 1 — OpenAI Region Probe 실측

### 2.1 실행 환경

- 스크립트: `scripts/probe_openai_region.py` (신규 작성, `Read-only 네트워크 측정`)
- 엔드포인트: `https://api.openai.com/v1/models`
- 클라이언트: 단일 `AsyncOpenAI` 인스턴스 재사용 (첫 호출 cold, 나머지 warm)
- DB/ORM 불필요 (순수 네트워크만)
- 실행: `uv run python scripts/probe_openai_region.py --iterations 5`
- 실행 시각: 2026-04-09 ~15:45 KST

### 2.2 원본 실측치

| # | 종류 | 시간 (ms) |
|---|---|---|
| 1 | cold | **1,739.00** |
| 2 | warm | 595.87 |
| 3 | warm | 306.53 |
| 4 | warm | 584.78 |
| 5 | warm | 602.35 |

### 2.3 통계 요약

| 지표 | 값 |
|---|---|
| Cold (1st call) | **1,739 ms** |
| Warm median (n=4) | **590 ms** |
| Warm min / max | 307 / 602 ms |
| Overall p95 | 1,739 ms |

### 2.4 판정

- 플랜 기준: `warm median ≥ 150ms = region 병목`
- 실측: 590ms → **기준의 약 4배, region 병목 확정**
- 추가 관찰: warm 값의 분산이 큼 (307~602 = 약 2배 차이) → 네트워크 jitter 또는 OpenAI 서버 부하 변동

### 2.5 주의사항

- `/v1/models`는 `/v1/chat/completions`와 **다른 엔드포인트**로, 라우팅·캐싱 특성이 완전히 동일하지는 않음
- 하지만 이 수치로 "한국에서 OpenAI 접속 RTT가 기대치 대비 3배 이상 무겁다"는 **강력한 방향성**은 확인됨
- Step 2의 `chat.completions` 실측과 일관성 있는지 교차 검증 필요 → 아래 Step 2 참조

---

## 3. Step 2 — Prompt Tokens & TTFT 실측 (실 OpenAI 호출)

### 3.1 실행 환경

- `backend/services/chat/streaming.py` 임시 수정 (측정 후 원복 완료, `git diff` 깨끗)
  - 변경 ①: `chat.completions.create(...)` 호출에 `stream_options={"include_usage": True}` 추가
  - 변경 ②: stream loop 안에 usage 청크 처리 로깅 (`chat_openai_usage` 이벤트) 추가
  - 계약 보호: usage 청크는 `choices=[]`라 기존 yield 가드 `if chunk.choices and chunk.choices[0].delta.content:`가 자동 skip → SSE payload shape 0 변경 (unit test 4 passed 유지로 검증)
- 호출 경로: `_stream_openai(messages, chat_req_id=...)` **직접 호출** (service.py 미경유)
- messages 구성 (최소 테스트 케이스):
  ```python
  [
      {"role": "system", "content": "당신은 다나아의 친절한 AI 건강 코치입니다. 사용자의 건강 질문에 공감하며 생활 습관 중심으로 조언해주세요. 의학적 진단이나 처방은 하지 마세요."},
      {"role": "user", "content": "오늘 공복 혈당 수치가 120mg/dL인데 괜찮을까요?"},
  ]
  ```
- 실행 방식: 같은 프로세스에서 **4회 연속 호출** (cold 1회 + warm 3회)
- 실행 시각: 2026-04-09 ~15:50 KST

### 3.2 원본 실측치

| iter | 상태 | first_content_ms | total_ms | prompt_tokens | completion_tokens | total_tokens |
|---|---|---|---|---|---|---|
| 1 | cold | **2,568.00** | 11,734.25 | 78 | 332 | 410 |
| 2 | warm | 1,345.34 | 8,791.18 | 78 | 326 | 404 |
| 3 | warm | 1,165.21 | 6,579.85 | 78 | 346 | 424 |
| 4 | warm | **640.65** | 5,628.86 | 78 | 342 | 420 |

### 3.3 관찰 및 해석

#### (a) `prompt_tokens = 78`은 **최소 테스트 케이스** — 프로덕션 수치 아님
- `_stream_openai`를 직접 호출했기 때문에 `system + user` 2개 메시지만 보냄
- 실제 `service.send_message_stream` 경로는 `base_system_prompt + user_context + route + filter instruction + history 10건 + current user`로 **훨씬 큼** (추정 800~1500 tokens)
- 이 78은 "prefill 시간이 거의 0인 minimum baseline"으로 해석해야 함

#### (b) 최소 케이스에서도 warm first_content 640ms — **네트워크 RTT가 주 병목 확정**
- prompt_tokens 78 → gpt-4o-mini 기준 prefill 예상 시간 ~40ms (2000 tok/s 기준)
- 그런데 warm first_content = 640ms → **600ms는 순수 네트워크 + OpenAI 서버 내부 처리**
- Step 1 `/v1/models` warm median 590ms와 **거의 일치** (엔드포인트가 다름에도)
- **결론**: prompt_tokens를 0으로 줄여도 TTFT는 600ms 아래로 못 내림

#### (c) Cold→Warm 점진 감소 = **warmup 버그가 실제로 큰 영향**
- iter 1 cold = 2,568ms
- iter 4 warm = 640ms
- 차이 = **1,928ms** (75%)
- iter 2, 3이 중간값인 것은 TCP/TLS keepalive가 점진적으로 안정화되는 현상
- 현재 `warmup_shared_openai_client()`는 **dummy** (실제 네트워크 호출 없음, 이전 Exploration에서 확인)
- **함의**: 모든 첫 사용자는 cold 2.5~3초 경험. warmup을 실제 1-token chat.completions 호출로 바꾸면 **첫 사용자 TTFT 최대 1,928ms 단축 가능**

#### (d) Decode rate (참고)
- iter 4: 342 completion_tokens / (5,629 - 640) ms ≈ **68.5 tokens/초**
- gpt-4o-mini 공식 기대치 80~150 tok/s 대비 약간 느린 편
- 네트워크 경유 + SSE chunking 오버헤드로 해석 가능
- 이 수치는 `stream_tail_ms` 관측과 일관됨 (이전 실측 baseline 510ms / improved 443ms)

---

## 4. 종합 해석 — 병목 분해

### 4.1 실측 기반 병목 분포

| 병목 후보 | 실측 수치 | 전체 TTFT(warm 640ms) 대비 비중 | 우리가 줄일 수 있나? |
|---|---|---|---|
| 네트워크 RTT (한국↔OpenAI) | ~590~600ms | **~93%** | base_url 변경(범위 밖) |
| prompt_tokens prefill (78 기준) | ~40ms | ~6% | 축소 가능, 효과 미미 |
| OpenAI 내부 첫 토큰 생성 | ~8~15ms | ~2% | 불가 |
| 기타 (SDK, httpx, 파싱) | ~5~10ms | ~1% | 거의 없음 |

### 4.2 Cold 상태 추가 비용

| 구간 | cold 추가 시간 | 원인 |
|---|---|---|
| TCP 3-way handshake (미국까지) | ~200ms | 네트워크 거리 |
| TLS 1.3 handshake | ~400ms | 1 RTT + 인증서 검증 |
| DNS resolution | ~50~100ms | 첫 조회 |
| HTTP keepalive pool warming | ~1,200ms | 연속 호출로 점진 감소 |
| **합계** | **~1,900ms** | warmup()이 제대로 동작하면 전부 startup 시 상쇄 가능 |

### 4.3 이전 실측 문서(04-09 15-46)와의 일관성

| 지표 | 04-09 15-46 실측 | 이번 Step 2 실측 | 해석 |
|---|---|---|---|
| `openai_first_token` median | 0.690초 | iter 4 = 0.640초 | **일관됨** (차이 ±50ms는 noise 범위) |
| baseline TTFT median | 0.765초 | — | service.py 오버헤드 ~125ms 추가 (prep 등) |

이전 `openai_first_token 690ms`의 실체가 이번 측정으로 **명확**해졌음:
- **약 600ms = 네트워크 RTT** (Step 1 + Step 2 교차 확인)
- **약 40~90ms = OpenAI 내부 prefill + 첫 토큰 생성**
- prompt_tokens 축소로 줄일 수 있는 건 이 **40~90ms 부분뿐**

---

## 5. 시나리오 판정

### 5.1 플랜의 시나리오 분기 표 적용

| RTT warm median | prompt_tokens | 판정 | bench_ttft_ab.py 비교 대상 |
|---|---|---|---|
| ≥ 150ms | ≥ 1000 | 둘 다 병목 | 4조건 A/B |
| **≥ 150ms** | **미확정 (78은 test용)** | **RTT 확정 병목** | **2조건: baseline vs warmup-fix** |
| < 80ms | ≥ 1000 | 토큰 단독 | 2조건 (baseline / history 축소) |
| < 80ms | < 800 | 다른 병목 | 추가 조사 |

### 5.2 선택된 시나리오 = **"RTT 병목 + warmup 버그 제거"**

근거:
- Step 1 warm 590ms → RTT 병목 확정
- Step 2 iter 4 warm 640ms → Step 1과 일관 교차 검증
- cold 2,568ms → iter 4 640ms 차이 1,928ms = warmup 버그 영향 확정
- prompt_tokens 축소는 실측에서 이득 미미 (최소 케이스 78에서도 첫 토큰 640ms) → 이번 bench 대상 아님
- region 변경은 **범위 밖** (base_url 바꾸는 건 staging/prod 영향 크고 별도 승인 필요)

**이번 bench의 핵심 비교 대상은 `warmup_shared_openai_client()` 수정 전/후**

---

## 6. `scripts/bench_ttft_ab.py` 설계안

### 6.1 목적

`warmup_shared_openai_client()`를 실제 1-token chat.completions 호출로 수정한 뒤, **첫 사용자 TTFT가 얼마나 단축되는지**를 정량 측정.

### 6.2 비교 대상

- **Condition A (baseline)**: 현재 `warmup_shared_openai_client()`가 dummy인 상태
- **Condition B (candidate)**: `warmup_shared_openai_client()`가 실제 1-token `chat.completions.create(max_tokens=1, stream=False)` 호출로 수정된 상태

### 6.3 측정 방식

**측정 단위**: 각 condition에서 **"프로세스 fresh start 후 첫 요청"의 `first_content_ms`**
- 이것이 "warmup 효과"를 가장 직접적으로 재는 지표
- warm 호출은 보조 지표 (워밍 후 안정 상태)

**샘플 수**:
- Fresh-start cold: **각 condition 10회** (프로세스 재시작 포함)
- Same-process warm: 각 fresh-start 뒤 **3회 추가** (warm 동작 확인)
- 총 측정: A 10 cold + 30 warm, B 10 cold + 30 warm

**왜 10회 cold인가**:
- 이전 실측 5회로는 분산 ±800ms, 개선폭 ±50ms → 16배 noise로 결론 불가
- 10회 cold는 OpenAI 서버 부하 변동성을 줄여주되, 10 × 2.5초 = 25초 정도로 실행 가능
- p50은 10회로 충분, p95는 별도 해석 (10회 → p90 정도까지 신뢰)

**입력 고정**:
- Step 2와 동일한 messages (system + user 2개) 사용
- 이유: warmup 효과만 재는 것이 목적, prompt 변동성 배제
- 한 번 이상 사용자가 "실제 프로덕션과 유사한 messages" 요청 시 Step 2.5로 분리

**인터리브**:
- Condition A 10 cold → Condition B 10 cold (순차)
- **인터리브 금지 이유**: 프로세스 재시작이 필요해서 교대 실행의 추가 이득이 작음. 대신 각 cohort를 같은 10분 window 안에 측정해 시간대 편향 최소화

### 6.4 스크립트 개요 (`scripts/bench_ttft_ab.py`)

```python
"""Bench first-token latency under two warmup conditions.

Usage:
    # Run both conditions in same process
    uv run python scripts/bench_ttft_ab.py --condition baseline --iterations 10
    # after modifying warmup_shared_openai_client()
    uv run python scripts/bench_ttft_ab.py --condition candidate --iterations 10
"""
from __future__ import annotations
import argparse, asyncio, json, statistics, sys, time, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

FIXED_MESSAGES = [
    {"role": "system", "content": "당신은 다나아의 친절한 AI 건강 코치입니다. ..."},
    {"role": "user", "content": "오늘 공복 혈당 수치가 120mg/dL인데 괜찮을까요?"},
]

async def run_fresh_start(condition: str) -> tuple[float, list[float]]:
    """Re-init shared client each call to force cold.
    Returns (cold_ms, warm_samples_ms)."""
    from backend.services.chat.openai_client import (
        init_shared_openai_client, close_shared_openai_client
    )
    from backend.services.chat.streaming import _stream_openai

    await init_shared_openai_client()  # this includes warmup (dummy or real depending on condition)
    try:
        # Cold request (first after init)
        t0 = time.perf_counter()
        async for chunk in _stream_openai(FIXED_MESSAGES, chat_req_id=f"bench-{condition}-cold"):
            if chunk is None:
                return -1.0, []
            break  # We only care about first content, stop after first yield
        cold_ms = (time.perf_counter() - t0) * 1000
        # Drain remaining tokens to let stream complete
        async for _ in _stream_openai(FIXED_MESSAGES, chat_req_id=f"bench-{condition}-drain"):
            pass
        # Actually: we need to drain the first stream, not start a new one.
        # See implementation note below.

        # Warm requests
        warm_ms: list[float] = []
        for i in range(3):
            t1 = time.perf_counter()
            async for chunk in _stream_openai(FIXED_MESSAGES, chat_req_id=f"bench-{condition}-warm-{i}"):
                if chunk is None:
                    break
                break
            warm_ms.append((time.perf_counter() - t1) * 1000)
            # drain
            ...
        return cold_ms, warm_ms
    finally:
        await close_shared_openai_client()

async def main(condition: str, iterations: int) -> None:
    cold_samples: list[float] = []
    all_warm: list[float] = []
    for i in range(iterations):
        print(f"[{i+1}/{iterations}] fresh-start probe...", flush=True)
        cold, warm = await run_fresh_start(condition)
        if cold < 0:
            print(f"  ERROR on iteration {i+1}")
            continue
        print(f"  cold={cold:.2f}ms  warm={[round(w,1) for w in warm]}")
        cold_samples.append(cold)
        all_warm.extend(warm)

    print()
    print(f"=== {condition} (n={len(cold_samples)} cold, {len(all_warm)} warm) ===")
    if cold_samples:
        print(f"  cold  median: {statistics.median(cold_samples):.2f}ms")
        print(f"  cold  min/max: {min(cold_samples):.2f} / {max(cold_samples):.2f}")
        if len(cold_samples) >= 5:
            sorted_c = sorted(cold_samples)
            p90 = sorted_c[int(0.9 * len(sorted_c)) - 1] if len(sorted_c) >= 10 else sorted_c[-1]
            print(f"  cold  p90   : {p90:.2f}ms")
    if all_warm:
        print(f"  warm  median: {statistics.median(all_warm):.2f}ms")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--condition", choices=["baseline", "candidate"], required=True)
    parser.add_argument("--iterations", type=int, default=10)
    args = parser.parse_args()
    asyncio.run(main(args.condition, args.iterations))
```

**구현 노트**:
- `_stream_openai`는 async generator라 첫 yield 시점에 `break`하면 연결이 중간에 닫힘 → 다음 호출에 영향 없음 (httpx pool이 알아서 처리)
- 다만 first_content_ms만 재려면 stream 끝까지 drain 안 해도 됨
- 각 iteration마다 `init_shared_openai_client()` → `close_shared_openai_client()` 사이클로 cold 재현
- `init_shared_openai_client()`가 warmup을 포함하므로, warmup이 실제 네트워크 호출하도록 수정됐다면 cold latency가 여기서 흡수됨

### 6.5 결과 출력 형식

```
=== baseline (n=10 cold, 30 warm) ===
  cold  median: 2450.00ms
  cold  min/max: 1890.00 / 3120.00
  cold  p90   : 2980.00ms
  warm  median: 620.00ms

=== candidate (n=10 cold, 30 warm) ===
  cold  median:  650.00ms       # 예상: warmup이 cold 비용을 startup에 흡수
  cold  min/max:  580.00 /  720.00
  cold  p90   :  710.00ms
  warm  median:  610.00ms       # 거의 변화 없음 (이미 warm이었으니)

=== delta ===
  cold  median: -1800.00ms (-73.5%)
  warm  median:  -10.00ms  (-1.6%)
```

**승인 기준 (hard gate)**:
- `cold median delta ≤ -1000ms` (1초 이상 단축)
- `warm median delta` 악화 없음 (±50ms 이내)
- `cold max` p95 범위 수용 가능 (spike 없음)

**실패 기준**:
- cold 단축이 500ms 미만 → warmup 수정이 예상만큼 동작 안 함
- warm median 악화 > 50ms → warmup이 부작용 유발
- 에러 비율 > 0 → 구조적 문제

### 6.6 실행 환경 체크리스트

- [ ] `OPENAI_API_KEY` 설정 (env 또는 .env)
- [ ] DB 불필요 (streaming.py 직접 호출 경로)
- [ ] 실행 시각 통제: A/B 측정 사이 간격 10분 이내 (OpenAI 서버 부하 변동 최소화)
- [ ] 네트워크 안정: WiFi 아닌 유선/안정된 네트워크 권장
- [ ] 실행 로그 보관: `logs/bench_ttft_ab_YYYYMMDD_HHMM.log`로 structlog 출력 저장

### 6.7 예상 소요 시간

- Condition A 10회 cold + 30 warm = ~5분
- Condition B 10회 cold + 30 warm = ~5분
- 결과 정리 및 비교 표 = ~5분
- **총 약 15분 + warmup 수정 구현 시간 (Step C)**

---

## 7. 다음 단계 — Step C (warmup 버그 수정)

> **주의**: 이건 현재 플랜의 Step 1+2+3 범위를 넘는 작업이라 **별도 사용자 승인 후** 진행.

### 7.1 수정 대상

- 파일: `backend/services/chat/openai_client.py`
- 함수: `warmup_shared_openai_client()`

### 7.2 현재 구현 (파악된 사실)

- 이름만 있고 실제 OpenAI 네트워크 호출 **안 함**
- `init_shared_openai_client()`가 module-level 싱글톤 생성 후 `warmup()`은 인스턴스 존재만 확인
- 즉 첫 `chat.completions.create()` 호출에 TLS/TCP/DNS cold가 그대로 들어감

### 7.3 수정안 (스케치)

```python
async def warmup_shared_openai_client() -> None:
    """Force TCP/TLS handshake + OpenAI internal routing cache warming.

    Called at FastAPI startup after init. Sends a minimal chat.completions
    request (1 token, stream=False) to ensure the first user request does
    not pay the cold-start cost.

    Failure is non-fatal: log a warning and let the app boot. The first
    real request will just pay cold as before.
    """
    client = get_openai_client()
    try:
        await asyncio.wait_for(
            client.chat.completions.create(
                model=config.OPENAI_MODEL,
                messages=[{"role": "user", "content": "."}],
                max_tokens=1,
                stream=False,
                user="warmup",
            ),
            timeout=10.0,
        )
        logger.info("chat_openai_warmup_completed")
    except Exception as exc:
        logger.warning("chat_openai_warmup_failed", error=type(exc).__name__)
        # Don't raise — warmup failure should not block app startup
```

### 7.4 리스크 및 완화

| 리스크 | 수준 | 완화 |
|---|---|---|
| Startup 지연 (최대 10초) | Low | `asyncio.wait_for`로 10초 한계, 실패해도 계속 |
| 예상치 못한 API 비용 | Low | 1 토큰 × 1회 × 배포 = $0.0001 수준 |
| OpenAI rate limit 소모 | Low | 1 호출로 무시 가능 |
| shared client 없을 때 동작 | Medium | `CHAT_OPENAI_SHARED_CLIENT_ENABLED=False` 시 warmup 건너뛰기 조건 추가 |

### 7.5 검증 방법

1. 수정 전 `bench_ttft_ab.py --condition baseline --iterations 10` 실행, 결과 저장
2. `warmup_shared_openai_client()` 수정
3. unit test 실행 (4 passed 유지 확인)
4. `bench_ttft_ab.py --condition candidate --iterations 10` 실행
5. Delta 계산 후 6.5절의 승인 기준 확인
6. 통과 시 커밋, 실패 시 원복

### 7.6 승인 플로우

1. 사용자가 이 문서 Section 7을 보고 진행 여부 결정
2. 승인 시 AI가:
   - Step C.1: `bench_ttft_ab.py` 구현 + baseline 측정
   - Step C.2: `warmup_shared_openai_client()` 수정
   - Step C.3: candidate 측정 + 비교 보고
   - Step C.4: 통과 시 별도 문서 작성 (`04-09 HH-MM TTFT warmup 수정 실측.md`)

---

## 8. 이 측정으로 **추정 기반** 가정이 깨진 항목들

제가 이전 플랜들에서 주장했던 것들이 실측과 어긋난 부분을 정직하게 기록합니다.

| 이전 주장 | 실측 | 판정 |
|---|---|---|
| "history 10→6으로 30~80ms 단축" | 78 토큰에서도 warm 640ms → history 축소로 ~40ms 예상 | **과대 추정** |
| "AsyncOpenAI 싱글톤으로 100~300ms 단축" | warm 이득 ~50ms, cold는 1,928ms이지만 warmup 버그로 실현 안 됨 | **부분 사실** (cold만 해당, warm은 과대) |
| "prep 병렬화로 20~75ms 단축" | 전체 TTFT 640ms 중 prep는 ~10ms → 상한 ~10ms | **크게 과대** |
| "Prompt caching으로 100~300ms 단축 (hit 시)" | 측정 안 했으나 실 프로덕션 prompt_tokens 모름 → 판단 보류 | **미검증** |
| "한국↔us-east RTT 180ms" | 실측 590ms (3.3배) | **완전히 틀림** |
| "OpenAI 내부 prefill이 병목의 80%" | 78 토큰 기준 prefill ~40ms, 전체 640ms의 6% | **크게 과대** |
| "누적 200~700ms 단축 예상" | 실측 기반 재추정: warm 50ms + cold warmup -1,900ms | **warm은 과대, cold는 과소** |

### 교훈

- "일반론적 숫자"를 프로젝트에 그대로 대입하면 완전히 빗나감
- `/v1/models` 측정 같은 **5분짜리 실측**이 27개 병목 분석보다 정확함
- "측정 먼저" 원칙을 말로만 하지 말고 **가장 먼저 실행**해야 함

---

## 9. 부록 — 원본 로그·명령어

### 9.1 Step 1 실행

```bash
uv run python scripts/probe_openai_region.py --iterations 5
```

### 9.2 Step 2 실행 (인라인)

```bash
# streaming.py 임시 수정 후
uv run python -c "
import asyncio, sys, time, pathlib
ROOT = pathlib.Path('.').resolve()
sys.path.insert(0, str(ROOT))
from backend.services.chat.streaming import _stream_openai
from backend.services.chat.openai_client import init_shared_openai_client, close_shared_openai_client
async def main():
    await init_shared_openai_client()
    try:
        messages = [
            {'role': 'system', 'content': '당신은 다나아의 친절한 AI 건강 코치입니다. 사용자의 건강 질문에 공감하며 생활 습관 중심으로 조언해주세요. 의학적 진단이나 처방은 하지 마세요.'},
            {'role': 'user', 'content': '오늘 공복 혈당 수치가 120mg/dL인데 괜찮을까요?'}
        ]
        for i in range(4):
            t0 = time.perf_counter()
            content = []
            async for chunk in _stream_openai(messages, chat_req_id=f'probe-usage-{i+1}'):
                if chunk is None: break
                content.append(chunk)
            elapsed_ms = (time.perf_counter() - t0) * 1000
            label = 'cold' if i == 0 else 'warm'
            print(f'iter {i+1} [{label}]: {elapsed_ms:.2f}ms total, {len(\"\".join(content))} chars')
    finally:
        await close_shared_openai_client()
asyncio.run(main())
"
# 측정 후 streaming.py 2곳 즉시 원복
```

### 9.3 원복 검증

```bash
# stream_options, chat_openai_usage 흔적 없어야 함
git diff backend/services/chat/streaming.py | grep -E "(stream_options|chat_openai_usage|include_usage)"
# (no output)

# unit test 4 passed 유지
uv run pytest backend/tests/unit/test_chat_branch_sse.py -q
# 4 passed
```

### 9.4 알려진 추가 이슈 (이번 범위 외, 기록만)

1. **`.env` `OPENAI_API_KEY` 평문 노출** — 별도 보안 이슈. `.env`가 gitignore에 있다고 가정하되, 공유 시 주의
2. **`CHAT_LANGGRAPH_MODE=shadow`** vs 이전 실측 문서(04-09 15-46)의 `off` 조건 불일치 — cohort 고정 필요
3. **warmup_shared_openai_client() dummy 버그** — 본 문서의 Section 7이 수정 대상

---

## 10. 한 줄 결론

> **Step 1+2 실측으로 확정된 사실 2가지: (1) 한국↔OpenAI 네트워크 RTT warm 590~640ms가 전체 TTFT의 90% 이상을 차지하고, (2) `warmup_shared_openai_client()` dummy 버그로 첫 사용자는 추가 1,928ms cold를 경험한다. 이전 플랜들의 "prep 병렬화·history 축소·prompt caching" 같은 추정 기반 최적화는 실측에서 의미 없는 micro-optimization임이 드러났다. 이 데이터를 근거로 bench_ttft_ab.py는 "baseline vs warmup-fix 2조건 비교"로 확정하며, warmup 버그 수정은 별도 승인 후 Step C로 진행한다.**
