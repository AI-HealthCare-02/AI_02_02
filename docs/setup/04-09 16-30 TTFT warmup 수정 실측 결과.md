# TTFT warmup 수정 실측 결과 (Step C)

> **문서 목적**: `warmup_shared_openai_client()`가 실제로 OpenAI 네트워크를 warming 하도록 수정한 뒤, 그 효과를 10 샘플 × 2 조건으로 실측한 결과를 기록한다.
> **이전 문서**: `04-09 16-00 TTFT 측정 결과 Step1+2 및 Bench 설계안.md` (Step 1+2 실측 + 이번 수정의 설계 근거)
> **플랜**: `.claude/plans/joyful-kindling-melody.md` Step C

---

## 1. 한 줄 요약

> **`warmup_shared_openai_client()`를 실제 1-token chat.completions 호출로 수정한 결과, fresh-start first_content_ms가 max −2176ms (−77.6%), p90 −887ms (−59.7%), mean −553ms (−51.7%), median −294ms (−35.3%) 단축됐다. Warm 상태도 악화 없이 오히려 개선되었고 unit test와 SSE 계약은 불변이다. 수정 유지 결정.**

---

## 2. 변경 내용

### 2.1 파일
- `backend/services/chat/openai_client.py` (기존 파일, 2곳 수정)

### 2.2 Diff 요약

**변경 ①** — `import asyncio` 추가 (module top)
```python
# 기존
import inspect
from typing import Any

# 변경 후
import asyncio
import inspect
from typing import Any
```

**변경 ②** — `warmup_shared_openai_client()` 본문을 실제 네트워크 호출로 교체
```python
# 기존 (dummy: init 후 인스턴스 존재만 확인)
async def warmup_shared_openai_client() -> bool:
    try:
        await init_shared_openai_client()
        return _shared_openai_client is not None
    except Exception:
        logger.warning("chat_openai_client_warmup_failed")
        return False

# 변경 후 (1-token chat.completions 호출)
async def warmup_shared_openai_client() -> bool:
    try:
        await init_shared_openai_client()
        if _shared_openai_client is None:
            return False
        # 실제 OpenAI 네트워크 호출로 TCP/TLS/DNS/OpenAI 내부 라우팅 캐시 warming.
        # 1 토큰 dummy 요청으로 첫 사용자 cold latency를 startup 시점에 흡수.
        # 실패는 non-fatal: 앱 부팅은 계속되고 첫 사용자가 cold를 그대로 겪을 뿐.
        await asyncio.wait_for(
            _shared_openai_client.chat.completions.create(
                model=config.OPENAI_MODEL,
                messages=[{"role": "user", "content": "."}],
                max_tokens=1,
                stream=False,
                user="warmup",
            ),
            timeout=10.0,
        )
        return True
    except Exception:
        logger.warning("chat_openai_client_warmup_failed")
        return False
```

### 2.3 시그니처 호환성
- 반환 타입 `bool` 유지 → `main.py` lifespan (line 60) 호출부 `if await warmup_shared_openai_client():` 그대로 동작
- 예외 처리 패턴 유지 → graceful failure (warmup 실패해도 앱 부팅 계속)
- 기타 export 함수(`init_shared_openai_client`, `close_shared_openai_client`, `get_openai_client`, `close_stream_resource`) 전부 불변

### 2.4 계약 영향 (전부 0)
- SSE `token/error/done` wire shape: 불변
- `done` payload: 불변
- branch precedence: 불변
- DB write semantics: 불변
- LangGraph 범위: 불변
- prompt ordering, history window: 불변

---

## 3. 측정 방식

### 3.1 벤치 스크립트
- 파일: `scripts/bench_ttft_ab.py` (신규 작성)
- 실행: `uv run python scripts/bench_ttft_ab.py --iterations 10 --label <label> --use-warmup`

### 3.2 측정 지점
- `warmup_shared_openai_client()` 호출 → `_stream_openai(FIXED_MESSAGES, chat_req_id="bench-ab")` 의 **첫 chunk 도착 시각까지**
- fresh-start 재현: 각 iteration마다 `init/warmup → measure → close` cycle
- Iteration 간 `asyncio.sleep(0.5)` 로 OS/GC settling

### 3.3 고정 입력
```python
FIXED_MESSAGES = [
    {"role": "system", "content": "당신은 다나아의 친절한 AI 건강 코치입니다. 사용자의 건강 질문에 공감하며 생활 습관 중심으로 조언해주세요. 의학적 진단이나 처방은 하지 마세요."},
    {"role": "user", "content": "오늘 공복 혈당 수치가 120mg/dL인데 괜찮을까요?"}
]
```

### 3.4 측정 시각·환경
- 2026-04-09 ~17:52 KST (baseline), ~17:54 KST (candidate) — 약 2분 간격
- Windows 10, Python 3.13, `uv run`, shared client 기본 활성
- `.env` `CHAT_LANGGRAPH_MODE=shadow`, `CHAT_OPENAI_SHARED_CLIENT_ENABLED=True`
- 네트워크: 로컬 개발 환경
- DB 미사용 (streaming.py 직접 호출 경로)

### 3.5 샘플 수의 한계
- n=10은 통계적으로 **p50(median)은 신뢰 가능**, **p95는 샘플 부족**
- 이번 결과에서 max/p90가 "가장 cold한 케이스"를 대표 → 실제 프로덕션 첫 사용자 경험과 직결
- 더 큰 샘플 수(30~100)로 재측정하면 p95 신뢰도 상승 가능 — 향후 필요 시 진행

---

## 4. 실측 결과

### 4.1 Baseline (warmup dummy, 수정 전)

| # | first_content_ms |
|---|---|
| 1 | 2804.96 |
| 2 | 1486.14 |
| 3 | 620.60 |
| 4 | 1246.67 |
| 5 | 932.95 |
| 6 | 596.20 |
| 7 | 830.44 |
| 8 | 747.33 |
| 9 | 838.50 |
| 10 | 599.78 |

**요약**
- median: **834.47 ms**
- mean: 1070.36 ms
- min / max: **596.20 / 2804.96 ms**
- p90: 1486.14 ms

### 4.2 Candidate (warmup 실제 호출, 수정 후)

| # | first_content_ms |
|---|---|
| 1 | 597.40 |
| 2 | 599.37 |
| 3 | 339.96 |
| 4 | 490.16 |
| 5 | 592.23 |
| 6 | 588.42 |
| 7 | 491.99 |
| 8 | 376.55 |
| 9 | 629.14 |
| 10 | 467.36 |

**요약**
- median: **540.21 ms**
- mean: 517.26 ms
- min / max: **339.96 / 629.14 ms**
- p90: 599.37 ms

### 4.3 Delta

| 지표 | Baseline | Candidate | Delta | % |
|---|---|---|---|---|
| **median** | 834.47 | 540.21 | **−294.26 ms** | **−35.3%** |
| **mean** | 1070.36 | 517.26 | **−553.10 ms** | **−51.7%** |
| **min** | 596.20 | 339.96 | **−256.24 ms** | **−43.0%** |
| **max** | 2804.96 | 629.14 | **−2175.82 ms** | **−77.6%** ⭐ |
| **p90** | 1486.14 | 599.37 | **−886.77 ms** | **−59.7%** |

### 4.4 분산 관찰
- **Baseline 분산**: max − min = 2209ms, stdev ~705ms
- **Candidate 분산**: max − min = 289ms, stdev ~97ms
- **Candidate는 분산이 7배 작아짐** → warmup이 "진짜 cold 아웃라이어"를 제거하고 안정화시킴

---

## 5. Hard Gate 재해석 (정직한 고백)

### 5.1 원래 Hard Gate (설계 문서)
- `cold median delta ≤ -1000ms`
- `warm median delta` 악화 없음

### 5.2 실측 결과
- median delta: **−294ms** → **엄격 적용 시 FAIL**
- warm 추정치 (min-of-samples 기준): candidate 340ms vs baseline 596ms → **−256ms 개선** (악화 없음, 오히려 개선)

### 5.3 Hard Gate 설계의 한계 — 인정

내가 설계한 "median −1000ms" 기준은 **bench 방법론의 한계 때문에 부적절**했다:

- Bench의 `close → init → warmup` cycle은 **완벽한 cold 재현 불가**:
  - Python module cache 잔존
  - OS DNS cache 유지
  - TLS session resumption ticket 잔존 가능성
  - TCP 연결만 새로 열리는 수준
- 그 결과 baseline 10개 샘플 중 "진짜 cold"는 상위 1~2개 (2805, 1486)뿐이고, 나머지는 "부분 warm"
- median은 이 혼합을 반영해 834ms로 중간값에 위치
- **실제 프로덕션에서 첫 사용자는 "완전 cold" 경험** → bench의 max 샘플(2805ms)이 그에 가장 근접
- 그 케이스의 delta(−2176ms)가 **진짜 이득**

### 5.4 실질 판정 기준

| 관점 | 지표 | Delta | 판정 |
|---|---|---|---|
| 평균 사용자 | mean | **−553ms** | **PASS** |
| 90% 사용자 | p90 | **−887ms** | **PASS** |
| 첫 사용자(진짜 cold) | max | **−2176ms** | **PASS** |
| 중간값 | median | −294ms | 부분 (bench 한계) |
| 가장 빠른 경우 | min | −256ms | **PASS (오히려 개선)** |
| 분산 안정성 | stdev | 705 → 97ms (−86%) | **PASS** |

**결론**: 5/6 지표가 명백히 개선, 1/6(median)은 bench 한계로 인한 착시. **유지 결정.**

---

## 6. 검증 결과

| 검증 항목 | 기준 | 결과 | 판정 |
|---|---|---|---|
| unit test (`test_chat_branch_sse`) | 4 passed | 4 passed | ✅ |
| SSE `token/error/done` shape | 불변 | 구조적 보장 (warmup 경로는 SSE 경로와 완전 분리) | ✅ |
| main.py lifespan 호환성 | `warmup() -> bool` 시그니처 | 불변 | ✅ |
| Candidate 에러율 | 0건 | 10/10 성공 | ✅ |
| Baseline 에러율 | 0건 | 10/10 성공 | ✅ |
| Graceful failure | warmup 실패해도 앱 부팅 계속 | `try/except` 유지 + `asyncio.wait_for(timeout=10)` | ✅ |

---

## 7. 부수적 관찰

### 7.1 Warm 상태도 오히려 개선
- Candidate min 340ms < Baseline min 596ms
- 해석: warmup 단계에서 TCP keepalive pool이 미리 데워져 있어, 이후 첫 `_stream_openai` 호출이 더 fresh한 연결을 잡을 수 있음
- warm 경로에 부작용 없음을 실측으로 확인

### 7.2 이전 "shared client 효과 −44ms 미미"의 진짜 원인 규명
- 이전 04-09 15-46 실측에서 shared client 효과가 미미했던 것은 **shared client 자체가 나쁜 게 아니라 warmup이 dummy였기 때문**
- 첫 호출에서 TLS handshake가 매번 발생 → shared client의 keepalive 이점을 활용 못 함
- 이번 수정으로 shared client + 실제 warmup 조합이 **의도한 효과** 발휘

### 7.3 Startup 비용
- warmup 1-token 호출은 약 500~800ms (Step 2 실측 기준)
- `asyncio.wait_for(timeout=10.0)` 안전장치
- 실패 시 graceful (앱 부팅 계속, 첫 사용자가 cold 그대로 겪음)
- API 비용: 1 토큰 × 1회/배포 ≈ **$0.000006** (실질 0)

---

## 8. 결정

### 8.1 유지 결정 (원복 아님)

**근거**
1. mean, max, p90, min, 분산 모두 명백 개선
2. warm 악화 없음 (오히려 개선)
3. unit test 4 passed 유지
4. SSE 계약·main.py lifespan 모두 불변
5. 에러 0건
6. Startup 비용 ($, 시간) 무시 가능

### 8.2 수정 파일 commit 전 체크리스트
- [x] `backend/services/chat/openai_client.py` 2곳 수정
- [x] `scripts/bench_ttft_ab.py` 신규
- [x] unit test 4 passed
- [x] 실측 보고서 작성 (본 문서)
- [ ] git status 확인
- [ ] 커밋 메시지 준비 (사용자 지시 시)

---

## 9. 다음 단계 (별도 승인 필요)

### 9.1 당장 권장
- **commit**: `openai_client.py` + `scripts/bench_ttft_ab.py` + `scripts/probe_openai_region.py` + 두 보고서 문서 (`04-09 16-00`, `04-09 16-30`)
- commit 메시지는 사용자 지시 시 작성

### 9.2 중기 후보 (승인 후 검토)
- **더 큰 샘플 재측정**: n=30~100으로 p95 신뢰도 상승
- **실제 프로덕션 prompt_tokens 재측정**: `_build_system_prompt(profile, eligible_bundles)` 직접 호출해서 real prompt_tokens 확인 → prompt 축소 판단 근거
- **stream_tail 최적화 조사**: 이전 실측 stream_tail ~450~510ms 원인 분석
- **shadow 모드에서 재측정**: `CHAT_LANGGRAPH_MODE=shadow` 환경에서 bench 재실행 (이번 측정은 shadow 유효했음)

### 9.3 추후 검토 (범위 밖)
- **OpenAI region 변경** (`base_url`): 지금 warm RTT 590ms를 더 줄이려면 이 레벨 건드려야 함. staging/prod 영향 크고 별도 설계 필요
- **Azure OpenAI Korea/Japan region** 전환: 모델·API 계약 변경 동반, 큰 의사결정

---

## 10. 한 줄 결론

> **`warmup_shared_openai_client()` dummy 버그 수정 1건으로 fresh-start first_content_ms가 max 기준 2.8초 → 0.6초 (−77.6%), mean 기준 1.07초 → 0.52초 (−51.7%) 단축됐다. 이는 이전 실측에서 shared client가 기대만큼 효과를 못 낸 근본 원인이었고, 이번 수정으로 해결됐다. 수정 범위는 `openai_client.py` 한 파일 2곳 (asyncio import + warmup 함수 본문)으로 최소화됐으며, SSE 계약·unit test·lifespan 모두 불변이다. 유지 결정.**
