# Shadow TTFT 개발 안전 체크리스트

## 1. 요구사항 / 영향 범위 분석
- [x] 변경 목적과 성공 기준을 한 문장으로 정리했다.
- [x] 영향 범위를 나열했다.
- [x] 현재 API / DB 계약과 충돌 여부를 확인했다.
- [x] 캐시, 권한, 성능, 동시성 영향을 점검했다.

근거:
- 목적: `gpt-4o-mini` 고정 상태에서 `shadow 서버 TTFT`를 줄인다.
- 영향 범위: `ChatService` hot path, LangGraph adapter 진입 조건, `/chat` router dependency, benchmark 계측.
- 불변 계약: `/chat/send`, SSE `token/error/done`, `done` payload, branch precedence, DB write semantics.

---

## 2. 데이터 안전
- [x] SoT를 명시했다.
- [x] 상태 전이 규칙을 정의했다.
- [x] 동시성 위험 구간을 확인했다.
- [x] 실패 시 복구 경로를 정리했다.

근거:
- SoT: `ChatService.send_message_stream()` 전체 서비스 경로 벤치.
- 상태 전이: `validation -> content_filter -> consent/crisis/block -> session/user save -> prep -> stream -> done`.
- 병렬화는 `USER` 저장 이후의 `history` 조회와 `eligible_bundles` 조회로 제한했다.
- 실패 시 기존 SSE `error` 흐름을 유지한다.

---

## 3. DB / API 변경
- [x] DB 스키마 변경 없음.
- [x] 마이그레이션 없음.
- [x] API 계약 변경 없음.
- [x] 파괴적 DB 작업 없음.

근거:
- DB 저장 순서와 schema를 변경하지 않았다.
- `ChatService` singleton은 내부 dependency 방식 변경이며 외부 API는 유지된다.

---

## 4. 외부 연동 / 운영 경계
- [x] OpenAI 호출 경로를 유지했다.
- [x] LangGraph shadow 동작과 live response 경계를 분리했다.
- [x] 로컬 개발 환경과 Docker 네트워크 차이를 기록했다.

근거:
- `Chat Completions + stream=True` 유지.
- `shadow sample` 미선택 요청은 adapter에 들어가지 않는다.
- 로컬 pytest는 `DB_HOST=localhost`, Docker 내부 서비스는 `DB_HOST=postgres`가 맞다.

---

## 5. 테스트 계획
- [x] 단위 테스트를 실행했다.
- [x] 통합 테스트를 실행했다.
- [x] 실제 OpenAI smoke bench를 실행했다.
- [x] 잔여 리스크를 명시했다.

근거:
- `ruff`: 통과
- `backend/tests/unit`: `200 passed`
- `backend/tests/integration/test_chat_branch_flow.py`: `5 passed`
- `test_bench_service_ttft.py` smoke: 통과
- 잔여 리스크: 공식 판단용 `10개 입력 x 30 pair` benchmark는 아직 미실행.

---

## 6. 릴리즈 준비
- [x] 모니터링 지표를 정했다.
- [x] 롤백 트리거를 정했다.
- [x] 구현 기록을 최신화했다.

근거:
- 지표: `server_ttft_sec`, `done_sec`, `generate_sec`, `prompt_tokens_estimate`, `completion_tokens_estimate`.
- 롤백 트리거: branch/SSE/DB semantics 회귀, shadow 5%에서 done 악화, TTFT 개선 부재.
- 구현 기록: `docs/setup/04-10 10-50 Shadow TTFT 추가 단축 구현 기록.md`.

---

## 확인
- 작성자: Codex
- 검토자: 미정
- 확인 여부: [x] 확인 [ ] 반려
- 반려 시 사유:
