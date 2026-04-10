# TTFT Pivot 개발 안전 체크리스트

## 1) 요구사항 / 영향 범위 분석
- [x] 변경 목적: `shadow5` TTFT가 1초 근처에서 막히는 원인을 공정 측정, OpenAI RTT, 출력 길이로 분리한다.
- [x] 영향 범위: backend 벤치/진단 스크립트, OpenAI streaming max token 설정, prompt short-policy flag.
- [x] API / DB 계약: `/chat/send` 요청/응답, SSE `token/error/done`, DB schema 변경 없음.
- [x] 성능 영향: 기본값은 기존과 동일하게 `max_tokens=1024`, short-policy off라 운영 기본 동작은 유지된다.

근거:
- `backend/services/chat/streaming.py`
- `backend/services/chat/prompting.py`
- `backend/tests/integration/test_bench_service_ttft_interleaved.py`

---

## 2) 데이터 안전 (중요)
- [x] SoT: 공식 판단은 interleaved benchmark JSON 결과를 기준으로 한다.
- [x] 상태 전이: 채팅 branch, 저장 순서, crisis/block/consent precedence는 변경하지 않는다.
- [x] 멱등성: 벤치/진단 스크립트는 측정용이며 DB schema 변경 없음.
- [x] 동시성: OpenAI shared client 경로는 유지하고, 신규 RTT probe는 별도 스크립트로 격리한다.
- [x] 날짜/시간: 측정 metadata는 UTC timestamp를 기록한다.
- [x] 실패 복구: error rate, zero-token, CI 누락 시 공식 벤치 무효 처리 후 재측정한다.

근거:
- `scripts/probe_openai_minimal_chat_ttft.py`
- `scripts/bench_ttft_interleaved.py`

---

## 3) DB / API 변경 (중요)
- [x] DB migration 없음.
- [x] DB rollback 없음.
- [x] 기존 데이터 호환성 영향 없음.
- [x] API 하위 호환성 영향 없음.
- [x] 파괴적 작업 없음.

근거:
- 변경 범위가 config, prompt/streaming 내부, scripts/tests에 한정됨.

---

## 4) 외부 연동 / 운영 경계
- [x] OpenAI 호출 비용이 발생하는 벤치/RTT probe는 명령을 명시해 수동 실행한다.
- [x] 서비스 경로 측정과 OpenAI-only 측정을 분리한다.
- [x] raw prompt/message/context는 벤치 metadata에 기록하지 않는다.
- [x] 로컬 공식 측정은 Docker postgres/redis + 실제 OpenAI API 기준이다.

근거:
- `scripts/probe_openai_region.py`
- `scripts/probe_openai_minimal_chat_ttft.py`

---

## 5) 테스트 계획 (중요)
- [x] 단위 테스트: output budget config와 short-policy flag 검증.
- [x] 통합/회귀: branch flow와 interleaved smoke 벤치.
- [x] 실패 경로: error rate, zero-token, CI 누락을 무효 조건으로 기록.
- [x] 잔여 리스크: 실제 50 round 공식 벤치는 OpenAI 비용과 시간이 들어 최종 수동 실행 필요.

근거:
- `backend/tests/unit/test_chat_output_budget.py`

---

## 6) 릴리즈 준비
- [x] 모니터링 지표: TTFT, done, generate, prompt/completion tokens, OpenAI first content.
- [x] 롤백 트리거: SSE/branch/DB 회귀, 답변 잘림, done p95 악화.
- [x] 운영 문서: 최종 결과는 별도 `MM-DD HH-mm ...md` 문서에 추가 기록한다.

근거:
- `docs/setup/04-10 11-08 Shadow TTFT 공식 측정 결과.md`

---

## 확인
- 작성자: Codex
- 검토자: 사용자
- 확인 여부: [x] 확인 [ ] 반려
