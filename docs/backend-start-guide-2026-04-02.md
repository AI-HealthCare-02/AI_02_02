# Backend Start Guide

- 작성일: 2026-04-02
- 대상: DANAA 백엔드를 처음 보는 팀원

## 1. 먼저 알아야 할 것

지금 백엔드는 "최종 DB/API 문서를 기준으로 뼈대를 정리한 상태"입니다.

즉:

- 프로젝트 구조는 정리되어 있음
- 주요 모델/스키마 이름도 1차 정렬됨
- 협업 기준 문서도 정리되어 있음
- 하지만 아직 모든 API가 실제 DB 저장/조회까지 연결된 것은 아님

## 2. 제일 먼저 읽을 문서

1. [DANAA_DB명세최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
2. [DANAA_API최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_API%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
3. [backend-restructure-summary-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-restructure-summary-2026-04-02.md)
4. [backend-implementation-pass-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-implementation-pass-2026-04-02.md)
5. [handoff.md](/C:/PycharmProjects/DANAA_project/docs/handoff.md)

## 3. 현재 기술 스택

- FastAPI
- Pydantic v2
- Tortoise ORM
- Aerich
- PostgreSQL
- Redis
- uv
- pytest

## 4. 폴더를 어떻게 보면 되는가

- [app/apis/v1](/C:/PycharmProjects/DANAA_project/app/apis/v1)
  - 실제 HTTP 엔드포인트
- [app/domains/health](/C:/PycharmProjects/DANAA_project/app/domains/health)
  - 건강 데이터 모델 / 스키마 / 서비스 / 리포지토리
- [app/domains/challenges](/C:/PycharmProjects/DANAA_project/app/domains/challenges)
  - 챌린지 모델 / 스키마 / 서비스 / 리포지토리
- [app/domains/onboarding](/C:/PycharmProjects/DANAA_project/app/domains/onboarding)
  - 온보딩 저장/계산 흐름
- [app/db](/C:/PycharmProjects/DANAA_project/app/db)
  - DB 설정, migrations, seed

기본 원칙:

- 라우터에서 ORM을 직접 길게 다루지 않음
- `router -> service -> repository -> model` 순서로 구현

## 5. 지금 바로 실행하려면

```bash
uv sync --group app --group dev --frozen
docker compose up -d postgres redis
uv run aerich upgrade
uv run python -m app.db.seeds.challenge_templates
uv run uvicorn app.main:app --reload
```

접속:

- Swagger: `http://localhost:8000/api/docs`
- OpenAPI: `http://localhost:8000/api/openapi.json`

## 6. 지금 주의할 점

- 아직 migration 재생성은 안 했음
- 테스트는 로컬 PostgreSQL이 떠 있어야 돌 수 있음
- 일부 라우터는 아직 mock 응답이 남아 있음
- 즉, 지금은 "구현 착수 가능한 뼈대" 상태이지 "완전 구현 완료" 상태는 아님

## 7. 다음 작업 우선순위

1. onboarding repository 실제 저장
2. health service/repository 구현
3. challenge service/repository 구현
4. migration 생성
5. 테스트를 새 API 기준으로 수정
