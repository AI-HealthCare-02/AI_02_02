# Migration / Seed Guide

이 문서는 DANAA 백엔드의 DB 변경 작업 절차를 정리한 문서입니다.

## 1. 현재 DB 체계

- ORM: Tortoise ORM
- Migration: Aerich
- DB: PostgreSQL
- Seed: Python module 실행 방식

## 2. 기준 문서

- DB 기준: [DANAA_DB명세최종확정안_2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%EC%B5%9C%EC%A2%85%ED%99%95%EC%A0%95%EC%95%88_2026-04-02.md)
- 엑셀 기준: [DANAA_DB명세확정안_엑셀_2026-04-02.xlsx](/C:/PycharmProjects/DANAA_project/docs/DANAA_DB%EB%AA%85%EC%84%B8%ED%99%95%EC%A0%95%EC%95%88_%EC%97%91%EC%85%80_2026-04-02.xlsx)
- 구조 변경 요약: [backend-restructure-summary-2026-04-02.md](/C:/PycharmProjects/DANAA_project/docs/backend-restructure-summary-2026-04-02.md)

## 3. 기본 실행 순서

### 인프라 실행

```bash
docker compose up -d postgres redis
```

### 마이그레이션 적용

```bash
uv run aerich upgrade
```

### 챌린지 시드 입력

```bash
uv run python -m app.db.seeds.challenge_templates
```

## 4. 모델 변경 후 절차

1. 먼저 DB 기준 문서를 수정하거나 합의합니다.
2. 모델/enum/schema를 수정합니다.
3. migration 생성:

```bash
uv run aerich migrate --name <change_name>
```

4. migration 적용:

```bash
uv run aerich upgrade
```

5. 테스트 실행:

```bash
uv run pytest app/tests -q
```

## 5. 자주 확인할 항목

- `unique_together`
- enum 값
- nullable 규칙
- JSON 기본값
- index 필요 여부
- seed 데이터와 새 enum 충돌 여부

## 6. 시드 규칙

현재 시드는 아래를 기준으로 관리합니다.

- 챌린지 템플릿: `app/db/seeds/challenge_templates.py`

원칙:

- 시드 데이터는 기준 문서와 같은 enum 값을 써야 합니다.
- display 문구보다 code/value 정합성을 먼저 맞춥니다.
- seed 실행이 여러 번 되어도 문제가 없게 idempotent 방향으로 작성합니다.
