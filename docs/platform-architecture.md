# 다나아 플랫폼 아키텍처

## 목표

다나아는 기본적으로 웹 서비스로 시작하지만, 아래 채널까지 같은 백엔드를 재사용할 수 있어야 합니다.

- 웹 프론트엔드
- 안드로이드 앱
- iOS 앱
- MCP 연동 클라이언트
- 외부 챗봇 / 자동화 플랫폼

## 권장 기본 구조

```text
clients
  ├─ web
  ├─ android
  ├─ ios
  ├─ mcp-client
  └─ external-chatbots

backend
  ├─ app/apis/v1
  ├─ app/domains
  ├─ app/integrations
  ├─ app/db
  └─ ai_worker
```

핵심 원칙:

1. 도메인 로직은 `app/domains`에 둔다.
2. 외부 연동별 차이는 `app/integrations`에서 흡수한다.
3. 클라이언트는 모두 같은 API 계약을 최대한 재사용한다.
4. 웹 전용/앱 전용 화면 차이는 프론트에서 처리하고, 백엔드는 채널 중립적으로 유지한다.

## 왜 이 구조가 좋은가

### 웹 우선 개발이 가능함

지금은 웹이 가장 빨리 나가야 하므로 Swagger와 REST API 중심으로 개발하면 된다.

### 앱 확장이 쉬움

안드로이드/iOS는 결국 같은 인증, 같은 사용자 데이터, 같은 건강 로그, 같은 챌린지 데이터를 쓴다.
그래서 백엔드를 따로 만들 필요가 없다.

### 외부 챗봇 연동이 쉬움

나중에 카카오, 자체 챗봇, MCP 기반 에이전트가 붙어도 도메인 코드를 건드리지 않고 `integrations` 경계에서 연결할 수 있다.

## 최종 권장 스택

- API: FastAPI
- ORM: Tortoise ORM
- DB: PostgreSQL
- Cache/Broker: Redis
- Migration: Aerich
- Infra: Docker Compose
- Reverse Proxy: Nginx
- Background/AI Worker: 별도 Python 프로세스

## 인증 전략

### 기본

- 웹/앱: JWT
- 외부 연동: API Key 또는 서명 검증 webhook

### 이유

- 모바일 앱과 웹은 같은 사용자 인증 흐름을 재사용할 수 있음
- 외부 챗봇/자동화 플랫폼은 사용자 세션보다 서버 간 인증이 더 적합함

## API 전략

### 공통 원칙

- 모든 클라이언트는 `/api/v1` 기준 사용
- 문서 기준점은 `/api/docs`
- 플랫폼/연동 상태는 별도 라우터에서 관리

추가된 뼈대:
- [app/apis/v1/platform_routers.py](/abs/path/C:/PycharmProjects/final_project_template/app/apis/v1/platform_routers.py)
- [app/apis/v1/integration_routers.py](/abs/path/C:/PycharmProjects/final_project_template/app/apis/v1/integration_routers.py)

## 외부 연동 경계

추가된 패키지:

- [app/integrations/mobile/contracts.py](/abs/path/C:/PycharmProjects/final_project_template/app/integrations/mobile/contracts.py)
- [app/integrations/chatbots/contracts.py](/abs/path/C:/PycharmProjects/final_project_template/app/integrations/chatbots/contracts.py)
- [app/integrations/mcp/contracts.py](/abs/path/C:/PycharmProjects/final_project_template/app/integrations/mcp/contracts.py)

이 패키지들은 지금 당장 기능을 다 구현하는 목적이 아니라,
"나중에 연동 코드가 도메인 코드로 흘러들어가지 않게 막는 경계" 역할을 한다.

## 나중에 추가하면 좋은 것

- S3 같은 파일 스토리지
- 푸시 알림(FCM/APNs)
- 작업 큐(Celery, Dramatiq, RQ 중 하나)
- 관측성(Sentry, Prometheus, Grafana)
- 외부 OAuth 또는 헬스 플랫폼 연동

## 지금 기준 최종 뼈대 결론

현재 프로젝트는 아래 방향으로 가는 것이 가장 안정적입니다.

1. 웹 우선 REST API 개발
2. 앱은 동일 API 재사용
3. MCP/외부 챗봇은 `integrations` 경계로 추가
4. DB는 PostgreSQL
5. 도메인 코드는 `health`, `challenges`로 유지
