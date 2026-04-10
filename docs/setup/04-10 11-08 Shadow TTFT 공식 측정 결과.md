# Shadow TTFT 공식 측정 결과

## 1. 측정 목적
- 목표: `shadow 서버 TTFT`를 `0.80~0.85초` 근처까지 낮출 수 있는지 확인한다.
- 모델: `gpt-4o-mini`
- 경로: `ChatService.send_message_stream()` 실제 서비스 경로
- 외부 호출: 실제 OpenAI API 호출
- DB: Docker `postgres`, 로컬 pytest에서는 `DB_HOST=localhost`, `DB_NAME=test`
- 단위: 모두 `초`

## 2. 측정 조건
- 각 조건은 `BENCH_ITERATIONS=30`으로 실행했다.
- 입력은 기존 benchmark의 10개 고정 메시지를 순서대로 반복했다.
- 결과 로그 위치:
  - `logs/ttft-official-0410-1050/off.log`
  - `logs/ttft-official-0410-1050/shadow0.log`
  - `logs/ttft-official-0410-1050/shadow5.log`
  - `logs/ttft-official-0410-1050/shadow5-rerun.log`
  - `logs/ttft-official-0410-1050/shadow100.log`

## 3. 측정 결과
| 측정 세트 | 모드 | shadow sample | 요청 수 | TTFT 중앙값 | TTFT 평균 | TTFT p95 | done 중앙값 | done 평균 | done p95 | prompt 중앙값 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| off | off | 0% | 30 | 1.055초 | 1.102초 | 1.555초 | 2.380초 | 2.408초 | 2.850초 | 371.5 tokens |
| shadow0 | shadow | 0% | 30 | 0.994초 | 1.051초 | 1.326초 | 2.242초 | 2.309초 | 2.869초 | 371.5 tokens |
| shadow5 | shadow | 5% | 30 | 1.262초 | 1.319초 | 1.928초 | 2.710초 | 3.087초 | 3.640초 | 371.5 tokens |
| shadow5-rerun | shadow | 5% | 30 | 1.071초 | 1.146초 | 1.493초 | 2.681초 | 2.638초 | 3.303초 | 371.5 tokens |
| shadow100 | shadow | 100% | 30 | 1.081초 | 1.172초 | 1.580초 | 2.789초 | 2.905초 | 3.824초 | 371.5 tokens |

## 4. 쉬운 해석
- 이번 목표였던 `shadow5 TTFT 0.80~0.85초`는 달성하지 못했다.
- 가장 중요한 운영 목표값은 `shadow5-rerun` 기준으로 보는 것이 더 안전하다.
  - 첫 측정 `shadow5`: TTFT `1.262초`
  - 재측정 `shadow5-rerun`: TTFT `1.071초`
- 두 값 차이가 크기 때문에 OpenAI 외부 응답 변동이 꽤 크게 섞여 있다.
- `shadow0`가 `0.994초`, `shadow100`이 `1.081초`였으므로 LangGraph shadow adapter 자체의 순수 오버헤드는 대략 `0.09초` 안쪽으로 보인다.
- 즉 이번 코드 변경의 방향은 맞지만, 현재 병목은 “코드 내부 shadow overhead”보다 “OpenAI 첫 토큰 RTT 변동” 쪽 영향이 더 크다.

## 5. 목표 달성 여부
| 기준 | 목표 | 실제 | 판정 |
|---|---:|---:|---|
| 1차 성공 | shadow5 TTFT 0.85초 이하 | 1.071초 또는 1.262초 | 실패 |
| 목표 성공 | shadow5 TTFT 0.82초 이하 | 1.071초 또는 1.262초 | 실패 |
| done 악화 없음 | 기존 shadow 2.463초 이하 | 2.681초 또는 2.710초 | 실패 |
| shadow 오버헤드 제거 | off와 shadow0/5 차이를 작게 | shadow0는 off보다 빠름, shadow5는 변동 큼 | 일부 성공 |

## 6. 주의해야 할 점
- 이번 측정은 실제 OpenAI를 호출했지만, 조건을 완전히 interleaved로 섞은 측정은 아니다.
- 조건별로 순차 실행했기 때문에 OpenAI가 느린 시간대에 걸린 조건이 손해를 볼 수 있다.
- `shadow5`가 `shadow100`보다 느리게 나온 첫 결과는 코드 구조상 자연스럽지 않다.
- 그래서 `shadow5`만 재측정했고, 재측정에서는 TTFT가 `1.262초 -> 1.071초`로 크게 내려갔다.
- 더 엄밀한 최종 판정은 `off/shadow0/shadow5/shadow100`을 요청 단위로 섞는 interleaved runner로 해야 한다.

## 7. 현재 결론
- 현재 실제 측정 기준으로는 `0.7~0.8초 초반` 목표에 도달하지 못했다.
- 다만 `shadow` 자체를 줄이는 작업은 의미가 있었다.
  - `shadow0`: `0.994초`
  - `shadow100`: `1.081초`
  - 차이: 약 `0.087초`
- 지금 남은 큰 병목은 내부 Python 코드보다 OpenAI 첫 토큰 응답 시간이다.
- 다음 최적화 방향은 code micro-opt가 아니라 아래 중 하나다.
  - OpenAI region/base_url/네트워크 RTT 확인
  - 출력 토큰 수와 답변 길이 정책 조정
  - interleaved benchmark로 노이즈 제거
  - 브라우저 `wire_ttft`와 `paint_ttft` 별도 확인

## 8. 다음 실행 권장
1. `interleaved` benchmark runner를 추가해 조건별 시간대 편향을 제거한다.
2. `probe_openai_region.py`로 같은 시간대 OpenAI RTT를 같이 기록한다.
3. 그 결과에서도 TTFT가 `1.0초` 근처라면 code-level 최적화는 멈추고 infra/region 또는 output budget으로 방향을 바꾼다.

## 9. 후속 interleaved 실측 완료 (04-10 02:50)

위 8장의 권장사항을 모두 수행한 결과가 나왔다.

- 후속 문서: `docs/setup/04-10 02-50 TTFT 공식 interleaved 실측 및 pivot 권고.md`
- 측정 도구: `test_bench_service_ttft_interleaved.py` (신규 작성)
- 방식: 4조건 interleaved × 조건당 50회 (warmup 1회 제외, 유효 49회)
- bootstrap 95% CI 포함

### 추가 코드 변경 (3차 최적화)
- tiktoken 모듈 캐시, orjson SSE, stream warmup, 3작업 asyncio 병렬화

### 핵심 결과 (shadow5 PRIMARY)

| 시점 | TTFT median | 95% CI | done median |
|---|---:|---|---:|
| 이 문서 기준 (순차 30회) | 1.071초 | — | 2.681초 |
| interleaved BEFORE (50회) | 1.096초 | [1.031, 1.157] | 2.373초 |
| interleaved AFTER (50회) | 1.098초 | [1.020, 1.145] | 2.354초 |

### 최종 판정

- shadow5 AFTER 1.098초 → 목표 0.85초 **미달성**
- before/after 차이 +0.002초 → **통계적으로 유의미한 변화 없음** (CI 완전 겹침)
- 이 문서(순차 30회)의 1.071초와 interleaved 50회의 1.096~1.098초는 시간대 변동 차이로 해석됨

### pivot 결정 (가이드 10장 발동)

- **코드 micro-opt으로는 0.85초 도달 불가능 확정**
- TTFT의 지배적 요인: OpenAI 첫 토큰 응답 변동 (±300ms)
- 다음 방향:
  1. OpenAI API 네트워크 RTT 실측 (한국→미국 ~150~250ms)
  2. Azure OpenAI 한국 리전 전환 검토 (RTT ~10~30ms로 절감 가능)
  3. 출력 길이/max_tokens 최적화
  4. 대안 모델 검토 (장기)
- Codex 전달용 프롬프트: `docs/setup/04-10 02-55 Codex 전달 프롬프트 TTFT pivot.md`
