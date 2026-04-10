# LangGraph 부분 적용 결정 기록

## 한 줄 결론
- 다나아에서는 `전체 채팅 엔진`이 아니라 `LLM 준비 구간(pre-LLM preparation)`만 LangGraph로 분리한다.

## 문제 정의
- 현재 채팅 흐름은 `validation -> content_filter -> early return -> session/message 저장 -> enrichment -> prompt 조립 -> streaming` 순서다.
- 실제 복잡성이 몰린 곳은 `RAG / UserContext / prompt layer 조립`이다.
- 반대로 `content_filter`, crisis/block/consent, cooldown, DB write, SSE streaming은 의료 안전과 계약 안정성이 더 중요하다.

## 검토한 선택지
1. 미도입
   - 가장 안전하지만 구조 설명력과 포트폴리오 포인트가 약하다.
2. demo endpoint 별도 도입
   - 샘플 설명은 쉽지만 실서비스 구조 개선으로 보이기 어렵다.
3. `/chat/send` 내부 feature flag + 부분 적용
   - 실서비스 감각과 회귀 통제를 함께 보여줄 수 있다.
4. full conversion
   - 말은 강하지만 현재 구조에서는 회귀 위험과 설명 부담이 크다.

## 최종 선택
- `기존 /chat/send 내부 feature flag + partial graph`
- 모드:
  - `off`
  - `shadow`
  - `partial`

## 그래프 밖에 남기는 이유
- `content_filter`, crisis/block/consent early return, `_last_crisis_at`, DB write, `_stream_openai`, `_sse_event`는 안전/계약의 소스오브트루스다.
- 이 구간을 그래프로 옮기면 구조가 단순해지기보다 운영 리스크가 커진다.

## 그래프 안으로 넣은 이유
- `RAG 판단·검색`
- `UserContext 판단·생성`
- `prompt layer 조립`
- 이 구간은 상태 흐름 설명에 그래프가 실제 도움을 주고, 기존 helper를 재사용해 회귀를 통제할 수 있다.

## 포트폴리오 메시지
- `실서비스 경로에서 safety-critical path는 그대로 두고, 실제 복잡성이 있는 preparation 구간만 LangGraph로 분리해 설명 가능성과 운영 안정성을 동시에 확보했다.`
