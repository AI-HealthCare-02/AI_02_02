# Backend Baseline

- 작성일: 2026-04-02
- 목적: 현재 최종 DB/API 문서를 기준으로, 코드 구조와 협업 기준을 다시 잡은 이유와 변경 내역을 정리

## 1. 결정 요약

현재 백엔드 기준 스택은 아래로 고정합니다.

- API 프레임워크: FastAPI
- 스키마: Pydantic v2
- ORM: Tortoise ORM
- 마이그레이션: Aerich
- DB: PostgreSQL
- 캐시/운영 상태: Redis
- 실행/패키지 관리: uv
- 테스트: pytest

## 2. 왜 ORM을 지금 바꾸지 않았나

최종 DB/API 문서는 새로 확정됐지만, 현재 코드와 테스트, 마이그레이션은 이미 Tortoise/Aerich를 기준으로 동작합니다.

지금 ORM을 SQLAlchemy/Alembic으로 바꾸면:

- 모델 전체 재작성
- 마이그레이션 체계 전체 교체
- 테스트 재정비
- 보안/auth/user 흐름 동시 수정

이 필요합니다.

현재 프로젝트 단계에서 더 중요한 건 "협업 가능한 골격"입니다.  
그래서 이번에는 ORM 교체보다 아래를 우선했습니다.

- 앱 팩토리 도입
- DB 모델 레지스트리 분리
- 공용 base model 분리
- 도메인별 작업 위치 추가
- 문서와 코드 기준선 정리

## 3. 이번에 바꾼 구조

### 앱 진입점

- `app/bootstrap.py`
  - 앱 팩토리 `create_app()` 추가
- `app/main.py`
  - 팩토리 호출만 담당

효과:

- 테스트와 앱 생성 책임 분리
- 추후 설정별 앱 생성 확장 쉬움

### API 진입점

- `app/api/router.py`
  - `/api/v1` 라우터 조립 위치를 명시화

효과:

- 실제 라우터 조립 지점이 하나로 정리됨

### DB 모델 레지스트리

- `app/db/model_registry.py`
  - ORM 모델 등록 목록 중앙화

효과:

- 테스트, DB 설정, 마이그레이션이 같은 모델 목록을 참조

### 공용 도메인 베이스

- `app/domains/common/models.py`
  - `TimestampedModel` 공용화

효과:

- health/challenges 중복 제거

### 도메인 작업 위치 추가

신규 패키지:

- `app/domains/onboarding`
- `app/domains/reports`
- `app/domains/settings`

효과:

- 앞으로 구현할 서비스/리포지토리의 위치를 팀이 공통으로 이해 가능

## 4. 현재 추천 작업 방식

도메인별 책임은 아래처럼 나눕니다.

- `app/apis/v1/*`
  - HTTP 입출력
- `app/domains/<domain>/service.py`
  - 유스케이스 로직
- `app/domains/<domain>/repository.py`
  - ORM 접근
- `app/domains/<domain>/models.py`
  - 저장 모델
- `app/domains/<domain>/schemas.py`
  - 요청/응답 스키마

즉, 라우터에서 직접 ORM을 만지지 않고:

`router -> service -> repository -> model`

순서로 구현하는 구조를 기준으로 삼습니다.

## 5. 문서 기준선

현재 기준 문서는 아래 3개입니다.

- [DANAA_DB명세최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
- [DANAA_API최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_API%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
- [DANAA_DB명세확정안_엑셀_2026-04-02.xlsx](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%ED%99%95%EC%A0%95%EC%95%88_%EC%97%91%EC%85%80_2026-04-02.xlsx)

## 6. 다음 단계

1. health/challenges 모델을 최종 DB 문서 기준으로 정렬
2. onboarding / reports / settings 서비스 구현 시작
3. 라우터에서 mock 응답 제거
4. Aerich migration 생성
5. 계약 테스트를 최종 API 문서 기준으로 교체
