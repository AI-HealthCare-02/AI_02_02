# Backend Restructure Summary

- 작성일: 2026-04-02
- 목적: 최종 DB/API 문서를 기준으로 현재 백엔드 구조를 왜 이렇게 잡았는지, 무엇을 바꿨는지, 다음 구현이 어디서부터 시작되어야 하는지 한 번에 정리

## 1. 기준 문서

- DB 기준: [DANAA_DB명세최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
- API 기준: [DANAA_API최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_API%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
- 엑셀 기준: [DANAA_DB명세확정안_엑셀_2026-04-02.xlsx](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%ED%99%95%EC%A0%95%EC%95%88_%EC%97%91%EC%85%80_2026-04-02.xlsx)

## 2. 이번 구조 개편의 결론

이번 개편의 목표는 "ORM까지 갈아엎는 전면 재개발"이 아니라, 최종 문서를 기준으로 팀이 바로 협업할 수 있는 백엔드 뼈대를 만드는 것이었습니다.

그래서 현재 선택은 아래와 같습니다.

- API 프레임워크: FastAPI 유지
- 스키마: Pydantic v2 유지
- ORM: Tortoise ORM 유지
- 마이그레이션: Aerich 유지
- DB: PostgreSQL 유지
- 캐시/운영 상태: Redis 유지
- 패키지/실행: uv 유지
- 테스트: pytest 유지

## 3. 왜 이 선택이 합리적인가

### 3-1. 지금 ORM을 바꾸지 않은 이유

현재 코드, 테스트, 마이그레이션은 이미 `FastAPI + Tortoise + Aerich`를 기준으로 움직이고 있습니다.

이 시점에 SQLAlchemy/Alembic으로 바꾸면 아래가 동시에 필요합니다.

- 모든 모델 재작성
- 마이그레이션 체계 재작성
- repository 계층 재검증
- 테스트 픽스처 재정비
- auth/user/challenge/health 라우터 전체 영향 분석

즉, 최종 DB/API 문서가 막 확정된 단계에서 가장 중요한 "협업 가능한 작업 기반"이 늦어집니다.

따라서 이번에는 스택을 유지하고, 구조 경계를 먼저 정리하는 쪽이 더 합리적입니다.

### 3-2. 대신 무엇을 먼저 고정했는가

- 앱 생성 진입점
- API 라우터 진입점
- DB 모델 등록 위치
- 공통 base model
- 도메인별 service/repository 작업 위치
- 협업 문서와 마이그레이션 문서

이렇게 해두면 이후 ORM 전환이 필요해져도 `router -> service -> repository -> model` 경계를 따라 바꾸면 됩니다.

## 4. 실제로 바뀐 구조

### 4-1. 앱 진입 구조

- [app/bootstrap.py](/C:/PycharmProjects/DANAA_project/app/bootstrap.py)
  - `create_app()` 추가
- [app/main.py](/C:/PycharmProjects/DANAA_project/app/main.py)
  - 앱 객체 생성만 담당

효과:

- 테스트 환경에서 앱 생성 책임이 분리됨
- 설정/초기화 확장 지점이 명확해짐

### 4-2. API 라우터 진입 구조

- [app/api/router.py](/C:/PycharmProjects/DANAA_project/app/api/router.py)
  - `/api/v1` 라우터 조립 전용 파일

효과:

- 라우터 진입점이 하나로 고정됨
- 이후 버전 라우팅 정리 시 수정 지점이 명확함

### 4-3. DB 모델 등록 구조

- [app/db/model_registry.py](/C:/PycharmProjects/DANAA_project/app/db/model_registry.py)
  - Aerich/Tortoise가 참조할 모델 모듈 목록 중앙화
- [app/db/databases.py](/C:/PycharmProjects/DANAA_project/app/db/databases.py)
  - 모델 등록 목록을 registry에서 읽도록 변경

효과:

- 마이그레이션과 앱 초기화가 같은 모델 목록을 보게 됨

### 4-4. 공통 도메인 기반 모델

- [app/domains/common/models.py](/C:/PycharmProjects/DANAA_project/app/domains/common/models.py)
  - `TimestampedModel` 공통화

효과:

- health/challenges 중복 제거
- 이후 reports/settings 쪽 모델 추가 시 재사용 가능

### 4-5. 도메인별 작업 위치 확보

추가된 위치:

- [app/domains/onboarding](/C:/PycharmProjects/DANAA_project/app/domains/onboarding)
- [app/domains/reports](/C:/PycharmProjects/DANAA_project/app/domains/reports)
- [app/domains/settings](/C:/PycharmProjects/DANAA_project/app/domains/settings)
- [app/domains/health/service.py](/C:/PycharmProjects/DANAA_project/app/domains/health/service.py)
- [app/domains/health/repository.py](/C:/PycharmProjects/DANAA_project/app/domains/health/repository.py)
- [app/domains/challenges/service.py](/C:/PycharmProjects/DANAA_project/app/domains/challenges/service.py)
- [app/domains/challenges/repository.py](/C:/PycharmProjects/DANAA_project/app/domains/challenges/repository.py)

효과:

- "라우터에서 바로 ORM 만지는 구조"로 다시 흐르지 않게 막음
- 협업할 때 각자 손댈 위치가 분리됨

## 5. 지금 구조에서 팀이 따라야 할 구현 순서

### 5-1. health 도메인 정렬

우선 수정 대상:

- [app/domains/health/enums.py](/C:/PycharmProjects/DANAA_project/app/domains/health/enums.py)
- [app/domains/health/models.py](/C:/PycharmProjects/DANAA_project/app/domains/health/models.py)
- [app/domains/health/schemas.py](/C:/PycharmProjects/DANAA_project/app/domains/health/schemas.py)
- [app/apis/v1/health_routers.py](/C:/PycharmProjects/DANAA_project/app/apis/v1/health_routers.py)

이유:

- 현재 코드가 아직 예전 필드명 `sleep`, `foodcomp`, `walk` 중심이라 최종 DB/API 문서와 어긋남

### 5-2. onboarding 도메인 정렬

우선 수정 대상:

- [app/apis/v1/onboarding_routers.py](/C:/PycharmProjects/DANAA_project/app/apis/v1/onboarding_routers.py)
- [app/domains/onboarding/service.py](/C:/PycharmProjects/DANAA_project/app/domains/onboarding/service.py)
- [app/domains/onboarding/repository.py](/C:/PycharmProjects/DANAA_project/app/domains/onboarding/repository.py)

이유:

- `relation -> user_group 서버 계산`
- `ai_consent = agreed/declined`
- BMI / FINDRISC 계산

이 규칙이 최종 API의 핵심이기 때문입니다.

### 5-3. challenges / reports / settings 순차 구현

우선 수정 대상:

- [app/domains/challenges/models.py](/C:/PycharmProjects/DANAA_project/app/domains/challenges/models.py)
- [app/domains/challenges/schemas.py](/C:/PycharmProjects/DANAA_project/app/domains/challenges/schemas.py)
- [app/apis/v1/challenge_routers.py](/C:/PycharmProjects/DANAA_project/app/apis/v1/challenge_routers.py)
- [app/domains/reports/service.py](/C:/PycharmProjects/DANAA_project/app/domains/reports/service.py)
- [app/domains/settings/service.py](/C:/PycharmProjects/DANAA_project/app/domains/settings/service.py)

## 6. 현재 남아 있는 의도적인 미완료 범위

이번 작업은 "협업용 구조 개편"까지입니다. 아래는 아직 일부러 남겨둔 영역입니다.

- health/challenges 모델의 최종 문서 정렬
- 온보딩/리포트/설정 서비스 실제 구현
- mock 응답 제거
- Aerich migration 재생성
- 테스트를 최종 API 문서 기준으로 교체

즉, 지금은 설계를 다시 흔드는 단계가 아니라 실제 구현을 시작하는 단계입니다.

## 7. 이번 개편으로 팀이 바로 얻는 것

- 문서 기준이 명확함
- 구조 진입점이 명확함
- 도메인별 작업 위치가 명확함
- 이후 마이그레이션 작업 순서가 명확함
- 여러 명이 동시에 작업해도 충돌 범위를 줄일 수 있음

## 8. 추천 다음 액션

1. health enums/models/schemas를 최종 DB/API 문서 기준으로 정렬
2. onboarding service/repository 구현
3. challenge service/repository 구현
4. Aerich migration 생성
5. 계약 테스트를 최종 API 기준으로 교체
