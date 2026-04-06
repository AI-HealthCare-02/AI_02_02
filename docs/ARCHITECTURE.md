# 다나아 프로젝트 구조 안내서

> "이 프로젝트는 어떻게 생겼고, 각 부분이 뭘 하는지" 알려주는 문서

---

## 1. 전체 그림: 식당으로 이해하기

```
손님 (사용자 브라우저)
    |
    v
  Nginx (입구 안내) ---- "API 손님은 주방으로!"
    |
    v
  FastAPI (주방) ---- "주문 받고, 요리하고, 내보내기"
    |
    +---> PostgreSQL (냉장고) ---- "재료(데이터)를 보관"
    +---> Redis (메모장) ---- "오늘 특선, 예약 현황 빠른 확인"
    +---> AI Worker (출장 셰프) ---- "특별 요리(AI 추론)가 필요할 때만 호출"
```

### 실제 요청 흐름 (사용자가 대시보드를 열 때)

```
브라우저               Nginx(:80)            FastAPI(:8000)         PostgreSQL
  |                      |                       |                      |
  | GET /api/v1/dashboard/init                    |                      |
  | ------------------->  | proxy_pass            |                      |
  |                       | --------------------> |                      |
  |                       |                       | SELECT health_logs...|
  |                       |                       | -------------------> |
  |                       |                       | <------------------- |
  |                       | <-------------------- | JSON 응답            |
  | <-------------------  |                       |                      |
  | 화면에 표시           |                       |                      |
```

---

## 2. Docker 서비스 5개 (= 식당 직원 5명)

| 서비스 | 비유 | 포트 | 역할 |
|--------|------|------|------|
| **nginx** | 입구 안내 | 80 | 외부 요청을 FastAPI로 전달. SSE(AI채팅) 300초 타임아웃 설정 |
| **fastapi** | 주방 | 8000 | API 처리, 비즈니스 로직 |
| **postgres** | 냉장고 | 5432 | 데이터 영구 저장 (13개 테이블) |
| **redis** | 메모장 | 6379 | 캐시, 분산 락, 스케줄러 상태 |
| **ai-worker** | 출장 셰프 | - | AI 모델 추론 (필요할 때만 별도 실행) |

### 서비스 의존 관계

```
nginx ---> fastapi ---> postgres (DB 준비 완료 후 시작)
                    +--> redis   (캐시 준비 완료 후 시작)

ai-worker -------> postgres
               +--> redis
```

---

## 3. 폴더 지도: "여기는 뭐하는 곳?"

```
프로젝트루트/
+-- backend/              <-- 백엔드 핵심 실소스
|   +-- apis/v1/          <-- "주문서 접수 창구" (라우터 9개)
|   +-- services/         <-- "실제 요리하는 곳" (서비스 12개)
|   +-- models/           <-- "냉장고 칸 구분" (DB 테이블 13개)
|   +-- dtos/             <-- "주문서 양식" (요청/응답 형태)
|   +-- tasks/            <-- "새벽 청소 담당" (크론 작업)
|   +-- repositories/     <-- "냉장고 관리자" (User 전용, 1개)
|   +-- core/             <-- "주방 설정" (환경변수, 로거, Redis)
|   +-- dependencies/     <-- "신분증 확인" (JWT 인증)
|   +-- utils/            <-- "도구함" (암호화, 토큰 생성)
|   +-- db/               <-- "냉장고 설치/이전" (마이그레이션)
|   +-- validators/       <-- "주문서 검증" (입력값 유효성)
|   +-- tests/            <-- "맛 검증" (테스트 54개)
|   +-- main.py           <-- FastAPI 앱 시작점
|
+-- frontend/             <-- 프론트엔드 (Next.js 14)
+-- workers/ai/           <-- AI 모델 전용 공간 실소스
+-- docs/                 <-- 문서 (지금 읽고 있는 곳!)
|   +-- planning/         <-- 기획서 (읽기 전용!)
|   +-- prototypes/       <-- HTML 시안 (읽기 전용!)
|   +-- collaboration/    <-- API/DB 명세 확정안
+-- nginx/                <-- Nginx 설정 (default.conf)
+-- scripts/              <-- 배포/훅/시드 스크립트
|   +-- hooks/            <-- Git 훅 (커밋 시 자동 검사)
+-- envs/                 <-- 환경변수 예시 파일
+-- docker-compose.yml    <-- Docker 설정 (개발용)
+-- pyproject.toml        <-- Python 의존성 설정
+-- CLAUDE.md             <-- AI 페어 프로그래밍 규칙
```

---

## 4. 코드 흐름: 요청이 처리되는 순서

```
사용자 요청
  |
[Router] apis/v1/xxx_routers.py  -- "주문 접수 + 신분증 확인"
  |
[Service] services/xxx.py        -- "실제 비즈니스 로직 처리"
  |
[Model] models/xxx.py            -- "DB에서 데이터 읽기/쓰기"
  |
[DTO] dtos/xxx.py                -- "응답 데이터를 정해진 형태로 포장"
  |
JSON 응답 --> 사용자
```

### 예시: 온보딩 설문 제출 (POST /api/v1/onboarding/survey)

1. `onboarding_routers.py` -- URL 매칭 + JWT 인증 확인
2. `onboarding.py` (service) -- BMI 계산 + FINDRISC 점수 + 위험도 판정
3. `health.py` (model) -- HealthProfile 레코드 DB 저장
4. `onboarding.py` (dto) -- SurveyResponse 형태로 응답 포장

---

## 5. 라우터 목록 (API 창구 9개)

| 라우터 | URL 접두사 | 주요 기능 |
|--------|-----------|----------|
| auth_routers | /auth | 회원가입, 로그인, 토큰 갱신 |
| onboarding_routers | /onboarding | 동의, 설문, 온보딩 상태 |
| health_routers | /health | 매일 건강 기록, 측정값 |
| chat_routers | /chat | AI 채팅 (SSE 스트리밍) |
| challenge_routers | /challenges | 챌린지 참여/체크인 |
| dashboard_routers | /dashboard | 대시보드 통합 조회 |
| risk_routers | /risk | 위험도 평가 |
| analysis_routers | /analysis | 건강 분석 |
| user_routers | /users | 사용자 정보 관리 |

API 전체 목록과 테스트는 http://localhost/api/docs (Swagger UI)에서 확인할 수 있어요.

---

## 6. 설계 문서 계층 (뭘 먼저 봐야 하는지)

```
계층1(원천): 매일수집질문_DB설계.md, 온보딩설문플랜.md
     |
계층2(파생): DANAA_DB명세최종확정안 (V2)
     |
계층3(계약): DANAA_API최종확정안 (V2)
     |
계층4(참조): HTML 프로토타입 (V8-8)
     |
계층5(코드): backend/models/, backend/services/
```

DB 테이블 구조가 궁금하면 > `docs/collaboration/DANAA_DB명세최종확정안_V2_2026-04-03.md` 참고

---

## 7. 숫자로 보는 프로젝트 (2026-04-03 기준)

| 항목 | 수치 |
|------|------|
| Python 파일 | 83개 |
| API 엔드포인트 | 25개 |
| DB 테이블 | 13개 |
| Enum 정의 | 38개 StrEnum 클래스 |
| Service 모듈 | 12개 |
| 테스트 | 54개 (unit 31 + integration 23) |
| 크론 작업 | 2개 (일간 + 주간) |
