# TTFT Pivot 구현 및 smoke 검증 기록

## 1. 목적
- 목표: `shadow5` TTFT가 1초 근처에서 막히는 원인을 `측정 방식`, `OpenAI RTT`, `출력 길이`로 분리한다.
- 이번 구현은 모델 교체와 Azure 전환 없이 진행했다.
- 기본 운영 동작은 유지한다.
  - 기본 `CHAT_OPENAI_MAX_TOKENS=1024`
  - 기본 `CHAT_OPENAI_SHORT_RESPONSE_ENABLED=false`
  - `/chat/send` SSE `token/error/done` shape 변경 없음

## 2. 구현한 것
- `backend/tests/integration/test_bench_service_ttft_interleaved.py`
  - 결과 JSON에 `git_sha`, `git_dirty`, env/config snapshot, package version을 추가했다.
  - raw sample에 `chat_server_ttft_ms`, `openai_first_content_ms`, `openai_max_tokens`, `short_response_enabled`를 추가했다.
  - 95% CI 계산에 필요한 `scipy`가 없으면 조용히 빠지지 않고 실패하도록 바꿨다.
- `scripts/bench_ttft_interleaved.py`
  - 공식 interleaved 벤치를 실행하고 `logs/*.log`, `logs/*.json` 결과 파일을 남기는 wrapper를 추가했다.
- `scripts/probe_openai_region.py`
  - `/v1/models` RTT 결과를 초 단위 JSON으로도 출력하게 했다.
- `scripts/probe_openai_minimal_chat_ttft.py`
  - DB/ChatService/LangGraph 없이 OpenAI `gpt-4o-mini + stream=True + max_tokens=1`만 호출하는 최소 첫 토큰 측정기를 추가했다.
- `backend/services/chat/streaming.py`, `backend/core/config.py`
  - `max_tokens=1024`를 config로 분리했다.
  - short-policy 실험 시 `CHAT_OPENAI_SHORT_RESPONSE_MAX_TOKENS=256`을 사용할 수 있게 했다.
- `backend/services/chat/prompting.py`
  - `CHAT_OPENAI_SHORT_RESPONSE_ENABLED=true`일 때만 짧은 답변 지시를 추가한다.
  - 의료 안전 안내 생략 금지 문구를 포함했다.

## 3. 짧은 실측 결과
아래 값은 공식 50 round가 아니라 smoke/진단용이다.

| 측정 | 결과 |
|---|---:|
| `/v1/models` cold RTT | 1.6228초 |
| `/v1/models` warm RTT median | 0.5799초 |
| minimal chat cold TTFT | 2.6054초 |
| minimal chat warm TTFT median | 0.8184초 |
| minimal chat warm TTFT p95 | 0.8307초 |

해석:
- OpenAI 입구까지의 warm RTT가 약 `0.58초`로 높게 나왔다.
- OpenAI만 아주 짧게 호출해도 첫 토큰 warm median이 약 `0.82초`다.
- 따라서 현재 환경에서 서비스 전체 TTFT를 안정적으로 `0.7초대`로 만드는 것은 코드만으로는 매우 어렵다.

## 4. smoke benchmark
- 명령:
```powershell
uv run python scripts/bench_ttft_interleaved.py --label pivot-smoke --rounds 2
```
- 결과 파일:
  - `logs/ttft-interleaved-0410-134922-pivot-smoke.log`
  - `logs/ttft-interleaved-0410-134922-pivot-smoke.json`

smoke 결과는 조건별 유효 샘플이 1개뿐이라 성능 판단에는 쓰지 않는다.
목적은 wrapper, JSON 저장, metadata, raw sample 필드가 정상 동작하는지 확인하는 것이다.

## 5. 검증 결과
- `uv run ruff check ...`
  - 통과
- `uv run python -m pytest backend/tests/unit/test_chat_output_budget.py backend/tests/unit/test_chat_sse_encoding.py backend/tests/unit/test_chat_langgraph_prompt_layers.py -q`
  - `10 passed`
- `uv run python -m pytest backend/tests/unit -q`
  - `209 passed`
- `$env:DB_HOST='localhost'; $env:DB_NAME='test'; uv run python -m pytest backend/tests/integration/test_chat_branch_flow.py -q`
  - `5 passed`

## 6. 다음 공식 측정 명령
공식 판단은 아래처럼 50 round 이상으로 실행한다.

```powershell
$env:DB_HOST='localhost'
$env:DB_NAME='test'
$env:OPENAI_MODEL='gpt-4o-mini'
$env:CHAT_BENCH_BUDGET_ENABLED='true'
uv run python scripts/bench_ttft_interleaved.py --label pivot-baseline --rounds 50
```

출력 길이 후보 실험은 아래 env를 추가한 뒤 같은 명령으로 비교한다.

후보 B:
```powershell
$env:CHAT_OPENAI_MAX_TOKENS='256'
$env:CHAT_OPENAI_SHORT_RESPONSE_ENABLED='false'
uv run python scripts/bench_ttft_interleaved.py --label pivot-cap256 --rounds 50
```

후보 C:
```powershell
$env:CHAT_OPENAI_SHORT_RESPONSE_ENABLED='true'
$env:CHAT_OPENAI_SHORT_RESPONSE_MAX_TOKENS='256'
uv run python scripts/bench_ttft_interleaved.py --label pivot-short256 --rounds 50
```

## 7. 현재 결론
- 이번 작업으로 “정확히 잴 수 있는 장치”는 마련됐다.
- smoke 기준으로 OpenAI 자체 첫 토큰 바닥값이 이미 약 `0.82초`라, TTFT 0.7초대는 코드 미세 최적화보다 네트워크/provider 조건의 영향이 더 크다.
- 출력 길이 최적화는 TTFT보다 `done`, 즉 전체 답변 완료 시간 단축 목표로 보는 것이 맞다.
