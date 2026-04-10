# LangGraph 면접 설명 스크립트

## 30초 버전
- `다나아 채팅은 의료 안전이 중요한 서비스라서 전체를 LangGraph로 바꾸지 않았습니다. 대신 실제 복잡성이 있는 RAG, UserContext, prompt 조립만 그래프로 분리했고, content_filter·DB write·SSE는 기존 명시적 셸에 남겨 성능과 회귀 위험을 통제했습니다.`

## 2분 버전
- `먼저 기존 chat 흐름을 문서화해서 어디가 안전 셸이고 어디가 준비 구간인지 분리했습니다.`
- `그 다음 reason_codes enum, normalize option C, chat 패키지 분리로 내부 구조를 정리한 뒤, LangGraph는 prep subflow에만 넣었습니다.`
- `적용 방식도 바로 live가 아니라 off/shadow/partial로 설계해서 parity와 latency를 먼저 확인하도록 했습니다.`
- `특히 crisis/block/consent, cooldown, DB write, SSE는 graph 밖에 두어 의료 안전과 응답 계약을 우선했습니다.`

## 예상 질문
### 왜 전체 전환 안 했나요?
- 의료 안전과 SSE 계약이 더 중요한 구간은 명시적 셸이 더 감시 가능했기 때문입니다.

### 왜 demo endpoint가 아니라 실경로에 넣었나요?
- 실서비스 경로 안에서 feature flag로 통제해야 실제 운영 감각과 회귀 통제 능력을 보여줄 수 있기 때문입니다.

### 왜 이 구간만 graph로 뺐나요?
- 실제 조건부 복잡성이 `RAG / UserContext / prompt layers`에 몰려 있었기 때문입니다.

### 성능 저하는 어떻게 막았나요?
- compile once, no checkpointer, no graph streaming, sticky bucketing, timeout fallback, shadow parity 측정으로 방어했습니다.

### 장애 시 어떻게 되돌리나요?
- `mode=off` kill switch와 요청 단위 legacy fallback을 둬서 즉시 되돌릴 수 있습니다.
