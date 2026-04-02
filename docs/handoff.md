# Handoff

- 작성일: 2026-04-02
- 목적: 새 프롬프트/새 세션에서도 현재 상태를 바로 이어받을 수 있게 정리

## 1. 현재 상태

프로젝트는 지금 "최종 DB/API 문서를 기준으로 백엔드 협업 뼈대를 재정리했고, health/onboarding/challenge 1차 명세 정렬까지 반영한 상태"입니다.

완료한 것:

- 최종 DB 문서 확정
- 최종 API 문서 확정
- 최종 DB 엑셀 확정
- 앱 팩토리 도입
- API 라우터 진입점 정리
- 모델 registry 분리
- 공통 `TimestampedModel` 분리
- onboarding / reports / settings 도메인 작업 위치 생성
- health / onboarding / challenge 1차 명세 정렬
- README / collaboration / migration / handoff 최신화
- 변경분 Git 커밋 완료

아직 안 한 것:

- onboarding repository 실제 DB 저장 연결
- health repository/service 실제 구현
- challenge repository/service 실제 구현
- Aerich migration 생성/적용 확인
- 테스트를 새 API 기준으로 수정
- 라우터 mock 응답을 실제 DB 로직으로 교체

## 2. 최신 Git 상태

- 최근 커밋: `6e75694`
- 커밋 메시지: `refactor: align backend skeleton with final DB API docs`
- 현재 워크트리: clean

## 3. 기준 문서

- DB 기준: [DANAA_DB명세최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
- API 기준: [DANAA_API최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_API%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
- 엑셀 기준: [DANAA_DB명세확정안_엑셀_2026-04-02.xlsx](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%ED%99%95%EC%A0%95%EC%95%88_%EC%97%91%EC%85%80_2026-04-02.xlsx)

보조 문서:

- 구조 근거: [backend-baseline-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-baseline-2026-04-02.md)
- 구조 변경 요약: [backend-restructure-summary-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-restructure-summary-2026-04-02.md)
- 구현 반영 1차: [backend-implementation-pass-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-implementation-pass-2026-04-02.md)
- 초심자 시작 문서: [backend-start-guide-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-start-guide-2026-04-02.md)
- 마이그레이션 가이드: [migration-seed-guide.md](/C:/PycharmProjects/DANAA_project/docs/migration-seed-guide.md)
- 협업 규칙: [collaboration-standards.md](/C:/PycharmProjects/DANAA_project/docs/collaboration-standards.md)

## 4. 현재 스택

- FastAPI
- Pydantic v2
- Tortoise ORM
- Aerich
- PostgreSQL
- Redis
- uv
- pytest

현재 판단:

- 지금 단계에서는 `SQLAlchemy` 전환보다 현재 스택 유지가 더 합리적
- 이유는 기존 코드, 테스트, 마이그레이션 흐름이 이미 Tortoise/Aerich 기준이기 때문
- 장기적으로는 Tortoise 1.x 및 built-in migrations 검토 여지는 있지만, 지금 즉시 전환 대상은 아님

## 5. 주요 코드 위치

- 앱 생성: [app/bootstrap.py](/C:/PycharmProjects/DANAA_project/app/bootstrap.py)
- 앱 진입: [app/main.py](/C:/PycharmProjects/DANAA_project/app/main.py)
- API 조립: [app/api/router.py](/C:/PycharmProjects/DANAA_project/app/api/router.py)
- 모델 registry: [app/db/model_registry.py](/C:/PycharmProjects/DANAA_project/app/db/model_registry.py)
- DB 설정: [app/db/databases.py](/C:/PycharmProjects/DANAA_project/app/db/databases.py)

도메인별 위치:

- health: [app/domains/health](/C:/PycharmProjects/DANAA_project/app/domains/health)
- challenges: [app/domains/challenges](/C:/PycharmProjects/DANAA_project/app/domains/challenges)
- onboarding: [app/domains/onboarding](/C:/PycharmProjects/DANAA_project/app/domains/onboarding)
- reports: [app/domains/reports](/C:/PycharmProjects/DANAA_project/app/domains/reports)
- settings: [app/domains/settings](/C:/PycharmProjects/DANAA_project/app/domains/settings)

## 6. 다음 작업 순서

1. `app/domains/onboarding/repository.py`에 실제 저장 로직 연결
2. `app/domains/health/service.py`, `app/domains/health/repository.py` 구현
3. `app/apis/v1/health_routers.py`의 mock 응답을 실제 서비스 호출로 교체
4. `app/domains/challenges/service.py`, `app/domains/challenges/repository.py` 구현
5. Aerich migration 생성
6. Aerich upgrade 및 DB 반영 확인
7. 테스트를 새 API 기준으로 수정

## 7. 검증 상태

확인한 것:

- `.\.venv\Scripts\python.exe -m compileall app` 통과

아직 확인 안 된 것:

- `aerich migrate`
- `aerich upgrade`
- 새 모델 기준 DB 반영 확인

막힌 것:

- `pytest`는 로컬 PostgreSQL이 `localhost:5432`에서 떠 있지 않아 DB 연결 단계에서 실패

즉 현재 실패 원인은 문법 문제가 아니라 테스트용 DB 미기동입니다.

## 8. 새 세션에서 바로 시작할 프롬프트 방향

새 세션에서는 아래처럼 이어가면 됩니다.

- "현재 handoff와 최종 DB/API 문서를 기준으로 onboarding repository 실제 저장 로직부터 구현"
- 또는 "Aerich migration 생성/적용부터 진행하고 에러를 수정"

우선순위는 migration보다 먼저 모델/저장 로직 일부를 더 닫고 가는 쪽이 안전합니다.
