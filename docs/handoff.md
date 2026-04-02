# Handoff

- 작성일: 2026-04-02
- 목적: 다음 작업자가 현재 상태를 바로 이어받을 수 있게 정리

## 1. 현재 상태

프로젝트는 지금 "최종 DB/API 문서를 기준으로 협업 가능한 백엔드 구조를 재정리했고, health/onboarding/challenge 1차 명세 정렬까지 반영한 상태"입니다.

완료한 것:

- 최종 DB 문서 확정
- 최종 API 문서 확정
- 최종 DB 엑셀 확정
- 앱 팩토리 도입
- API 라우터 진입점 정리
- 모델 등록 registry 분리
- 공통 `TimestampedModel` 분리
- onboarding / reports / settings 도메인 작업 위치 생성
- health / onboarding / challenge 1차 명세 정렬
- README / collaboration / migration / handoff 최신화

아직 안 한 것:

- repository 실제 DB 저장/조회 구현
- `health` patch/batch 검증 로직 구현
- `challenge` 서비스 실제 구현
- Aerich migration 재생성
- 테스트를 새 API 기준으로 교체

## 2. 기준 문서

- DB: [DANAA_DB명세최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
- API: [DANAA_API최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_API%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
- 엑셀: [DANAA_DB명세확정안_엑셀_2026-04-02.xlsx](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%ED%99%95%EC%A0%95%EC%95%88_%EC%97%91%EC%85%80_2026-04-02.xlsx)
- 구조 근거: [backend-baseline-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-baseline-2026-04-02.md)
- 구조 변경 요약: [backend-restructure-summary-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-restructure-summary-2026-04-02.md)
- 구현 정렬 1차: [backend-implementation-pass-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-implementation-pass-2026-04-02.md)

## 3. 현재 스택

- FastAPI
- Pydantic v2
- Tortoise ORM
- Aerich
- PostgreSQL
- Redis
- uv
- pytest

## 4. 주요 코드 위치

- 앱 생성: [app/bootstrap.py](/C:/PycharmProjects/DANAA_project/app/bootstrap.py)
- 앱 진입: [app/main.py](/C:/PycharmProjects/DANAA_project/app/main.py)
- API 조립: [app/api/router.py](/C:/PycharmProjects/DANAA_project/app/api/router.py)
- 모델 registry: [app/db/model_registry.py](/C:/PycharmProjects/DANAA_project/app/db/model_registry.py)
- DB 설정: [app/db/databases.py](/C:/PycharmProjects/DANAA_project/app/db/databases.py)

도메인별 핵심 위치:

- health: [app/domains/health](/C:/PycharmProjects/DANAA_project/app/domains/health)
- challenges: [app/domains/challenges](/C:/PycharmProjects/DANAA_project/app/domains/challenges)
- onboarding: [app/domains/onboarding](/C:/PycharmProjects/DANAA_project/app/domains/onboarding)
- reports: [app/domains/reports](/C:/PycharmProjects/DANAA_project/app/domains/reports)
- settings: [app/domains/settings](/C:/PycharmProjects/DANAA_project/app/domains/settings)

## 5. 다음 작업 순서

1. `app/domains/onboarding/repository.py`에 실제 저장 로직 연결
2. `app/domains/health/service.py`, `app/domains/health/repository.py` 구현
3. `app/apis/v1/health_routers.py`의 mock 응답을 실제 서비스 호출로 교체
4. `app/domains/challenges/service.py`, `app/domains/challenges/repository.py` 구현
5. Aerich migration 생성
6. 테스트를 새 API 기준으로 수정

## 6. 검증 상태

확인한 것:

- `compileall app` 통과

막힌 것:

- `pytest`는 로컬 PostgreSQL이 `localhost:5432`에서 떠 있지 않아 실패

즉, 현재 실패 원인은 문법 문제가 아니라 테스트용 DB 미기동입니다.
